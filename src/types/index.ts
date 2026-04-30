// Asset Types
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

export interface Asset {
  id: string;
  name: string;
  type: 'motor' | 'pump' | 'compressor' | 'fan';
  location: string;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  uptime: number; // percentage
  sensors: Sensor[];
  lastMaintenance: string;
  nextMaintenance: string;
  imageUrl?: string;
  x: number; // grid position
  y: number;
  anomalyScore: number; // 0-100
}

export interface Alert {
  id: string;
  assetId: string;
  assetName: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  mlInsight?: string;
}

export interface EquipmentRegistration {
  id: string;
  assetId: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  yearManufactured: number;
  powerRating: number;
  imageUrl?: string;
  registeredAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  assetContext?: string;
}

export interface KPIMetrics {
  totalUptime: number;
  activeAlerts: number;
  anomaliesDetected: number;
  assetsOnline: number;
  totalAssets: number;
  predictedFailures: number;
}
