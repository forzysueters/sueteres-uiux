/**
 * Gerador IoT mock — simula leituras 4-20 mA realistas para o motor W22.
 *
 * Como funciona:
 *   1. Cada sensor tem um valor "estado-atual" físico que evolui no tempo.
 *   2. Inverte-se a regra de 3 para gerar o raw correspondente em mA.
 *   3. Adiciona-se ruído gaussiano sobre o raw (não sobre o físico).
 *   4. Eventos aleatórios injetam: drift, spike, sensor offline.
 *
 * Cenário base (motor saudável operando próximo do nominal):
 *   - tensão ~220 V (estável)
 *   - corrente ~12.5 A
 *   - temperatura sobe lentamente até ~75 °C e estabiliza
 *   - rotação ~3525 RPM (pouca variação)
 *   - vibração ~1.8 mm/s (zona ISO 10816 A — bom)
 */
import {
  convertRawToPhysical,
  getSensorDefinitions,
  persistReading,
  RAW_OFFLINE_THRESHOLD,
  SensorDefinition,
  SensorStatus,
} from './sensor.service.js'
import { db } from '../db/connection.js'

interface SensorState {
  current_value: number
  drift: number
  ttl_anomaly: number // ticks restantes da anomalia atual
  anomaly_kind: 'none' | 'drift' | 'spike' | 'offline'
}

// caixa Müller-Box: ruído gaussiano N(0, 1)
function gaussian(): number {
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function physicalToRaw(value: number, def: SensorDefinition): number {
  const span = def.physical_max - def.physical_min
  if (span === 0) return def.raw_min
  const ratio = (value - def.physical_min) / span
  return def.raw_min + ratio * (def.raw_max - def.raw_min)
}

export class IoTMockGenerator {
  private states = new Map<string, SensorState>()
  private intervalHandle: NodeJS.Timeout | null = null
  private equipmentId: number
  private definitions: SensorDefinition[] = []

  constructor(equipmentTag: string = 'MTR-001') {
    const row = db
      .prepare('SELECT id FROM equipment WHERE tag = ?')
      .get(equipmentTag) as { id: number } | undefined
    if (!row) {
      throw new Error(`[iot-mock] equipamento ${equipmentTag} não encontrado`)
    }
    this.equipmentId = row.id
    this.refreshDefinitions()
  }

  refreshDefinitions(): void {
    this.definitions = getSensorDefinitions(this.equipmentId)
    for (const def of this.definitions) {
      if (!this.states.has(def.sensor_key)) {
        this.states.set(def.sensor_key, {
          current_value: def.nominal_value ?? def.physical_min,
          drift: 0,
          ttl_anomaly: 0,
          anomaly_kind: 'none',
        })
      }
    }
  }

  /**
   * Avança um tick: gera nova leitura para cada sensor, persiste no banco.
   */
  tick(): void {
    for (const def of this.definitions) {
      const state = this.states.get(def.sensor_key)!

      // chance de iniciar uma anomalia
      if (state.anomaly_kind === 'none' && Math.random() < 0.005) {
        const dice = Math.random()
        if (dice < 0.4) {
          state.anomaly_kind = 'drift'
          state.ttl_anomaly = 30 + Math.floor(Math.random() * 60)
          state.drift =
            (Math.random() < 0.5 ? -1 : 1) *
            (def.threshold_warn ?? def.physical_max * 0.7) *
            0.005
        } else if (dice < 0.7) {
          state.anomaly_kind = 'spike'
          state.ttl_anomaly = 1 + Math.floor(Math.random() * 3)
        } else {
          state.anomaly_kind = 'offline'
          state.ttl_anomaly = 2 + Math.floor(Math.random() * 5)
        }
      }

      const baseline = def.nominal_value ?? def.physical_min
      const range = def.physical_max - def.physical_min
      const baseNoiseStd = range * 0.005 // 0.5% do range

      // evolução suave em torno do nominal
      const meanReversion = (baseline - state.current_value) * 0.05
      const noise = gaussian() * baseNoiseStd
      state.current_value += meanReversion + noise + state.drift

      // aplicação da anomalia em curso
      let raw_mA: number
      let valueOverride: number | null = null

      if (state.anomaly_kind === 'spike' && state.ttl_anomaly > 0) {
        valueOverride =
          baseline + (def.threshold_crit ?? baseline * 1.5) - baseline
        valueOverride += gaussian() * baseNoiseStd * 3
      }

      if (state.anomaly_kind === 'offline' && state.ttl_anomaly > 0) {
        // simula cabo desconectado: raw cai abaixo de 4 mA
        raw_mA = 0.5 + Math.random() * (RAW_OFFLINE_THRESHOLD - 1)
      } else {
        const physical = valueOverride ?? state.current_value
        raw_mA = physicalToRaw(physical, def) + gaussian() * 0.05 // ruído elétrico no sensor
        // evita valores fisicamente impossíveis no raw fora do range
        raw_mA = Math.max(0, Math.min(raw_mA, def.raw_max + 1))
      }

      const conv = convertRawToPhysical(raw_mA, def)
      persistReading({
        equipment_id: this.equipmentId,
        sensor_key: def.sensor_key,
        value_raw: round(raw_mA, 3),
        value: round(conv.value, 3),
        unit: conv.unit,
        status: conv.status as SensorStatus,
      })

      // decai TTL e zera anomalia
      if (state.ttl_anomaly > 0) {
        state.ttl_anomaly -= 1
        if (state.ttl_anomaly === 0) {
          state.anomaly_kind = 'none'
          state.drift = 0
        }
      }
    }

    this.recomputeEquipmentStatus()
  }

  /**
   * Atualiza o status agregado do equipamento (pior status entre os sensores).
   */
  private recomputeEquipmentStatus(): void {
    const latestPerSensor = db
      .prepare(
        `SELECT sensor_key, status FROM sensor_reading
          WHERE equipment_id = ?
          AND id IN (
            SELECT MAX(id) FROM sensor_reading
             WHERE equipment_id = ?
             GROUP BY sensor_key
          )`,
      )
      .all(this.equipmentId, this.equipmentId) as { status: string }[]

    const order: Record<string, number> = {
      normal: 0,
      warning: 1,
      critical: 2,
      offline: 1,
    }
    let worst = 'normal'
    for (const r of latestPerSensor) {
      if ((order[r.status] ?? 0) > (order[worst] ?? 0)) worst = r.status
    }
    db.prepare(
      `UPDATE equipment SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(worst, this.equipmentId)
  }

  start(intervalMs: number = 2000): void {
    if (this.intervalHandle) return
    this.refreshDefinitions()
    this.intervalHandle = setInterval(() => this.tick(), intervalMs)
    console.log(
      `🛰️  IoT mock generator iniciado (tick=${intervalMs}ms, sensores=${this.definitions.length})`,
    )
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  /**
   * Pré-aquece o histórico com N pontos do passado para a tela de histórico
   * já ter dados ao abrir a aplicação pela primeira vez.
   */
  warmupHistory(points: number = 360, stepSeconds: number = 10): void {
    const existing = db
      .prepare(
        'SELECT COUNT(*) as c FROM sensor_reading WHERE equipment_id = ?',
      )
      .get(this.equipmentId) as { c: number }
    if (existing.c >= points) {
      console.log(
        `  · histórico já tem ${existing.c} pontos, pulando warmup`,
      )
      return
    }

    const insert = db.prepare(
      `INSERT INTO sensor_reading
        (equipment_id, sensor_key, value_raw, value, unit, status, ts, is_simulated)
       VALUES
        (@equipment_id, @sensor_key, @value_raw, @value, @unit, @status, @ts, 1)`,
    )

    const txn = db.transaction(() => {
      const now = Date.now()
      for (let i = points; i > 0; i--) {
        const ts = new Date(now - i * stepSeconds * 1000).toISOString()
        for (const def of this.definitions) {
          const state = this.states.get(def.sensor_key)!
          const range = def.physical_max - def.physical_min
          const baseline = def.nominal_value ?? def.physical_min
          const noise = gaussian() * range * 0.008
          state.current_value =
            baseline + Math.sin(i / 30) * range * 0.02 + noise
          const raw_mA = physicalToRaw(state.current_value, def)
          const conv = convertRawToPhysical(raw_mA, def)
          insert.run({
            equipment_id: this.equipmentId,
            sensor_key: def.sensor_key,
            value_raw: round(raw_mA, 3),
            value: round(conv.value, 3),
            unit: conv.unit,
            status: conv.status,
            ts,
          })
        }
      }
    })
    txn()
    console.log(`  ✓ warmup: ${points} pontos × ${this.definitions.length} sensores`)
  }
}

function round(n: number, digits: number): number {
  const m = Math.pow(10, digits)
  return Math.round(n * m) / m
}
