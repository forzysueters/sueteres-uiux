// ─── Sensor ────────────────────────────────────────────────────────────────
export interface Sensor {
  id: string;
  name: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface SensorHistory {
  timestamp: string;
  value: number;
}

export interface SensorHistorySeries {
  sensorName: string;
  unit: string;
  color: string;
  data: SensorHistory[];
}

// ─── Motor Nameplate (dados da placa de identificação — Sprint 2 OCR) ──────
export interface MotorNameplate {
  tag: string;            // ex: MTR-001
  manufacturer: string;
  model: string;
  serialNumber: string;
  power_kw: number;       // kW
  power_cv: number;       // CV/HP
  voltage: string;        // ex: "380/660V"
  current_a: number;      // A (corrente nominal)
  rpm: number;
  poles: number;
  connection: string;     // "Delta" | "Star" | "Delta/Star"
  frequency_hz: number;   // 50 | 60
  ip_class: string;       // ex: "IP55"
  insulation_class: string; // ex: "F"
  yearManufactured: number;
  registeredAt: string;
  imageUrl?: string;
  ocrConfidence?: number; // 0-100% — taxa de acerto do OCR
  /**
   * Origem dos valores. 'manual' quando alguém corrigiu a placa à mão: aí a
   * confiança do OCR deixa de descrever o que está na tela e não deve ser
   * exibida como se fosse a acurácia do modelo.
   */
  source?: 'ocr' | 'manual';
}

// ─── Asset ─────────────────────────────────────────────────────────────────
export interface Asset {
  id: string;
  tag: string;            // TAG industrial: MTR-001, BBA-001, etc.
  name: string;
  type: 'motor' | 'pump' | 'compressor' | 'fan';
  area: string;           // ex: "Hall A"
  /** FK da área. Necessária para mover o ativo de hall sem casar nome por string. */
  areaId: string | null;
  location: string;       // ex: "Hall A — Posto 1"
  status: 'normal' | 'warning' | 'critical' | 'offline';
  uptime: number;
  sensors: Sensor[];
  lastMaintenance: string;
  nextMaintenance: string;
  imageUrl?: string;
  x: number;             // posição na grade (grid view)
  y: number;
  plantX: number;        // posição % horizontal no mapa SVG (0-100)
  plantY: number;        // posição % vertical no mapa SVG (0-100)
  anomalyScore: number;  // 0-100 (derivado: 100 - healthIndex quando pontuado pelo modelo)
  // ─── Diagnóstico do modelo de anomalia (Sprint 2 — pasta anomaly/) ────────
  healthIndex?: number;   // 0-100, maior = mais saudável (saída real do modelo)
  severity?: 'ok' | 'info' | 'alerta' | 'critico';
  insight?: string;       // texto de insight preditivo vindo do modelo
  thermalResidual?: number | null; // resíduo térmico atual (°C), se houver
  nameplate?: MotorNameplate; // dados extraídos via OCR da placa
}

// ─── Alert ─────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  mlInsight?: string;
}

// ─── Manutenção ─────────────────────────────────────────────────────────────
/** Espelha public.maintenance_type do banco. */
export type MaintenanceType =
  | 'preventive' | 'corrective' | 'predictive' | 'calibration' | 'inspection';

/** Espelha public.criticality_level, usado como prioridade da OM. */
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Technician {
  id: string;
  name: string;
  role: 'technician' | 'engineer';
  jobTitle: string | null;
}

export interface NewMaintenanceOrder {
  assetId: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  title: string;
  description: string;
  scheduledFor: string;   // ISO
  assignedTo: string;     // profiles.id
}

// ─── Cadastro de ativo (wizard de OCR) ──────────────────────────────────────

/**
 * Ativo desativado (`is_active = false`).
 *
 * Não vem de `v_assets_full` — a view filtra por `is_active`, então ativo
 * desativado é invisível para todo o resto da aplicação. Esta forma reduzida é
 * lida direto de `assets` só para a tela de reativação.
 */
export interface InactiveAsset {
  id: string;
  tag: string;
  name: string;
  type: Asset['type'];
  location: string;
  area: string;
  deactivatedAt: string;
}

/** Área da planta — alimenta o seletor do passo "Destino". */
export interface Area {
  id: string;
  code: string;      // HALL-A
  name: string;      // Hall A
  plantId: string;
}

/**
 * Ativo criado a partir da placa lida pelo OCR.
 *
 * Nasce sem sensores: telemetria, alertas e score de anomalia só existem para
 * ativos instrumentados, e alertas derivam de leituras — nunca são escritos à
 * mão. A UI avisa disso no cadastro e na página do ativo.
 */
export interface NewAssetInput {
  tag: string;
  name: string;
  type: Asset['type'];
  areaId: string;
  plantId: string;
  location: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  /** Posição % no mapa da planta (0-100), escolhida no mini-mapa. */
  plantX: number;
  plantY: number;
}

// ─── Chat ──────────────────────────────────────────────────────────────────
export interface ChatCitation {
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  assetContext?: string;
  citations?: ChatCitation[];
  /** true quando a resposta veio do motor determinístico local (LLM indisponível). */
  offline?: boolean;
}

// ─── KPI ───────────────────────────────────────────────────────────────────
export interface KPIMetrics {
  totalUptime: number;
  activeAlerts: number;
  anomaliesDetected: number;
  assetsOnline: number;
  totalAssets: number;
  predictedFailures: number;
}
