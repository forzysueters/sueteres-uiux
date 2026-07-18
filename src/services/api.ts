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
import {
  statusFor, reasonFor, gaugeRange, warnThreshold, sensorByRole, deviationOf,
} from './sensorLimits';
import { assetStatusFromSensors } from '../utils/plantStatus';

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

/** Uma grandeza de um ativo: nome, unidade, valor base e amplitude do ruído. */
type SensorSpec = [name: string, unit: string, base: number, variance: number];

/**
 * Gera os sensores de um ativo. O `status` NÃO é sorteado: sai de `statusFor`,
 * comparando o valor com os limites físicos da grandeza (ver sensorLimits.ts).
 * É o que garante que o gauge, o status do ativo e o alerta contem a mesma
 * história — antes o status vinha de um segundo `seededRandom`, sem relação
 * nenhuma com o valor exibido.
 */
const makeSensors = (assetId: string, assetSeed: number, specs: SensorSpec[]): Sensor[] =>
  specs.map(([name, unit, base, variance]) => {
    const s = makeSeed(name) + assetSeed;
    const value = parseFloat((base + (seededRandom(s) - 0.5) * variance).toFixed(2));
    const { min, max } = gaugeRange(name, base, assetId);
    return {
      id: `sensor-${s}`,
      name,
      unit,
      value,
      min,
      max,
      threshold: warnThreshold(name, base, assetId),
      status: statusFor(name, value, assetId),
    };
  });

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
    sensors: makeSensors('motor-001', 1001, [
      ['Tensão', 'V', 380, 10],
      // ~70% de In (41,8 A de placa) — carga típica de regime.
      ['Corrente', 'A', 29.3, 4],
      ['Temperatura', '°C', 62, 8],
      ['Rotação', 'rpm', 1760, 20],
      ['Vibração', 'mm/s', 2.3, 0.8],
    ]),
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
    // Rolamento em degradação: o atrito eleva a vibração primeiro (5,2 mm/s,
    // zona C da ISO 10816-3) e o calor gerado no mancal aparece depois na
    // temperatura da carcaça (79 °C). Os sensores elétricos seguem nominais —
    // é uma falha mecânica, não de carga.
    sensors: makeSensors('motor-002', 1002, [
      ['Tensão', 'V', 380, 15],
      // ~70% de In (68,5 A de placa).
      ['Corrente', 'A', 48.0, 6],
      ['Temperatura', '°C', 79, 12],
      ['Rotação', 'rpm', 1460, 30],
      ['Vibração', 'mm/s', 5.2, 1.2],
    ]),
    lastMaintenance: '2026-01-20', nextMaintenance: '2026-04-20',
    // plantX 42 punha o anel do ativo por cima da parede leste do Hall A
    // (o hall termina em x=450 do viewBox); 36 recentra o posto 2 dentro dele.
    x: 3, y: 1, plantX: 36, plantY: 25,
    anomalyScore: 58,
    nameplate: nameplates['motor-002'],
  },
  {
    id: 'pump-001', tag: 'BBA-001',
    name: 'Bomba de Circulação de Refrigeração',
    type: 'pump', area: 'Hall B', location: 'Hall B — Sistema de Refrigeração',
    status: 'normal', uptime: 99.5,
    sensors: makeSensors('pump-001', 2001, [
      ['Pressão', 'bar', 2.5, 0.4],
      ['Vazão', 'L/min', 145, 15],
      ['Temperatura', '°C', 44, 6],
      ['Potência', 'kW', 5.2, 0.5],
    ]),
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
    // Vibração na zona D da ISO 10816-3 (8,1 mm/s): severidade inaceitável em
    // regime. Pressão, temperaturas e corrente seguem dentro da faixa — o
    // problema é mecânico e está isolado no conjunto rotativo.
    sensors: makeSensors('compressor-001', 3001, [
      ['Pressão de Saída', 'bar', 7.0, 1.2],
      ['Temp. Entrada', '°C', 28, 4],
      ['Temp. Saída', '°C', 84, 10],
      ['Corrente Motor', 'A', 40.5, 4],
      ['Vibração', 'mm/s', 7.2, 1.8],
    ]),
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
    sensors: makeSensors('fan-001', 4001, [
      ['Velocidade', '%', 84, 6],
      ['Corrente Motor', 'A', 3.1, 0.4],
      ['Temp. Mancal', '°C', 54, 5],
      ['Vibração', 'mm/s', 1.1, 0.4],
    ]),
    lastMaintenance: '2026-03-01', nextMaintenance: '2026-06-01',
    x: 2, y: 2, plantX: 55, plantY: 20,
    anomalyScore: 15,
    nameplate: nameplates['fan-001'],
  },
];

// O `status` escrito nos literais acima é só um valor inicial de tipo — a
// verdade vem dos sensores. Deriva já na carga do módulo para que qualquer
// leitura (inclusive getAssetById) veja o status coerente desde o primeiro
// render, sem depender de um getAssets() ter rodado antes.
for (const asset of mockAssets) asset.status = assetStatusFromSensors(asset);

// ─── Alertas ─────────────────────────────────────────────────────────────────
// Alertas de sensor NÃO são escritos à mão: derivam de `deriveAlerts`, que só
// emite alerta para sensor fora de faixa e monta o texto a partir do próprio
// valor medido. Isso torna impossível o caso que existia antes — um alerta de
// "temperatura alta" convivendo com cinco sensores marcados como normais.

/** Contexto curado por (ativo, sensor): há quanto tempo o desvio começou e o
 *  insight preditivo. Os NÚMEROS nunca vêm daqui — só a narrativa. */
interface AlertNarrative {
  detectedMinAgo: number;
  mlInsight?: string;
}

const ALERT_NARRATIVES: Record<string, AlertNarrative> = {
  // MTR-002 — a vibração é o indicador líder: sobe antes e há mais tempo.
  'motor-002:Vibração': {
    detectedMinAgo: 190,
    mlInsight: 'Assinatura de vibração compatível com esfoliação na pista do rolamento do lado acionado. O desvio precede o aquecimento em ~3h, o que é típico de degradação mecânica: o atrito surge primeiro e o calor é consequência.',
  },
  'motor-002:Temperatura': {
    detectedMinAgo: 15,
    mlInsight: 'Aquecimento consistente com a perda de vibração registrada no mesmo mancal — o calor é gerado localmente pelo atrito, não por sobrecarga elétrica (tensão e corrente seguem nominais). Inspecionar lubrificação e folga do rolamento.',
  },
  // CMP-001 — vibração severa, já em zona inaceitável.
  'compressor-001:Vibração': {
    detectedMinAgo: 5,
    mlInsight: 'Nível de vibração em zona D da ISO 10816-3: operação continuada tende a propagar o dano ao acoplamento. Histórico similar resultou em parada não planejada de 14h.',
  },
};

/** Alertas que não vêm de sensor (agenda de manutenção, eventos operacionais). */
const maintenanceAlerts: Alert[] = [
  {
    id: 'alert-manut-motor-001', assetId: 'motor-001',
    assetTag: 'MTR-001', assetName: 'Motor de Produção Principal',
    severity: 'info',
    title: 'Manutenção Preventiva Agendada',
    description: 'Manutenção preventiva programada para 15/06/2026.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    resolved: false,
  },
];

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Alertas reconhecidos pelo operador. Some quando o sensor volta ao normal. */
const acknowledgedAlerts = new Set<string>();

const alertIdFor = (assetId: string, sensorName: string) =>
  `alert-${assetId}-${slug(sensorName)}`;

/**
 * Traduz os sensores fora de faixa de um ativo em alertas. Um sensor fora de
 * faixa sempre produz exatamente um alerta, e um sensor normal nunca produz
 * nenhum — é a garantia de coerência entre a aba Sensores e a aba Alertas.
 */
const deriveAlerts = (asset: Asset): Alert[] =>
  asset.sensors
    .filter((s) => s.status !== 'normal')
    .map((sensor) => {
      const id = alertIdFor(asset.id, sensor.name);
      const narrative = ALERT_NARRATIVES[`${asset.id}:${sensor.name}`];
      const critical = sensor.status === 'critical';
      const detalhe = reasonFor(sensor.name, sensor.value, sensor.unit, asset.id);
      return {
        id,
        assetId: asset.id,
        assetTag: asset.tag,
        assetName: asset.name,
        severity: critical ? 'critical' : 'warning',
        title: `${sensor.name} ${critical ? 'em nível crítico' : 'fora de faixa'}`,
        description: detalhe ? `${detalhe}.` : `${sensor.name} fora dos limites de operação.`,
        timestamp: new Date(Date.now() - (narrative?.detectedMinAgo ?? 1) * 60000).toISOString(),
        resolved: acknowledgedAlerts.has(id),
        mlInsight: narrative?.mlInsight,
      } satisfies Alert;
    });

/** Alertas de sensor de todos os ativos + os de manutenção, mais graves primeiro. */
const allAlerts = (): Alert[] => {
  const derived = mockAssets.flatMap(deriveAlerts);
  // Reconhecimento vale para o episódio atual: se o sensor normalizou, o alerta
  // deixa de existir e um desvio futuro volta a alertar do zero.
  const vivos = new Set(derived.map((a) => a.id));
  for (const id of acknowledgedAlerts) if (!vivos.has(id)) acknowledgedAlerts.delete(id);

  const peso = { critical: 0, warning: 1, info: 2 } as const;
  return [...derived, ...maintenanceAlerts].sort(
    (a, b) => peso[a.severity] - peso[b.severity]
      || Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
};

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
 * Condição "verdadeira" do ativo (0-1, maior = pior), lida DOS SENSORES.
 *
 * Antes existia uma tabela ANOMALY_CONDITION fixa aqui, o que criava um
 * terceiro universo numérico: o modelo recebia ~48 °C para o MTR-002 enquanto
 * a tela mostrava 79 °C. Agora a condição sai da posição real dos sensores de
 * temperatura e vibração dentro dos seus limites, então o health_index e o
 * insight passam a explicar o que está na tela.
 */
const conditionOf = (asset: Asset): number => {
  const relevantes = [
    sensorByRole(asset.sensors, 'temperature'),
    sensorByRole(asset.sensors, 'vibration'),
  ].filter((s): s is Sensor => s != null);
  if (relevantes.length === 0) return 0;
  return Math.max(...relevantes.map((s) => deviationOf(s, asset.id)));
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

/**
 * Constrói uma janela de leituras para o modelo a partir da condição atual dos
 * sensores. As constantes AN_* posicionam essa condição dentro da faixa numérica
 * em que o modelo foi treinado — os sensores da UI estão em mm/s e °C de escalas
 * diferentes, então o que atravessa é a severidade, não a unidade crua.
 */
const buildReadings = (asset: Asset): ScoreRequest => {
  const dev = conditionOf(asset);
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
  const health = Math.round(100 - conditionOf(asset) * 100);
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
        asset.status = assetStatusFromSensors(asset);
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
      asset.sensors = asset.sensors.map(sensor => {
        const value = parseFloat(
          (sensor.value + Math.sin(t + makeSeed(sensor.name)) * (sensor.max - sensor.min) * 0.01).toFixed(2),
        );
        // Reavalia o status a cada tick: um sensor que cruza o limite muda de
        // cor ao vivo, em vez de ficar preso ao status do momento da criação.
        return { ...sensor, value, status: statusFor(sensor.name, value, asset.id) };
      });
      asset.status = assetStatusFromSensors(asset);
      // anomalyScore/healthIndex continuam vindo do modelo (getAssets/scoreAnomaly).
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
    return allAlerts();
  },

  async getAlertsByAsset(assetId: string): Promise<Alert[]> {
    await new Promise(r => setTimeout(r, 150));
    return allAlerts().filter(a => a.assetId === assetId);
  },

  async resolveAlert(alertId: string): Promise<void> {
    await new Promise(r => setTimeout(r, 150));
    // Alerta de sensor é derivado: "resolver" registra o reconhecimento do
    // operador, mas não apaga o alerta enquanto o sensor seguir fora de faixa.
    const manual = maintenanceAlerts.find(a => a.id === alertId);
    if (manual) manual.resolved = true;
    else acknowledgedAlerts.add(alertId);
  },

  async getKPIMetrics(): Promise<KPIMetrics> {
    await new Promise(r => setTimeout(r, 200));
    const alerts = allAlerts();
    const online = mockAssets.filter(a => a.status !== 'offline').length;
    const critical = alerts.filter(a => !a.resolved && a.severity === 'critical').length;
    const anomalies = mockAssets.filter(a => a.anomalyScore > 50).length;
    return {
      totalUptime: parseFloat((mockAssets.reduce((s, a) => s + a.uptime, 0) / mockAssets.length).toFixed(2)),
      activeAlerts: alerts.filter(a => !a.resolved).length,
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
