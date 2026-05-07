import { supabase } from '../lib/supabaseClient'
import {
  Equipment,
  PlacaField,
  SensorDefinition,
  SensorReading,
  SensorStatus,
} from '../types/digital-twin'

const RAW_OFFLINE_THRESHOLD = 3.5

const findEquipmentIdByTag = async (tag: string): Promise<number> => {
  const { data, error } = await supabase
    .from('equipments')
    .select('id')
    .eq('tag', tag)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Equipamento ${tag} não encontrado`)
  return data.id as number
}

const convertRawToPhysical = (
  rawMa: number,
  def: SensorDefinition,
): { value: number; status: SensorStatus; unit: string } => {
  if (rawMa < RAW_OFFLINE_THRESHOLD) {
    return { value: 0, status: 'offline', unit: def.unit }
  }
  const clamped = Math.min(Math.max(rawMa, def.raw_min), def.raw_max)
  const span = def.raw_max - def.raw_min
  const ratio = (clamped - def.raw_min) / span
  const value = def.physical_min + ratio * (def.physical_max - def.physical_min)

  let status: SensorStatus = 'normal'
  if (def.threshold_crit !== null && value >= def.threshold_crit) {
    status = 'critical'
  } else if (def.threshold_warn !== null && value >= def.threshold_warn) {
    status = 'warning'
  }
  return { value, status, unit: def.unit }
}

// ─── In-memory live simulator ────────────────────────────────────────────────
// Avoids hammering Supabase with inserts every 2s (free-tier quota friendly).
// First call to getLatestReadings seeds state from DB; subsequent calls evolve
// values via mean-reversion + Gaussian noise, mirroring iot-mock.service.ts.
interface LiveCell {
  current_value: number
  ts: string
}
const liveState = new Map<string, Map<string, LiveCell>>()
const sensorDefCache = new Map<string, SensorDefinition[]>()

const gauss = (): number => {
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

const physicalToRaw = (value: number, def: SensorDefinition): number => {
  const span = def.physical_max - def.physical_min
  if (span === 0) return def.raw_min
  const ratio = (value - def.physical_min) / span
  return def.raw_min + ratio * (def.raw_max - def.raw_min)
}

const round = (n: number, digits: number) => {
  const m = Math.pow(10, digits)
  return Math.round(n * m) / m
}

const seedStateFromDb = async (
  tag: string,
  equipmentId: number,
  sensors: SensorDefinition[],
): Promise<Map<string, LiveCell>> => {
  const { data } = await supabase
    .from('latest_sensor_readings')
    .select('sensor_key, value, ts')
    .eq('equipment_id', equipmentId)

  const state = new Map<string, LiveCell>()
  const seedByKey = new Map<string, { value: number; ts: string }>()
  for (const r of data ?? []) {
    seedByKey.set(r.sensor_key as string, {
      value: r.value as number,
      ts: r.ts as string,
    })
  }

  for (const def of sensors) {
    const seed = seedByKey.get(def.sensor_key)
    state.set(def.sensor_key, {
      current_value: seed?.value ?? def.nominal_value ?? def.physical_min,
      ts: seed?.ts ?? new Date().toISOString(),
    })
  }
  liveState.set(tag, state)
  return state
}

const tickAndBuildReadings = (
  equipmentId: number,
  sensors: SensorDefinition[],
  state: Map<string, LiveCell>,
): SensorReading[] => {
  const readings: SensorReading[] = []
  const ts = new Date().toISOString()

  for (const def of sensors) {
    const cell = state.get(def.sensor_key)!
    const baseline = def.nominal_value ?? def.physical_min
    const range = def.physical_max - def.physical_min
    const noise = gauss() * range * 0.005
    const meanReversion = (baseline - cell.current_value) * 0.05
    cell.current_value += meanReversion + noise
    cell.ts = ts

    const rawMa = Math.max(
      0,
      Math.min(physicalToRaw(cell.current_value, def) + gauss() * 0.05, def.raw_max + 1),
    )
    const conv = convertRawToPhysical(rawMa, def)
    readings.push({
      id: 0, // synthetic — never persisted
      equipment_id: equipmentId,
      sensor_key: def.sensor_key,
      ts,
      value_raw: round(rawMa, 3),
      value: round(conv.value, 3),
      unit: conv.unit,
      status: conv.status,
      is_simulated: 1,
    })
  }
  return readings
}

export const digitalTwinAPI = {
  async listEquipments(): Promise<Equipment[]> {
    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .order('tag')
    if (error) throw error
    return (data ?? []) as Equipment[]
  },

  async getEquipment(
    tag: string,
  ): Promise<{ equipment: Equipment; sensors: SensorDefinition[] }> {
    const { data: equipment, error: eqErr } = await supabase
      .from('equipments')
      .select('*')
      .eq('tag', tag)
      .maybeSingle()
    if (eqErr) throw eqErr
    if (!equipment) throw new Error(`Equipamento ${tag} não encontrado`)

    const { data: sensors, error: sErr } = await supabase
      .from('sensor_definitions')
      .select('*')
      .eq('equipment_id', equipment.id)
      .order('id')
    if (sErr) throw sErr

    const list = (sensors ?? []) as SensorDefinition[]
    sensorDefCache.set(tag, list)
    return { equipment: equipment as Equipment, sensors: list }
  },

  async createEquipment(payload: Partial<Equipment>): Promise<Equipment> {
    if (!payload.tag || !payload.name) {
      throw new Error('tag e name são obrigatórios')
    }
    const { data, error } = await supabase
      .from('equipments')
      .insert(payload)
      .select()
      .single()
    if (error) {
      if (error.code === '23505') throw new Error('TAG já cadastrada')
      throw error
    }
    return data as Equipment
  },

  async getLatestReadings(
    tag: string,
  ): Promise<{ readings: SensorReading[]; ts: string }> {
    const equipmentId = await findEquipmentIdByTag(tag)
    let sensors = sensorDefCache.get(tag)
    if (!sensors) {
      sensors = await digitalTwinAPI.getSensorDefinitions(tag)
    }
    let state = liveState.get(tag)
    if (!state) {
      state = await seedStateFromDb(tag, equipmentId, sensors)
    }
    const readings = tickAndBuildReadings(equipmentId, sensors, state)
    return { readings, ts: new Date().toISOString() }
  },

  async getReadings(params: {
    tag: string
    sensor_key?: string
    from?: string
    to?: string
    limit?: number
  }): Promise<SensorReading[]> {
    const equipmentId = await findEquipmentIdByTag(params.tag)
    const limit = Math.min(params.limit ?? 500, 5000)

    let query = supabase
      .from('sensor_readings')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('ts', { ascending: false })
      .limit(limit)

    if (params.sensor_key) query = query.eq('sensor_key', params.sensor_key)
    if (params.from) query = query.gte('ts', params.from)
    if (params.to) query = query.lte('ts', params.to)

    const { data, error } = await query
    if (error) throw error
    // Express returned reverse() (chronological); preserve that contract.
    return ((data ?? []) as SensorReading[]).slice().reverse()
  },

  async getSensorDefinitions(tag: string): Promise<SensorDefinition[]> {
    const cached = sensorDefCache.get(tag)
    if (cached) return cached
    const equipmentId = await findEquipmentIdByTag(tag)
    const { data, error } = await supabase
      .from('sensor_definitions')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('id')
    if (error) throw error
    const list = (data ?? []) as SensorDefinition[]
    sensorDefCache.set(tag, list)
    return list
  },

  async getPlacaFields(): Promise<PlacaField[]> {
    const { data, error } = await supabase
      .from('placa_fields')
      .select('*')
      .order('ocr_priority')
      .order('category')
      .order('id')
    if (error) throw error
    return (data ?? []) as PlacaField[]
  },

  async ingestReading(payload: {
    tag: string
    sensor_key: string
    value_raw: number
    ts?: string
  }): Promise<SensorReading> {
    const equipmentId = await findEquipmentIdByTag(payload.tag)

    const { data: def, error: defErr } = await supabase
      .from('sensor_definitions')
      .select('*')
      .eq('equipment_id', equipmentId)
      .eq('sensor_key', payload.sensor_key)
      .maybeSingle()
    if (defErr) throw defErr
    if (!def) {
      throw new Error(
        `Sensor ${payload.sensor_key} não definido para este ativo`,
      )
    }

    const conv = convertRawToPhysical(payload.value_raw, def as SensorDefinition)
    const { data, error } = await supabase
      .from('sensor_readings')
      .insert({
        equipment_id: equipmentId,
        sensor_key: payload.sensor_key,
        value_raw: payload.value_raw,
        value: conv.value,
        unit: conv.unit,
        status: conv.status,
        ts: payload.ts ?? new Date().toISOString(),
        is_simulated: 1,
      })
      .select()
      .single()
    if (error) throw error
    return data as SensorReading
  },
}
