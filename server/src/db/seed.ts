/**
 * Seed do banco — popula o motor de referência (WEG W22) com TODOS os
 * campos extraídos do datasheet oficial, define seus 5 sensores com
 * calibração 4-20 mA → unidades físicas, e cadastra os campos da placa
 * que serão alvo do OCR (Sprint 2/3).
 *
 * Fonte: https://www.weg.net/catalog/weg/BR/pt/Motores-Elétricos/...p/13887610
 */
import { db } from './connection.js'

export function seedDatabase(): void {
  const txn = db.transaction(() => {
    seedEquipmentW22()
    seedPlacaFields()
  })
  txn()
  console.log('🌱 Seed concluído (motor MTR-001 + placa fields).')
}

function seedEquipmentW22(): void {
  const exists = db
    .prepare('SELECT id FROM equipment WHERE tag = ?')
    .get('MTR-001') as { id: number } | undefined

  let equipmentId: number

  if (exists) {
    equipmentId = exists.id
    console.log('  · MTR-001 já cadastrado (id=' + equipmentId + ')')
  } else {
    const result = db
      .prepare(
        `INSERT INTO equipment (
          tag, name, location, status,
          fabricante, codigo_fabricante, modelo, linha, categoria, norma,
          tensao_nominal, corrente_nominal, corrente_partida, corrente_vazio,
          ip_in, conjugado_nominal_kgfm, conjugado_partida_pct, conjugado_maximo_pct,
          tempo_rotor_bloq_frio_s, tempo_rotor_bloq_quente_s, metodo_partida,
          frequencia_hz, numero_polos,
          carcaca, potencia_kw, potencia_cv, rotacao_sincrona_rpm,
          rotacao_nominal_rpm, escorregamento_pct, forma_construtiva, fixacao,
          flange, caixa_ligacao_posicao, refrigeracao, grau_protecao,
          sentido_rotacao, massa_kg, nivel_ruido_dba,
          classe_isolamento, elevacao_temperatura_k, regime_servico,
          temperatura_ambiente_min_c, temperatura_ambiente_max_c, altitude_max_m,
          mancal_dianteiro_tipo, mancal_traseiro_tipo, vedacao_dianteiro,
          vedacao_traseiro, carga_axial_kgf,
          material_carcaca, material_eixo, material_ventilador, pintura,
          tipo_aterramento, capacitor, sistema_partida, vedacao,
          ultima_manutencao, proxima_manutencao
        ) VALUES (
          @tag, @name, @location, @status,
          @fabricante, @codigo_fabricante, @modelo, @linha, @categoria, @norma,
          @tensao_nominal, @corrente_nominal, @corrente_partida, @corrente_vazio,
          @ip_in, @conjugado_nominal_kgfm, @conjugado_partida_pct, @conjugado_maximo_pct,
          @tempo_rotor_bloq_frio_s, @tempo_rotor_bloq_quente_s, @metodo_partida,
          @frequencia_hz, @numero_polos,
          @carcaca, @potencia_kw, @potencia_cv, @rotacao_sincrona_rpm,
          @rotacao_nominal_rpm, @escorregamento_pct, @forma_construtiva, @fixacao,
          @flange, @caixa_ligacao_posicao, @refrigeracao, @grau_protecao,
          @sentido_rotacao, @massa_kg, @nivel_ruido_dba,
          @classe_isolamento, @elevacao_temperatura_k, @regime_servico,
          @temperatura_ambiente_min_c, @temperatura_ambiente_max_c, @altitude_max_m,
          @mancal_dianteiro_tipo, @mancal_traseiro_tipo, @vedacao_dianteiro,
          @vedacao_traseiro, @carga_axial_kgf,
          @material_carcaca, @material_eixo, @material_ventilador, @pintura,
          @tipo_aterramento, @capacitor, @sistema_partida, @vedacao,
          @ultima_manutencao, @proxima_manutencao
        )`,
      )
      .run({
        tag: 'MTR-001',
        name: 'Motor Principal — Linha 1',
        location: 'Forzy Lab — Bancada Principal',
        status: 'normal',

        fabricante: 'WEG',
        codigo_fabricante: '13887610',
        modelo: 'W22 3 cv 2P 100L 1F 110-127/220-254 V 60 Hz IC411 - TFVE - B3D',
        linha: 'W22 (IP55)',
        categoria: 'Monofásico — Uso Geral',
        norma: 'ABNT NBR 17094',

        tensao_nominal: '110-127/220-254 V',
        corrente_nominal: '25.0-21.7/12.5-10.8 A',
        corrente_partida: '217-188/109-94.2 A',
        corrente_vazio: '7.60-6.58/3.80-3.29 A',
        ip_in: 8.7,
        conjugado_nominal_kgfm: 0.608,
        conjugado_partida_pct: 229,
        conjugado_maximo_pct: 300,
        tempo_rotor_bloq_frio_s: 16,
        tempo_rotor_bloq_quente_s: 9,
        metodo_partida: 'Partida direta',
        frequencia_hz: 60,
        numero_polos: 2,

        carcaca: '100L',
        potencia_kw: 2.2,
        potencia_cv: 3,
        rotacao_sincrona_rpm: 3600,
        rotacao_nominal_rpm: 3525,
        escorregamento_pct: 2.08,
        forma_construtiva: 'B3D',
        fixacao: 'Com pés',
        flange: 'Sem',
        caixa_ligacao_posicao: 'Posição esquerda',
        refrigeracao: 'IC411 - TFVE',
        grau_protecao: 'IP55',
        sentido_rotacao: 'Ambos',
        massa_kg: 38.6,
        nivel_ruido_dba: 72.0,

        classe_isolamento: 'F',
        elevacao_temperatura_k: 105,
        regime_servico: 'S1',
        temperatura_ambiente_min_c: -20,
        temperatura_ambiente_max_c: 40,
        altitude_max_m: 1000,

        mancal_dianteiro_tipo: '6206 ZZ',
        mancal_traseiro_tipo: '6206 ZZ',
        vedacao_dianteiro: "V'Ring",
        vedacao_traseiro: "V'Ring",
        carga_axial_kgf: 26,

        material_carcaca: 'Ferro fundido FC-200 (EN GJL 200)',
        material_eixo: 'Aço carbono SAE 1040/45',
        material_ventilador: 'Plástico',
        pintura: 'RAL 5009 207A (ISO 12944 - C3)',
        tipo_aterramento: 'Único',
        capacitor: 'Partida + permanente',
        sistema_partida: 'Centrífugo',
        vedacao: "V'Ring (líquidos e poeira)",

        ultima_manutencao: '2026-02-15',
        proxima_manutencao: '2026-08-15',
      })

    equipmentId = result.lastInsertRowid as number
    console.log('  ✓ MTR-001 (WEG W22) cadastrado (id=' + equipmentId + ')')
  }

  // ── Sensores 4-20 mA ──
  // Range raw: 4 mA = mínimo válido | 20 mA = máximo do span
  // Range físico: derivado dos valores nominais do W22 com folga operacional
  const sensors = [
    {
      sensor_key: 'voltage',
      display_name: 'Tensão',
      unit: 'V',
      physical_min: 0,
      physical_max: 300,
      nominal_value: 220,
      threshold_warn: 240, // ±10% da nominal
      threshold_crit: 260,
    },
    {
      sensor_key: 'current',
      display_name: 'Corrente',
      unit: 'A',
      physical_min: 0,
      physical_max: 30,
      nominal_value: 12.5, // 220 V tap
      threshold_warn: 18,
      threshold_crit: 25, // corrente nominal máxima
    },
    {
      sensor_key: 'temperature',
      display_name: 'Temperatura do enrolamento',
      unit: '°C',
      physical_min: -20, // limite inferior conforme datasheet
      physical_max: 200,
      nominal_value: 75,
      threshold_warn: 130, // classe F = 155°C limite, alerta cedo
      threshold_crit: 155,
    },
    {
      sensor_key: 'rpm',
      display_name: 'Rotação',
      unit: 'RPM',
      physical_min: 0,
      physical_max: 4000,
      nominal_value: 3525,
      threshold_warn: 3700, // overspeed
      threshold_crit: 3800,
    },
    {
      sensor_key: 'vibration',
      display_name: 'Vibração',
      unit: 'mm/s',
      physical_min: 0,
      physical_max: 20,
      nominal_value: 1.8, // ISO 10816 zona A (boa)
      threshold_warn: 4.5, // zona C (insatisfatório)
      threshold_crit: 7.1, // zona D (inaceitável)
    },
  ]

  const insertSensor = db.prepare(
    `INSERT OR IGNORE INTO sensor_definition (
      equipment_id, sensor_key, display_name, unit,
      physical_min, physical_max, nominal_value, threshold_warn, threshold_crit
    ) VALUES (
      @equipment_id, @sensor_key, @display_name, @unit,
      @physical_min, @physical_max, @nominal_value, @threshold_warn, @threshold_crit
    )`,
  )

  for (const s of sensors) {
    insertSensor.run({ equipment_id: equipmentId, ...s })
  }
  console.log(`  ✓ ${sensors.length} sensores definidos (4-20 mA)`)
}

function seedPlacaFields(): void {
  const fields = [
    // ── Identificação (alta prioridade OCR) ──
    {
      field_key: 'fabricante',
      display_name: 'Fabricante',
      category: 'identificacao',
      data_type: 'string',
      unit: null,
      regex_hint: '^[A-Z]{2,}$',
      example: 'WEG',
      required: 1,
      ocr_priority: 1,
      notes: 'Logo + texto em destaque na placa',
    },
    {
      field_key: 'codigo_fabricante',
      display_name: 'Código do Fabricante',
      category: 'identificacao',
      data_type: 'string',
      unit: null,
      regex_hint: '\\d{6,10}',
      example: '13887610',
      required: 1,
      ocr_priority: 1,
      notes: 'Frequentemente acompanha "Cód." ou "P/N"',
    },
    {
      field_key: 'modelo',
      display_name: 'Modelo',
      category: 'identificacao',
      data_type: 'string',
      unit: null,
      regex_hint: 'W22|W21|W11',
      example: 'W22 3 cv 2P 100L 1F',
      required: 1,
      ocr_priority: 1,
      notes: 'Linha + potência + polos + carcaça + nº fases',
    },
    {
      field_key: 'norma',
      display_name: 'Norma',
      category: 'identificacao',
      data_type: 'string',
      unit: null,
      regex_hint: 'ABNT|IEC|NEMA',
      example: 'NBR 17094',
      required: 0,
      ocr_priority: 2,
      notes: null,
    },

    // ── Elétricos (alta prioridade) ──
    {
      field_key: 'tensao_nominal',
      display_name: 'Tensão Nominal',
      category: 'eletrico',
      data_type: 'string',
      unit: 'V',
      regex_hint: '\\d{3}([-/]\\d{3})*\\s*V',
      example: '110-127/220-254 V',
      required: 1,
      ocr_priority: 1,
      notes: 'Pode ter múltiplos taps (ligação série/paralelo)',
    },
    {
      field_key: 'corrente_nominal',
      display_name: 'Corrente Nominal',
      category: 'eletrico',
      data_type: 'string',
      unit: 'A',
      regex_hint: '\\d+(\\.\\d+)?[-/]\\d+(\\.\\d+)?\\s*A',
      example: '25.0-21.7/12.5-10.8 A',
      required: 1,
      ocr_priority: 1,
      notes: 'Múltiplos valores correspondendo aos taps',
    },
    {
      field_key: 'frequencia_hz',
      display_name: 'Frequência',
      category: 'eletrico',
      data_type: 'number',
      unit: 'Hz',
      regex_hint: '(50|60)\\s*Hz',
      example: '60',
      required: 1,
      ocr_priority: 1,
      notes: 'Geralmente 50 ou 60',
    },
    {
      field_key: 'numero_polos',
      display_name: 'Número de Polos',
      category: 'eletrico',
      data_type: 'number',
      unit: null,
      regex_hint: '\\dP\\b',
      example: '2',
      required: 1,
      ocr_priority: 1,
      notes: 'Indicado como "2P", "4P", etc.',
    },
    {
      field_key: 'fator_potencia',
      display_name: 'Fator de Potência',
      category: 'eletrico',
      data_type: 'number',
      unit: 'cos φ',
      regex_hint: '0\\.\\d{2}',
      example: '0.98',
      required: 0,
      ocr_priority: 2,
      notes: null,
    },
    {
      field_key: 'rendimento',
      display_name: 'Rendimento',
      category: 'eletrico',
      data_type: 'number',
      unit: '%',
      regex_hint: '\\d{2}\\.\\d',
      example: '81.8',
      required: 0,
      ocr_priority: 2,
      notes: null,
    },

    // ── Mecânicos (alta prioridade) ──
    {
      field_key: 'potencia_cv',
      display_name: 'Potência (cv)',
      category: 'mecanico',
      data_type: 'number',
      unit: 'cv',
      regex_hint: '\\d+(\\.\\d+)?\\s*(cv|HP)',
      example: '3',
      required: 1,
      ocr_priority: 1,
      notes: null,
    },
    {
      field_key: 'potencia_kw',
      display_name: 'Potência (kW)',
      category: 'mecanico',
      data_type: 'number',
      unit: 'kW',
      regex_hint: '\\d+(\\.\\d+)?\\s*kW',
      example: '2.2',
      required: 1,
      ocr_priority: 1,
      notes: null,
    },
    {
      field_key: 'rotacao_nominal_rpm',
      display_name: 'Rotação Nominal',
      category: 'mecanico',
      data_type: 'number',
      unit: 'RPM',
      regex_hint: '\\d{3,4}\\s*(RPM|rpm|r/min)',
      example: '3525',
      required: 1,
      ocr_priority: 1,
      notes: null,
    },
    {
      field_key: 'carcaca',
      display_name: 'Carcaça',
      category: 'mecanico',
      data_type: 'string',
      unit: null,
      regex_hint: '\\d{2,3}[A-Z]?',
      example: '100L',
      required: 1,
      ocr_priority: 1,
      notes: 'Tamanho normalizado IEC',
    },
    {
      field_key: 'forma_construtiva',
      display_name: 'Forma Construtiva',
      category: 'mecanico',
      data_type: 'string',
      unit: null,
      regex_hint: 'B3[A-Z]?|B5|B14|B35',
      example: 'B3D',
      required: 0,
      ocr_priority: 2,
      notes: null,
    },
    {
      field_key: 'massa_kg',
      display_name: 'Massa',
      category: 'mecanico',
      data_type: 'number',
      unit: 'kg',
      regex_hint: '\\d+(\\.\\d+)?\\s*kg',
      example: '38.6',
      required: 0,
      ocr_priority: 3,
      notes: null,
    },

    // ── Térmicos / proteção ──
    {
      field_key: 'grau_protecao',
      display_name: 'Grau de Proteção',
      category: 'termico',
      data_type: 'string',
      unit: null,
      regex_hint: 'IP\\d{2}',
      example: 'IP55',
      required: 1,
      ocr_priority: 1,
      notes: null,
    },
    {
      field_key: 'classe_isolamento',
      display_name: 'Classe de Isolamento',
      category: 'termico',
      data_type: 'string',
      unit: null,
      regex_hint: 'CL\\.|CLASSE\\s*[A-Z]|ISOL\\.',
      example: 'F',
      required: 1,
      ocr_priority: 1,
      notes: 'A=105°C, E=120°C, B=130°C, F=155°C, H=180°C',
    },
    {
      field_key: 'regime_servico',
      display_name: 'Regime de Serviço',
      category: 'termico',
      data_type: 'string',
      unit: null,
      regex_hint: 'S[1-9]|REG\\s*S',
      example: 'S1',
      required: 0,
      ocr_priority: 2,
      notes: 'S1=contínuo, S2=tempo limitado, etc.',
    },
    {
      field_key: 'fator_servico',
      display_name: 'Fator de Serviço',
      category: 'termico',
      data_type: 'number',
      unit: null,
      regex_hint: 'FS\\s*\\d\\.\\d{2}',
      example: '1.15',
      required: 0,
      ocr_priority: 2,
      notes: null,
    },
    {
      field_key: 'temperatura_ambiente_max_c',
      display_name: 'Temperatura Ambiente Máx.',
      category: 'termico',
      data_type: 'number',
      unit: '°C',
      regex_hint: 'AMB\\s*\\d{2}\\s*°?C',
      example: '40',
      required: 0,
      ocr_priority: 3,
      notes: null,
    },

    // ── Ligação / diagrama ──
    {
      field_key: 'diagrama_ligacao',
      display_name: 'Diagrama de Ligação',
      category: 'eletrico',
      data_type: 'string',
      unit: null,
      regex_hint: null,
      example: 'Ligação série/paralelo (placa apresenta diagrama gráfico)',
      required: 0,
      ocr_priority: 2,
      notes: 'Visão computacional + LLM multimodal — extrair conexões T1..T8',
    },

    // ── Mancal ──
    {
      field_key: 'rolamento_de',
      display_name: 'Rolamento Dianteiro (DE)',
      category: 'mecanico',
      data_type: 'string',
      unit: null,
      regex_hint: '\\d{4}\\s*(2Z|ZZ|RS|2RS|C3)',
      example: '6206 ZZ',
      required: 0,
      ocr_priority: 2,
      notes: null,
    },
    {
      field_key: 'rolamento_nde',
      display_name: 'Rolamento Traseiro (NDE)',
      category: 'mecanico',
      data_type: 'string',
      unit: null,
      regex_hint: '\\d{4}\\s*(2Z|ZZ|RS|2RS|C3)',
      example: '6206 ZZ',
      required: 0,
      ocr_priority: 2,
      notes: null,
    },
  ]

  const insert = db.prepare(
    `INSERT OR IGNORE INTO placa_field (
      field_key, display_name, category, data_type, unit,
      regex_hint, example, required, ocr_priority, notes
    ) VALUES (
      @field_key, @display_name, @category, @data_type, @unit,
      @regex_hint, @example, @required, @ocr_priority, @notes
    )`,
  )

  for (const f of fields) insert.run(f)
  console.log(`  ✓ ${fields.length} campos da placa cadastrados (alvo OCR)`)
}
