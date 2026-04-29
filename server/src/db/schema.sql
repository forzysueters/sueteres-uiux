-- ─────────────────────────────────────────────────────────────────────────────
--  Sprint 1 — Fundamentos do Ativo e da Base de Dados (Forzy / Promon)
--  Schema SQLite para Digital Twin de motores elétricos industriais
-- ─────────────────────────────────────────────────────────────────────────────

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ EQUIPMENT — Cadastro técnico do ativo (campos derivados do datasheet)   │
-- │                                                                         │
-- │ Modelo de referência: WEG W22 3 cv 2P 100L 1F 110-127/220-254V          │
-- │ (https://www.weg.net/.../p/13887610)                                    │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS equipment (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tag             TEXT NOT NULL UNIQUE,           -- "MTR-001"
  name            TEXT NOT NULL,                  -- "Motor Principal Linha 1"
  location        TEXT,                           -- "Hall A - Estação 1"
  status          TEXT NOT NULL DEFAULT 'normal', -- normal | warning | critical | offline
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

  -- ── Identificação ──
  fabricante              TEXT,        -- WEG
  codigo_fabricante       TEXT,        -- 13887610
  modelo                  TEXT,        -- W22 3 cv 2P 100L 1F ...
  linha                   TEXT,        -- W22 (IP55)
  categoria               TEXT,        -- Monofásico Uso Geral
  norma                   TEXT,        -- ABNT NBR 17094

  -- ── Elétricos ──
  tensao_nominal          TEXT,        -- "110-127/220-254 V"
  corrente_nominal        TEXT,        -- "25.0-21.7/12.5-10.8 A"
  corrente_partida        TEXT,
  corrente_vazio          TEXT,
  ip_in                   REAL,        -- 8.7
  conjugado_nominal_kgfm  REAL,        -- 0.608
  conjugado_partida_pct   REAL,        -- 229
  conjugado_maximo_pct    REAL,        -- 300
  tempo_rotor_bloq_frio_s INTEGER,
  tempo_rotor_bloq_quente_s INTEGER,
  metodo_partida          TEXT,        -- Partida direta
  frequencia_hz           INTEGER,     -- 60
  numero_polos            INTEGER,     -- 2

  -- ── Mecânicos ──
  carcaca                 TEXT,        -- 100L
  potencia_kw             REAL,        -- 2.2
  potencia_cv             REAL,        -- 3
  rotacao_sincrona_rpm    INTEGER,     -- 3600
  rotacao_nominal_rpm     INTEGER,     -- 3525
  escorregamento_pct      REAL,        -- 2.08
  forma_construtiva       TEXT,        -- B3D
  fixacao                 TEXT,        -- Com pés
  flange                  TEXT,        -- Sem
  caixa_ligacao_posicao   TEXT,        -- Posição esquerda
  refrigeracao            TEXT,        -- IC411 - TFVE
  grau_protecao           TEXT,        -- IP55
  sentido_rotacao         TEXT,        -- Ambos
  massa_kg                REAL,        -- 38.6
  nivel_ruido_dba         REAL,        -- 72.0

  -- ── Térmicos / ambientais ──
  classe_isolamento           TEXT,    -- F
  elevacao_temperatura_k      REAL,    -- 105
  regime_servico              TEXT,    -- S1
  temperatura_ambiente_min_c  INTEGER, -- -20
  temperatura_ambiente_max_c  INTEGER, -- 40
  altitude_max_m              INTEGER, -- 1000

  -- ── Mancal / rolamento ──
  mancal_dianteiro_tipo   TEXT,        -- 6206 ZZ
  mancal_traseiro_tipo    TEXT,
  vedacao_dianteiro       TEXT,        -- V'Ring
  vedacao_traseiro        TEXT,
  carga_axial_kgf         REAL,

  -- ── Construtivos ──
  material_carcaca        TEXT,        -- Ferro fundido FC-200
  material_eixo           TEXT,        -- Aço carbono SAE 1040/45
  material_ventilador     TEXT,
  pintura                 TEXT,
  tipo_aterramento        TEXT,
  capacitor               TEXT,
  sistema_partida         TEXT,
  vedacao                 TEXT,

  -- ── Manutenção ──
  ultima_manutencao       TEXT,
  proxima_manutencao      TEXT,
  fator_servico           REAL
);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ SENSOR_DEFINITION — Calibração 4-20 mA → unidade física                 │
-- │                                                                         │
-- │ Cada sensor de cada equipamento tem range raw (mA) e range físico       │
-- │ (V, A, °C, RPM, mm/s) para conversão por regra de 3.                    │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS sensor_definition (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id    INTEGER NOT NULL,
  sensor_key      TEXT NOT NULL,        -- voltage | current | temperature | rpm | vibration
  display_name    TEXT NOT NULL,        -- "Tensão"
  unit            TEXT NOT NULL,        -- V, A, °C, RPM, mm/s
  raw_unit        TEXT NOT NULL DEFAULT 'mA',
  raw_min         REAL NOT NULL DEFAULT 4.0,
  raw_max         REAL NOT NULL DEFAULT 20.0,
  physical_min    REAL NOT NULL,        -- valor físico em raw_min
  physical_max    REAL NOT NULL,        -- valor físico em raw_max
  nominal_value   REAL,                 -- valor esperado em operação normal
  threshold_warn  REAL,                 -- limite de atenção
  threshold_crit  REAL,                 -- limite crítico
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  UNIQUE (equipment_id, sensor_key)
);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ SENSOR_READING — Histórico operacional (séries temporais)               │
-- │                                                                         │
-- │ Armazena raw + valor convertido para auditoria total da pipeline.       │
-- │ Equivalente a TimescaleDB, mas em SQLite. Particionamento por data via  │
-- │ índice composto.                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS sensor_reading (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id    INTEGER NOT NULL,
  sensor_key      TEXT NOT NULL,
  ts              TEXT NOT NULL DEFAULT (datetime('now')),  -- ISO 8601
  value_raw       REAL NOT NULL,        -- raw em mA
  value           REAL NOT NULL,        -- valor convertido
  unit            TEXT NOT NULL,
  status          TEXT NOT NULL,        -- normal | warning | critical | offline
  is_simulated    INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_eq_ts
  ON sensor_reading (equipment_id, sensor_key, ts DESC);

CREATE INDEX IF NOT EXISTS idx_reading_ts
  ON sensor_reading (ts DESC);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PLACA_FIELD — Definição dos campos que o OCR (Sprint 2/3) extrairá      │
-- │                                                                         │
-- │ Lista taxonômica dos campos visíveis em placas de motor, com regex      │
-- │ padrão de validação e exemplos. Alimenta a interface de cadastro e a    │
-- │ pipeline de OCR/LLM.                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS placa_field (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  field_key       TEXT NOT NULL UNIQUE,  -- "tensao_nominal"
  display_name    TEXT NOT NULL,         -- "Tensão Nominal"
  category        TEXT NOT NULL,         -- identificacao | eletrico | mecanico | termico
  data_type       TEXT NOT NULL,         -- string | number | enum
  unit            TEXT,                  -- V, A, kW, etc
  regex_hint      TEXT,                  -- padrão típico para extração
  example         TEXT,                  -- exemplo do W22
  required        INTEGER NOT NULL DEFAULT 0,
  ocr_priority    INTEGER NOT NULL DEFAULT 1, -- 1=alta, 2=média, 3=baixa
  notes           TEXT
);

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ EQUIPMENT_DOCUMENT — Anexos ao ativo (manuais, fotos da placa)          │
-- │                                                                         │
-- │ Pré-estrutura para Sprint 2 (RAG) e Sprint 3 (OCR).                     │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS equipment_document (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id    INTEGER NOT NULL,
  doc_type        TEXT NOT NULL,         -- placa_foto | manual | datasheet | procedimento
  title           TEXT NOT NULL,
  source_url      TEXT,
  language        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);
