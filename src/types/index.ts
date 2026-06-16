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
}

// ─── Asset ─────────────────────────────────────────────────────────────────
export interface Asset {
  id: string;
  tag: string;            // TAG industrial: MTR-001, BBA-001, etc.
  name: string;
  type: 'motor' | 'pump' | 'compressor' | 'fan';
  area: string;           // ex: "Hall A"
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
  anomalyScore: number;  // 0-100
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

// ─── Equipment Registration ─────────────────────────────────────────────────
export interface EquipmentRegistration {
  id: string;
  assetId: string;
  tag: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  yearManufactured: number;
  powerRating: number;
  imageUrl?: string;
  registeredAt: string;
}

// ─── Chat ──────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  assetContext?: string;
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
