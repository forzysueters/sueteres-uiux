import { Router, Request, Response } from 'express'
import { db } from '../db/connection.js'
import {
  convertRawToPhysical,
  getSensorDefinition,
  getSensorDefinitions,
  persistReading,
} from '../services/sensor.service.js'

const router = Router()

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/equipments
//  Lista todos os equipamentos com status agregado.
// ─────────────────────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT * FROM equipment ORDER BY tag`,
    )
    .all()
  res.json({ equipments: rows })
})

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/equipments/:tag
//  Retorna o cadastro técnico completo + sensores definidos.
// ─────────────────────────────────────────────────────────────────────────
router.get('/:tag', (req: Request, res: Response) => {
  const { tag } = req.params
  const equipment = db
    .prepare(`SELECT * FROM equipment WHERE tag = ?`)
    .get(tag) as { id: number } | undefined
  if (!equipment) {
    return res.status(404).json({ error: 'Equipamento não encontrado' })
  }
  const sensors = getSensorDefinitions(equipment.id)
  return res.json({ equipment, sensors })
})

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/equipments
//  Cadastra um novo equipamento. (Sprint 1: cadastro técnico manual)
// ─────────────────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const body = req.body ?? {}
  if (!body.tag || !body.name) {
    return res.status(400).json({ error: 'tag e name são obrigatórios' })
  }
  const exists = db.prepare('SELECT id FROM equipment WHERE tag = ?').get(body.tag)
  if (exists) {
    return res.status(409).json({ error: 'TAG já cadastrada' })
  }

  const allowedColumns = [
    'tag', 'name', 'location', 'status',
    'fabricante', 'codigo_fabricante', 'modelo', 'linha', 'categoria', 'norma',
    'tensao_nominal', 'corrente_nominal', 'corrente_partida', 'corrente_vazio',
    'ip_in', 'conjugado_nominal_kgfm', 'conjugado_partida_pct', 'conjugado_maximo_pct',
    'tempo_rotor_bloq_frio_s', 'tempo_rotor_bloq_quente_s', 'metodo_partida',
    'frequencia_hz', 'numero_polos',
    'carcaca', 'potencia_kw', 'potencia_cv', 'rotacao_sincrona_rpm',
    'rotacao_nominal_rpm', 'escorregamento_pct', 'forma_construtiva', 'fixacao',
    'flange', 'caixa_ligacao_posicao', 'refrigeracao', 'grau_protecao',
    'sentido_rotacao', 'massa_kg', 'nivel_ruido_dba',
    'classe_isolamento', 'elevacao_temperatura_k', 'regime_servico',
    'temperatura_ambiente_min_c', 'temperatura_ambiente_max_c', 'altitude_max_m',
    'mancal_dianteiro_tipo', 'mancal_traseiro_tipo', 'vedacao_dianteiro',
    'vedacao_traseiro', 'carga_axial_kgf',
    'material_carcaca', 'material_eixo', 'material_ventilador', 'pintura',
    'tipo_aterramento', 'capacitor', 'sistema_partida', 'vedacao',
    'ultima_manutencao', 'proxima_manutencao', 'fator_servico',
  ] as const

  const cols: string[] = []
  const values: any = {}
  for (const c of allowedColumns) {
    if (c in body) {
      cols.push(c)
      values[c] = body[c]
    }
  }

  const placeholders = cols.map((c) => `@${c}`).join(', ')
  const result = db
    .prepare(`INSERT INTO equipment (${cols.join(', ')}) VALUES (${placeholders})`)
    .run(values)

  return res
    .status(201)
    .json({ id: result.lastInsertRowid, tag: body.tag })
})

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/equipments/:tag/sensors
//  Lista calibração e thresholds dos sensores do ativo.
// ─────────────────────────────────────────────────────────────────────────
router.get('/:tag/sensors', (req: Request, res: Response) => {
  const eq = db
    .prepare('SELECT id FROM equipment WHERE tag = ?')
    .get(req.params.tag) as { id: number } | undefined
  if (!eq) return res.status(404).json({ error: 'Equipamento não encontrado' })
  return res.json({ sensors: getSensorDefinitions(eq.id) })
})

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/equipments/:tag/latest
//  Última leitura por sensor (real-time).
// ─────────────────────────────────────────────────────────────────────────
router.get('/:tag/latest', (req: Request, res: Response) => {
  const eq = db
    .prepare('SELECT id FROM equipment WHERE tag = ?')
    .get(req.params.tag) as { id: number } | undefined
  if (!eq) return res.status(404).json({ error: 'Equipamento não encontrado' })

  const rows = db
    .prepare(
      `SELECT r.*
         FROM sensor_reading r
         JOIN (
           SELECT sensor_key, MAX(id) AS max_id
             FROM sensor_reading
            WHERE equipment_id = ?
            GROUP BY sensor_key
         ) g ON r.id = g.max_id
        ORDER BY r.sensor_key`,
    )
    .all(eq.id)

  return res.json({ readings: rows, ts: new Date().toISOString() })
})

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/equipments/:tag/readings
//  Histórico operacional. Filtros: sensor_key, from, to, limit
// ─────────────────────────────────────────────────────────────────────────
router.get('/:tag/readings', (req: Request, res: Response) => {
  const eq = db
    .prepare('SELECT id FROM equipment WHERE tag = ?')
    .get(req.params.tag) as { id: number } | undefined
  if (!eq) return res.status(404).json({ error: 'Equipamento não encontrado' })

  const sensorKey = req.query.sensor_key as string | undefined
  const from = req.query.from as string | undefined
  const to = req.query.to as string | undefined
  const limit = Math.min(parseInt((req.query.limit as string) || '500', 10), 5000)

  let sql =
    'SELECT * FROM sensor_reading WHERE equipment_id = ?'
  const params: any[] = [eq.id]

  if (sensorKey) {
    sql += ' AND sensor_key = ?'
    params.push(sensorKey)
  }
  if (from) {
    sql += ' AND ts >= ?'
    params.push(from)
  }
  if (to) {
    sql += ' AND ts <= ?'
    params.push(to)
  }
  sql += ' ORDER BY ts DESC LIMIT ?'
  params.push(limit)

  const rows = db.prepare(sql).all(...params)
  return res.json({ readings: rows.reverse(), count: rows.length })
})

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/equipments/:tag/readings
//  Ingestão de leituras raw (4-20 mA). Útil para integração com IoT real.
//  Faz a conversão raw → unidade física no servidor antes de persistir.
// ─────────────────────────────────────────────────────────────────────────
router.post('/:tag/readings', (req: Request, res: Response) => {
  const eq = db
    .prepare('SELECT id FROM equipment WHERE tag = ?')
    .get(req.params.tag) as { id: number } | undefined
  if (!eq) return res.status(404).json({ error: 'Equipamento não encontrado' })

  const body = req.body ?? {}
  const sensorKey = body.sensor_key
  const valueRaw = Number(body.value_raw)
  if (!sensorKey || Number.isNaN(valueRaw)) {
    return res
      .status(400)
      .json({ error: 'sensor_key e value_raw (number) são obrigatórios' })
  }

  const def = getSensorDefinition(eq.id, sensorKey)
  if (!def) {
    return res
      .status(404)
      .json({ error: `Sensor ${sensorKey} não definido para este ativo` })
  }

  const conv = convertRawToPhysical(valueRaw, def)
  persistReading({
    equipment_id: eq.id,
    sensor_key: sensorKey,
    value_raw: valueRaw,
    value: conv.value,
    unit: conv.unit,
    status: conv.status,
    ts: body.ts,
    is_simulated: !!body.is_simulated,
  })
  return res.status(201).json({
    sensor_key: sensorKey,
    value_raw: valueRaw,
    value: conv.value,
    unit: conv.unit,
    status: conv.status,
  })
})

// ─────────────────────────────────────────────────────────────────────────
//  GET /api/placa-fields
//  Definição taxonômica dos campos da placa que serão extraídos via OCR
//  na Sprint 2/3. Alimenta a UI de cadastro e o pipeline OCR/LLM.
// ─────────────────────────────────────────────────────────────────────────
router.get('/placa/fields', (_req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM placa_field ORDER BY ocr_priority, category, id')
    .all()
  res.json({ fields: rows })
})

export default router
