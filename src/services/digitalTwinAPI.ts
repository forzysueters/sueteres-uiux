import axios from 'axios'
import {
  Equipment,
  PlacaField,
  SensorDefinition,
  SensorReading,
} from '../types/digital-twin'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const digitalTwinAPI = {
  async listEquipments(): Promise<Equipment[]> {
    const r = await client.get<{ equipments: Equipment[] }>('/api/equipments')
    return r.data.equipments
  },

  async getEquipment(
    tag: string,
  ): Promise<{ equipment: Equipment; sensors: SensorDefinition[] }> {
    const r = await client.get<{
      equipment: Equipment
      sensors: SensorDefinition[]
    }>(`/api/equipments/${tag}`)
    return r.data
  },

  async createEquipment(payload: Partial<Equipment>): Promise<Equipment> {
    const r = await client.post('/api/equipments', payload)
    return r.data
  },

  async getLatestReadings(
    tag: string,
  ): Promise<{ readings: SensorReading[]; ts: string }> {
    const r = await client.get<{ readings: SensorReading[]; ts: string }>(
      `/api/equipments/${tag}/latest`,
    )
    return r.data
  },

  async getReadings(params: {
    tag: string
    sensor_key?: string
    from?: string
    to?: string
    limit?: number
  }): Promise<SensorReading[]> {
    const { tag, ...query } = params
    const r = await client.get<{ readings: SensorReading[] }>(
      `/api/equipments/${tag}/readings`,
      { params: query },
    )
    return r.data.readings
  },

  async getSensorDefinitions(tag: string): Promise<SensorDefinition[]> {
    const r = await client.get<{ sensors: SensorDefinition[] }>(
      `/api/equipments/${tag}/sensors`,
    )
    return r.data.sensors
  },

  async getPlacaFields(): Promise<PlacaField[]> {
    const r = await client.get<{ fields: PlacaField[] }>(
      '/api/equipments/placa/fields',
    )
    return r.data.fields
  },

  async ingestReading(payload: {
    tag: string
    sensor_key: string
    value_raw: number
    ts?: string
  }): Promise<SensorReading> {
    const { tag, ...body } = payload
    const r = await client.post(`/api/equipments/${tag}/readings`, body)
    return r.data
  },
}
