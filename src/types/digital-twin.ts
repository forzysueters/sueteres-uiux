/**
 * Sprint 1 — tipos do domínio Digital Twin.
 * Espelham o schema do backend em server/src/db/schema.sql
 */

export interface Equipment {
  id: number
  tag: string
  name: string
  location: string | null
  status: 'normal' | 'warning' | 'critical' | 'offline'
  created_at: string
  updated_at: string

  // identificação
  fabricante: string | null
  codigo_fabricante: string | null
  modelo: string | null
  linha: string | null
  categoria: string | null
  norma: string | null

  // elétricos
  tensao_nominal: string | null
  corrente_nominal: string | null
  corrente_partida: string | null
  corrente_vazio: string | null
  ip_in: number | null
  conjugado_nominal_kgfm: number | null
  conjugado_partida_pct: number | null
  conjugado_maximo_pct: number | null
  tempo_rotor_bloq_frio_s: number | null
  tempo_rotor_bloq_quente_s: number | null
  metodo_partida: string | null
  frequencia_hz: number | null
  numero_polos: number | null

  // mecânicos
  carcaca: string | null
  potencia_kw: number | null
  potencia_cv: number | null
  rotacao_sincrona_rpm: number | null
  rotacao_nominal_rpm: number | null
  escorregamento_pct: number | null
  forma_construtiva: string | null
  fixacao: string | null
  flange: string | null
  caixa_ligacao_posicao: string | null
  refrigeracao: string | null
  grau_protecao: string | null
  sentido_rotacao: string | null
  massa_kg: number | null
  nivel_ruido_dba: number | null

  // térmicos
  classe_isolamento: string | null
  elevacao_temperatura_k: number | null
  regime_servico: string | null
  temperatura_ambiente_min_c: number | null
  temperatura_ambiente_max_c: number | null
  altitude_max_m: number | null

  // mancal
  mancal_dianteiro_tipo: string | null
  mancal_traseiro_tipo: string | null
  vedacao_dianteiro: string | null
  vedacao_traseiro: string | null
  carga_axial_kgf: number | null

  // construtivos
  material_carcaca: string | null
  material_eixo: string | null
  material_ventilador: string | null
  pintura: string | null
  tipo_aterramento: string | null
  capacitor: string | null
  sistema_partida: string | null
  vedacao: string | null

  // manutenção
  ultima_manutencao: string | null
  proxima_manutencao: string | null
  fator_servico: number | null
}

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
  created_at: string
}

export type SensorStatus = 'normal' | 'warning' | 'critical' | 'offline'

export interface SensorReading {
  id: number
  equipment_id: number
  sensor_key: string
  ts: string
  value_raw: number
  value: number
  unit: string
  status: SensorStatus
  is_simulated: number
}

export interface PlacaField {
  id: number
  field_key: string
  display_name: string
  category: 'identificacao' | 'eletrico' | 'mecanico' | 'termico'
  data_type: 'string' | 'number' | 'enum'
  unit: string | null
  regex_hint: string | null
  example: string | null
  required: number
  ocr_priority: number
  notes: string | null
}
