/**
 * Conversão raw → unidades físicas e classificação de status.
 *
 * Padrão industrial: sensores 4-20 mA. A faixa 0-4 mA é reservada para
 * detecção de falha (cabo rompido, sensor desconectado).
 *
 *   raw = 4 mA  → physical_min
 *   raw = 20 mA → physical_max
 *   raw < 4 mA  → sensor offline
 *
 * Conversão linear (regra de 3):
 *   value = physical_min + ((raw - 4) / 16) * (physical_max - physical_min)
 */
import { db } from '../db/connection.js'

export type SensorStatus = 'normal' | 'warning' | 'critical' | 'offline'

export interface SensorDefinition {
  id: number
  equipment_id: number
  sensor_key: string
  display_name: string
  unit: string
  raw_unit: string
  raw_min: number
  raw_max: number
  physical_min: number
  physical_max: number
  nominal_value: number | null
  threshold_warn: number | null
  threshold_crit: number | null
}

export interface ConversionResult {
  value: number
  status: SensorStatus
  unit: string
  display_name: string
}

export const RAW_OFFLINE_THRESHOLD = 3.5 // abaixo disso, sensor é considerado desconectado

export function convertRawToPhysical(
  raw_mA: number,
  def: SensorDefinition,
): ConversionResult {
  if (raw_mA < RAW_OFFLINE_THRESHOLD) {
    return {
      value: 0,
      status: 'offline',
      unit: def.unit,
      display_name: def.display_name,
    }
  }

  const clampedRaw = Math.min(Math.max(raw_mA, def.raw_min), def.raw_max)
  const span = def.raw_max - def.raw_min
  const ratio = (clampedRaw - def.raw_min) / span
  const value =
    def.physical_min + ratio * (def.physical_max - def.physical_min)

  const status = classifyStatus(value, def)
  return { value, status, unit: def.unit, display_name: def.display_name }
}

export function classifyStatus(
  value: number,
  def: SensorDefinition,
): SensorStatus {
  const warn = def.threshold_warn
  const crit = def.threshold_crit
  if (crit !== null && value >= crit) return 'critical'
  if (warn !== null && value >= warn) return 'warning'
  return 'normal'
}

export function getSensorDefinitions(equipmentId: number): SensorDefinition[] {
  return db
    .prepare(
      'SELECT * FROM sensor_definition WHERE equipment_id = ? ORDER BY id',
    )
    .all(equipmentId) as SensorDefinition[]
}

export function getSensorDefinition(
  equipmentId: number,
  sensorKey: string,
): SensorDefinition | null {
  return (db
    .prepare(
      'SELECT * FROM sensor_definition WHERE equipment_id = ? AND sensor_key = ?',
    )
    .get(equipmentId, sensorKey) as SensorDefinition | undefined) ?? null
}

export function persistReading(input: {
  equipment_id: number
  sensor_key: string
  value_raw: number
  value: number
  unit: string
  status: SensorStatus
  ts?: string
  is_simulated?: boolean
}): void {
  db.prepare(
    `INSERT INTO sensor_reading
      (equipment_id, sensor_key, value_raw, value, unit, status, ts, is_simulated)
     VALUES
      (@equipment_id, @sensor_key, @value_raw, @value, @unit, @status,
       COALESCE(@ts, datetime('now')), @is_simulated)`,
  ).run({
    ...input,
    ts: input.ts ?? null,
    is_simulated: input.is_simulated === false ? 0 : 1,
  })
}
