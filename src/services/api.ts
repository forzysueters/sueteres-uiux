import {
  Asset, Alert, KPIMetrics, EquipmentRegistration,
  ChatMessage, Sensor, SensorHistorySeries, MotorNameplate,
} from '../types';
import {
  ocrAPI, OcrNetworkError, OcrMode, NameplateResult,
} from './ocrAPI';
import {
  anomalyAPI, AnomalyNetworkError, Reading, ScoreRequest, ScoreResult, Severity,
} from './anomalyAPI';

// Força o uso do mock mesmo com backend disponível (útil para demo offline)
const FORCE_OCR_MOCK = import.meta.env.VITE_OCR_USE_MOCK === 'true';
const FORCE_ANOMALY_MOCK = import.meta.env.VITE_ANOMALY_USE_MOCK === 'true';

// ─── Helpers determinísticos (seed por assetId+sensorName) ─────────────────
const seededRandom = (seed: number) => {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};
const makeSeed = (str: string) =>
  Array.from(str).reduce((acc, c) => acc + c.charCodeAt(0), 0);

const SENSOR_COLORS: Record<string, string> = {
  'Tensão': '#3b82f6',
  'Corrente': '#f59e0b',
  'Temperatura': '#ef4444',
  'Rotação': '#10b981',
  'Vibração': '#8b5cf6',
  'Pressão': '#06b6d4',
  'Vazão': '#84cc16',
  'Potência': '#f97316',
  'Velocidade': '#ec4899',
  'Pressão de Saída': '#06b6d4',
  'Temp. Entrada': '#ef4444',
  'Temp. Saída': '#dc2626',
  'Corrente Motor': '#f59e0b',
  'Temp. Mancal': '#f97316',
};

const sensorColor = (name: string) => SENSOR_COLORS[name] ?? '#94a3b8';

const makeSensor = (
  name: string, unit: string, base: number, variance: number, assetSeed: number,
): Sensor => {
  const s = makeSeed(name) + assetSeed;
  const r = seededRandom(s);
  const statusR = seededRandom(s + 97);
  return {
    id: `sensor-${s}`,
    name,
    unit,
    value: parseFloat((base + (r - 0.5) * variance).toFixed(2)),
    min: parseFloat((base * 0.7).toFixed(2)),
    max: parseFloat((base * 1.3).toFixed(2)),
    threshold: parseFloat((base * 1.2).toFixed(2)),
    status: statusR > 0.85 ? 'warning' : 'normal',
  };
};

const makeHistory = (
  base: number, variance: number, points: number, intervalMin: number, seed: number,
): { timestamp: string; value: number }[] =>
  Array.from({ length: points }, (_, i) => {
    const ts = new Date(Date.now() - (points - i) * intervalMin * 60 * 1000);
    const drift = Math.sin(i / (points / 4)) * variance * 0.4;
    const noise = (seededRandom(seed + i * 13.7) - 0.5) * variance;
    return { timestamp: ts.toISOString(), value: parseFloat((base + drift + noise).toFixed(2)) };
  });

// ─── Placas de identificação (MotorNameplate) ────────────────────────────────
const nameplates: Record<string, MotorNameplate> = {
  'motor-001': {
    tag: 'MTR-001',
    manufacturer: 'WEG',
    model: 'W22 IE3',
    serialNumber: 'WEG2024-MTR001',
    power_kw: 22.0, power_cv: 30,
    voltage: '380/660V', current_a: 41.8,
    rpm: 1760, poles: 4, connection: 'Delta/Star',
    frequency_hz: 60, ip_class: 'IP55', insulation_class: 'F',
    yearManufactured: 2021, registeredAt: '2026-03-16T08:00:00Z',
    ocrConfidence: 97,
  },
  'motor-002': {
    tag: 'MTR-002',
    manufacturer: 'Siemens',
    model: 'SIMOTICS SD',
    serialNumber: 'SIE2023-MTR002',
    power_kw: 37.0, power_cv: 50,
    voltage: '380/660V', current_a: 68.5,
    rpm: 1475, poles: 4, connection: 'Delta/Star',
    frequency_hz: 60, ip_class: 'IP55', insulation_class: 'F',
    yearManufactured: 2022, registeredAt: '2026-01-21T10:30:00Z',
    ocrConfidence: 94,
  },
  'pump-001': {
    tag: 'BBA-001',
    manufacturer: 'KSB',
    model: 'Etanorm 32-200',
    serialNumber: 'SN-KSB-20220615',
    power_kw: 5.5, power_cv: 7.5,
    voltage: '380V', current_a: 11.2,
    rpm: 1450, poles: 4, connection: 'Star',
    frequency_hz: 60, ip_class: 'IP54', insulation_class: 'B',
    yearManufactured: 2022, registeredAt: '2026-03-01T09:00:00Z',
    ocrConfidence: 91,
  },
  'compressor-001': {
    tag: 'CMP-001',
    manufacturer: 'Atlas Copco',
    model: 'GA 22+',
    serialNumber: 'SN-AC-20211210',
    power_kw: 22, power_cv: 30,
    voltage: '380V', current_a: 42.0,
    rpm: 2950, poles: 2, connection: 'Delta',
    frequency_hz: 60, ip_class: 'IP55', insulation_class: 'F',
    yearManufactured: 2020, registeredAt: '2025-12-11T14:00:00Z',
    ocrConfidence: 88,
  },
  'fan-001': {
    tag: 'EXA-001',
    manufacturer: 'WEG',
    model: 'W21 71 IE2',
    serialNumber: 'SN-WEG-20230301',
    power_kw: 0.75, power_cv: 1,
    voltage: '220/380V', current_a: 3.2,
    rpm: 1710, poles: 4, connection: 'Delta/Star',
    frequency_hz: 60, ip_class: 'IP55', insulation_class: 'F',
    yearManufactured: 2023, registeredAt: '2026-03-02T11:00:00Z',
    ocrConfidence: 99,
  },
};

// ─── Assets mock ─────────────────────────────────────────────────────────────
const mockAssets: Asset[] = [
  {
    id: 'motor-001', tag: 'MTR-001',
    name: 'Motor de Produção Principal',
    type: 'motor', area: 'Hall A', location: 'Hall A — Posto 1',
    status: 'normal', uptime: 99.8,
    sensors: [
      makeSensor('Tensão', 'V', 380, 10, 1001),
      makeSensor('Corrente', 'A', 14.8, 2, 1001),
      makeSensor('Temperatura', '°C', 62, 8, 1001),
      makeSensor('Rotação', 'rpm', 1760, 20, 1001),
      makeSensor('Vibração', 'mm/s', 2.3, 0.8, 1001),
    ],
    lastMaintenance: '2026-03-15', nextMaintenance: '2026-06-15',
    x: 1, y: 1, plantX: 20, plantY: 25,
    anomalyScore: 12,
    nameplate: nameplates['motor-001'],
  },
  {
    id: 'motor-002', tag: 'MTR-002',
    name: 'Motor de Reserva',
    type: 'motor', area: 'Hall A', location: 'Hall A — Posto 2',
    status: 'warning', uptime: 95.2,
    sensors: [
      makeSensor('Tensão', 'V', 380, 15, 1002),
      makeSensor('Corrente', 'A', 22.5, 3, 1002),
      makeSensor('Temperatura', '°C', 79, 12, 1002),
      makeSensor('Rotação', 'rpm', 1460, 30, 1002),
      makeSensor('Vibração', 'mm/s', 4.1, 1.2, 1002),
    ],
    lastMaintenance: '2026-01-20', nextMaintenance: '2026-04-20',
    x: 3, y: 1, plantX: 42, plantY: 25,
    anomalyScore: 58,
    nameplate: nameplates['motor-002'],
  },
  {
    id: 'pump-001', tag: 'BBA-001',
    name: 'Bomba de Circulação de Refrigeração',
    type: 'pump', area: 'Hall B', location: 'Hall B — Sistema de Refrigeração',
    status: 'normal', uptime: 99.5,
    sensors: [
      makeSensor('Pressão', 'bar', 2.5, 0.4, 2001),
      makeSensor('Vazão', 'L/min', 145, 15, 2001),
      makeSensor('Temperatura', '°C', 44, 6, 2001),
      makeSensor('Potência', 'kW', 5.2, 0.5, 2001),
    ],
    lastMaintenance: '2026-02-28', nextMaintenance: '2026-05-28',
    x: 1, y: 3, plantX: 20, plantY: 65,
    anomalyScore: 8,
    nameplate: nameplates['pump-001'],
  },
  {
    id: 'compressor-001', tag: 'CMP-001',
    name: 'Compressor de Ar',
    type: 'compressor', area: 'Hall C', location: 'Hall C — Pneumática',
    status: 'critical', uptime: 78.3,
    sensors: [
      makeSensor('Pressão de Saída', 'bar', 7.0, 1.2, 3001),
      makeSensor('Temp. Entrada', '°C', 28, 4, 3001),
      makeSensor('Temp. Saída', '°C', 84, 10, 3001),
      makeSensor('Corrente Motor', 'A', 40.5, 4, 3001),
      makeSensor('Vibração', 'mm/s', 7.2, 1.8, 3001),
    ],
    lastMaintenance: '2025-12-10', nextMaintenance: '2026-03-10',
    x: 3, y: 3, plantX: 70, plantY: 65,
    anomalyScore: 85,
    nameplate: nameplates['compressor-001'],
  },
  {
    id: 'fan-001', tag: 'EXA-001',
    name: 'Exaustor de Ventilação',
    type: 'fan', area: 'Cobertura', location: 'Área Técnica — Cobertura Norte',
    status: 'normal', uptime: 99.2,
    sensors: [
      makeSensor('Velocidade', '%', 84, 6, 4001),
      makeSensor('Corrente Motor', 'A', 3.1, 0.4, 4001),
      makeSensor('Temp. Mancal', '°C', 54, 5, 4001),
      makeSensor('Vibração', 'mm/s', 1.1, 0.4, 4001),
    ],
    lastMaintenance: '2026-03-01', nextMaintenance: '2026-06-01',
    x: 2, y: 2, plantX: 55, plantY: 20,
    anomalyScore: 15,
    nameplate: nameplates['fan-001'],
  },
];

// ─── Alerts mock ──────────────────────────────────────────────────────────────
const mockAlerts: Alert[] = [
  {
    id: 'alert-001', assetId: 'compressor-001',
    assetTag: 'CMP-001', assetName: 'Compressor de Ar',
    severity: 'critical',
    title: 'Vibração Alta Detectada',
    description: 'Níveis de vibração acima do limite seguro (7.2 mm/s > limite 5 mm/s). Manutenção imediata necessária.',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    resolved: false,
    mlInsight: 'Modelo ML prediz falha de rolamento em até 7 dias com 89% de confiança. Histórico similar resultou em parada não planejada de 14h.',
  },
  {
    id: 'alert-002', assetId: 'motor-002',
    assetTag: 'MTR-002', assetName: 'Motor de Reserva',
    severity: 'warning',
    title: 'Temperatura Elevada',
    description: 'Temperatura do motor acima da faixa normal de operação (79°C > limite 75°C).',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    resolved: false,
    mlInsight: 'Tendência de temperatura sugere degradação do sistema de resfriamento. Verificar nível de refrigerante.',
  },
  {
    id: 'alert-003', assetId: 'motor-001',
    assetTag: 'MTR-001', assetName: 'Motor de Produção Principal',
    severity: 'info',
    title: 'Manutenção Preventiva Agendada',
    description: 'Manutenção preventiva programada para 15/06/2026.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    resolved: false,
  },
  {
    id: 'alert-004', assetId: 'pump-001',
    assetTag: 'BBA-001', assetName: 'Bomba de Circulação de Refrigeração',
    severity: 'info',
    title: 'Desempenho Ótimo',
    description: 'Bomba operando dentro dos parâmetros normais após última calibração.',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    resolved: true,
  },
];

// ─── Mock OCR (fallback quando o backend Python está offline) ────────────────
const mockNameplateExtraction = (): NameplateResult => {
  const power_cv = [7.5, 10, 15, 20, 30][Math.floor(Math.random() * 5)];
  return {
    modelUsed: 'mock',
    motorType: 'trifasico',
    processingTimeMs: 0,
    rawFields: {},
    validation: {
      consistente: true,
      alertas: ['Backend de OCR offline — dados simulados para demonstração.'],
    },
    nameplate: {
      manufacturer: 'WEG',
      model: ['W22 132M IE3', 'W22 160L IE3', 'W22 90L IE2'][Math.floor(Math.random() * 3)],
      serialNumber: `${Math.floor(1e9 + Math.random() * 9e9)}`,
      power_kw: parseFloat((power_cv * 0.7355).toFixed(1)),
      power_cv,
      voltage: ['220/380V', '380/660V', '380V'][Math.floor(Math.random() * 3)],
      current_a: parseFloat((10 + Math.random() * 30).toFixed(1)),
      rpm: [1760, 1750, 3500, 1170][Math.floor(Math.random() * 4)],
      poles: [2, 4, 6][Math.floor(Math.random() * 3)],
      frequency_hz: 60,
      ip_class: ['IP54', 'IP55'][Math.floor(Math.random() * 2)],
      insulation_class: ['B', 'F', 'H'][Math.floor(Math.random() * 3)],
      yearManufactured: 2019 + Math.floor(Math.random() * 6),
      ocrConfidence: Math.floor(82 + Math.random() * 17),
    },
  };
};

// ─── Anomalia: geração de leituras + fallback ────────────────────────────────

/**
 * Condição "verdadeira" de cada ativo (0-100, maior = pior), usada para gerar
 * leituras coerentes. É estável: NÃO é o `anomalyScore` do asset (que passa a ser
 * sobrescrito por 100 - healthIndex após a pontuação do modelo).
 */
const ANOMALY_CONDITION: Record<string, number> = {
  'motor-001': 12,
  'motor-002': 58,
  'pump-001': 8,
  'compressor-001': 85,
  'fan-001': 15,
};

// Constantes calibradas empiricamente contra o serviço de anomalia (porta 8001).
// Objetivo: saudáveis ~85-95 (ok), motor-002 em alerta, compressor em critico.
const AN_WINDOW_POINTS = 30;         // 30 x 10s = 5 min (casa com RESAMPLE_RULE/FEATURE_WIN)
const AN_STEP_MS = 10_000;
const AN_BASE_VELOCITY = 6.8;        // mm/s — carga saudável (faixa de treino)
const AN_BASE_ACCEL = 0.04;          // g
const AN_TEMP_HEALTHY = 34;          // °C que ~zera o resíduo térmico p/ a carga base
const AN_THERMAL_SPAN = 25;          // °C de offset térmico no desvio máximo (calibrado: motor-002→alerta, compressor→critico)
const AN_VEL_ANOM_SPAN = 2.5;        // mm/s de anomalia de velocidade no desvio máximo

/** Constrói uma janela de leituras determinística e calibrada para um ativo. */
const buildReadings = (asset: Asset): ScoreRequest => {
  const dev = (ANOMALY_CONDITION[asset.id] ?? asset.anomalyScore) / 100;
  const seed = makeSeed(asset.id);
  const now = Date.now();
  const readings: Reading[] = [];
  for (let i = 0; i < AN_WINDOW_POINTS; i++) {
    const ts = new Date(now - (AN_WINDOW_POINTS - 1 - i) * AN_STEP_MS).toISOString();
    const n = (k: number) => seededRandom(seed + i * 7.3 + k) - 0.5; // ruído centrado
    const velocity = AN_BASE_VELOCITY + dev * AN_VEL_ANOM_SPAN * (0.5 + n(1)) + n(2) * 0.15;
    const acceleration = AN_BASE_ACCEL * (1 + dev * 0.8) + n(3) * 0.004;
    const temperature = AN_TEMP_HEALTHY + dev * AN_THERMAL_SPAN + n(4) * 0.5;
    readings.push({
      timestamp: ts,
      sensors: {
        velocity: parseFloat(velocity.toFixed(3)),
        acceleration: parseFloat(Math.max(0, acceleration).toFixed(4)),
        temperature: parseFloat(temperature.toFixed(2)),
      },
    });
  }
  return { asset_tag: asset.tag, readings };
};

const severityFromHealth = (h: number): Severity => {
  if (h < 45) return 'critico';
  if (h < 65) return 'alerta';
  if (h < 85) return 'info';
  return 'ok';
};

const MOCK_INSIGHT: Record<Severity, string> = {
  ok: 'Operação dentro do padrão. Nenhum desvio relevante detectado. (dados simulados — serviço de anomalia offline)',
  info: 'Desvio leve em relação à linha de base. Acompanhar nas próximas leituras. (dados simulados — serviço de anomalia offline)',
  alerta: 'Desvio relevante detectado: tendência de aquecimento acima do esperado. Agendar inspeção preventiva. (dados simulados — serviço de anomalia offline)',
  critico: 'Degradação crítica: aquecimento não explicado e padrão atípico. Acionar a manutenção com prioridade. (dados simulados — serviço de anomalia offline)',
};

/** Fallback determinístico quando o backend de anomalia está inacessível. */
const mockScoreAnomaly = (asset: Asset): ScoreResult => {
  const health = Math.round(100 - (ANOMALY_CONDITION[asset.id] ?? asset.anomalyScore));
  const severity = severityFromHealth(health);
  return {
    asset_tag: asset.tag,
    timestamp: new Date().toISOString(),
    health_index: health,
    health_min: health,
    anomaly_score: parseFloat(((100 - health) / 100).toFixed(2)),
    severity,
    insight: MOCK_INSIGHT[severity],
    thermal_residual: null,
    sustained: severity === 'alerta' || severity === 'critico',
    modelUsed: 'mock',
  };
};

// ─── API Service ──────────────────────────────────────────────────────────────
export const apiService = {
  async getAssets(): Promise<Asset[]> {
    await new Promise(r => setTimeout(r, 300));
    // Pontua todos os ativos com o modelo real (fallback p/ mock se offline).
    await Promise.all(
      mockAssets.map(async (asset) => {
        let result: ScoreResult;
        try {
          result = await apiService.scoreAnomaly(asset);
        } catch (err) {
          console.warn(`[anomaly] scoring falhou para ${asset.tag}:`, (err as Error).message);
          result = mockScoreAnomaly(asset);
        }
        asset.healthIndex = Math.round(result.health_index);
        asset.severity = result.severity;
        asset.insight = result.insight;
        asset.thermalResidual = result.thermal_residual ?? null;
        asset.anomalyScore = Math.round(100 - result.health_index);
      }),
    );
    return mockAssets;
  },

  /**
   * Pontua um ativo com o serviço de anomalia (pasta `anomaly/`, FastAPI).
   * Cai para mock determinístico apenas quando o backend está inacessível.
   */
  async scoreAnomaly(asset: Asset): Promise<ScoreResult> {
    if (!FORCE_ANOMALY_MOCK) {
      try {
        const resp = await anomalyAPI.score(buildReadings(asset));
        return { ...resp, modelUsed: 'anomaly' };
      } catch (err) {
        if (!(err instanceof AnomalyNetworkError)) throw err;
        console.warn('[anomaly] backend offline — usando mock:', (err as Error).message);
      }
    }
    return mockScoreAnomaly(asset);
  },

  async getAssetById(id: string): Promise<Asset | undefined> {
    await new Promise(r => setTimeout(r, 150));
    return mockAssets.find(a => a.id === id);
  },

  async getAssetByTag(tag: string): Promise<Asset | undefined> {
    await new Promise(r => setTimeout(r, 150));
    return mockAssets.find(a => a.tag === tag);
  },

  async updateAssetSensors(assetId: string): Promise<Asset | undefined> {
    const asset = mockAssets.find(a => a.id === assetId);
    if (asset) {
      const t = Date.now() / 1000;
      asset.sensors = asset.sensors.map(sensor => ({
        ...sensor,
        value: parseFloat(
          (sensor.value + Math.sin(t + makeSeed(sensor.name)) * (sensor.max - sensor.min) * 0.01).toFixed(2),
        ),
      }));
      // anomalyScore/healthIndex agora vêm do modelo (getAssets/scoreAnomaly);
      // o tick apenas perturba os valores de sensor para o "live" visual.
    }
    return asset;
  },

  /** Retorna séries históricas de todos os sensores de um ativo */
  async getSensorHistory(
    assetId: string,
    range: '1h' | '6h' | '24h' | '7d' = '24h',
  ): Promise<SensorHistorySeries[]> {
    await new Promise(r => setTimeout(r, 200));
    const asset = mockAssets.find(a => a.id === assetId);
    if (!asset) return [];

    const cfg: Record<string, { points: number; intervalMin: number }> = {
      '1h':  { points: 60, intervalMin: 1 },
      '6h':  { points: 72, intervalMin: 5 },
      '24h': { points: 48, intervalMin: 30 },
      '7d':  { points: 84, intervalMin: 120 },
    };
    const { points, intervalMin } = cfg[range];

    return asset.sensors.map(sensor => ({
      sensorName: sensor.name,
      unit: sensor.unit,
      color: sensorColor(sensor.name),
      data: makeHistory(
        sensor.value,
        (sensor.max - sensor.min) * 0.15,
        points,
        intervalMin,
        makeSeed(assetId + sensor.name),
      ),
    }));
  },

  async getAlerts(): Promise<Alert[]> {
    await new Promise(r => setTimeout(r, 200));
    return mockAlerts;
  },

  async getAlertsByAsset(assetId: string): Promise<Alert[]> {
    await new Promise(r => setTimeout(r, 150));
    return mockAlerts.filter(a => a.assetId === assetId);
  },

  async resolveAlert(alertId: string): Promise<void> {
    await new Promise(r => setTimeout(r, 150));
    const alert = mockAlerts.find(a => a.id === alertId);
    if (alert) alert.resolved = true;
  },

  async getKPIMetrics(): Promise<KPIMetrics> {
    await new Promise(r => setTimeout(r, 200));
    const online = mockAssets.filter(a => a.status !== 'offline').length;
    const critical = mockAlerts.filter(a => !a.resolved && a.severity === 'critical').length;
    const anomalies = mockAssets.filter(a => a.anomalyScore > 50).length;
    return {
      totalUptime: parseFloat((mockAssets.reduce((s, a) => s + a.uptime, 0) / mockAssets.length).toFixed(2)),
      activeAlerts: mockAlerts.filter(a => !a.resolved).length,
      anomaliesDetected: anomalies,
      assetsOnline: online,
      totalAssets: mockAssets.length,
      predictedFailures: critical,
    };
  },

  async registerEquipment(data: Omit<EquipmentRegistration, 'id' | 'registeredAt'>): Promise<EquipmentRegistration> {
    await new Promise(r => setTimeout(r, 300));
    return { ...data, id: `reg-${Date.now()}`, registeredAt: new Date().toISOString() };
  },

  /**
   * Extrai os dados da placa via modelo de OCR WEG W22 (pasta `ocr/`, FastAPI).
   *
   * Chama o backend real (POST /ocr/extract). Se o backend estiver offline,
   * cai automaticamente para um mock determinístico para não quebrar a demo —
   * o resultado vem marcado com `modelUsed: 'mock'`.
   */
  async extractNameplate(
    file: File,
    opts: { mode?: OcrMode; preprocess?: boolean } = {},
  ): Promise<NameplateResult> {
    if (!FORCE_OCR_MOCK) {
      try {
        return await ocrAPI.extractNameplate(file, opts);
      } catch (err) {
        // Só usa fallback quando o backend está inacessível; erros do modelo
        // (imagem ruim, formato inválido) devem ser exibidos ao usuário.
        if (!(err instanceof OcrNetworkError)) throw err;
        console.warn('[ocr] backend offline — usando mock:', (err as Error).message);
      }
    }
    return mockNameplateExtraction();
  },

  /** @deprecated use `extractNameplate`. Mantido por compatibilidade. */
  async extractNameplateFromImage(file: File): Promise<Partial<MotorNameplate>> {
    const { nameplate } = await this.extractNameplate(file);
    return nameplate;
  },

  async getChatResponse(message: string, assetContext?: string): Promise<ChatMessage> {
    await new Promise(r => setTimeout(r, 900));
    const asset = assetContext ? mockAssets.find(a => a.id === assetContext || a.tag === assetContext) : null;
    const tag = asset?.tag ?? 'N/A';

    const responses: Record<string, string> = {
      compressor: `[${tag}] Com base nos dados de vibração (${asset?.sensors.find(s => s.name === 'Vibração')?.value.toFixed(1) ?? '~'} mm/s), o compressor apresenta sinais de desgaste de rolamento. Recomendo agendar manutenção em até 48h — substituir selo do rolamento e verificar sistema de lubrificação.`,
      temperatura: `[${tag}] A leitura de temperatura elevada pode indicar degradação do sistema de resfriamento. Verificar nível de refrigerante, operação do ventilador e inspeção visual do trocador de calor.`,
      vibração: `[${tag}] Vibração alta indica tipicamente desalinhamento, problema em rolamento ou desbalanceamento. Realizar verificação de alinhamento e inspecionar componentes rotativos.`,
      manutenção: `[${tag}] Com base no histórico operacional e nos padrões de anomalia (score: ${asset?.anomalyScore ?? 0}%), o ativo está próximo da manutenção preventiva. Planejar inspeção de componentes, lubrificação de rolamentos e termografia.`,
      placa: `[${tag}] Dados extraídos da placa via OCR: ${asset?.nameplate ? `Fabricante: ${asset.nameplate.manufacturer}, Modelo: ${asset.nameplate.model}, Potência: ${asset.nameplate.power_kw} kW / ${asset.nameplate.power_cv} CV, Tensão: ${asset.nameplate.voltage}, RPM: ${asset.nameplate.rpm}, Classe IP: ${asset.nameplate.ip_class}.` : 'Placa ainda não cadastrada. Acesse Equipamentos para registrar.'}`,
      default: `[${tag}] O ativo está operando ${asset?.status === 'normal' ? 'normalmente' : `em estado de ${asset?.status}`}. Score de anomalia atual: ${asset?.anomalyScore ?? 0}%. Próxima manutenção: ${asset?.nextMaintenance ?? 'não agendada'}.`,
    };

    const lower = message.toLowerCase();
    let response = responses.default;
    if (lower.includes('compressor')) response = responses.compressor;
    else if (lower.includes('temperatura') || lower.includes('temp')) response = responses.temperatura;
    else if (lower.includes('vibra')) response = responses.vibração;
    else if (lower.includes('manuten')) response = responses.manutenção;
    else if (lower.includes('placa') || lower.includes('ocr') || lower.includes('namep')) response = responses.placa;

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
      assetContext,
    };
  },

  async uploadEquipmentImage(file: File): Promise<{ url: string; extractedData: Partial<EquipmentRegistration> }> {
    await new Promise(r => setTimeout(r, 1000));
    return {
      url: URL.createObjectURL(file),
      extractedData: {
        manufacturer: 'WEG',
        model: 'W22 IE3 132M',
        serialNumber: `SN${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
        yearManufactured: 2022,
        powerRating: 7.5,
      },
    };
  },
};

// ─── Realtime subscription ─────────────────────────────────────────────────
export const startRealtimeUpdates = (assetId: string, callback: (asset: Asset) => void) => {
  const interval = setInterval(async () => {
    const updated = await apiService.updateAssetSensors(assetId);
    if (updated) callback(updated);
  }, 2000);
  return () => clearInterval(interval);
};
