import {
  Asset, Alert, KPIMetrics, EquipmentRegistration,
  ChatMessage, Sensor, SensorHistorySeries, MotorNameplate,
  Technician, NewMaintenanceOrder,
} from '../types';
import {
  ocrAPI, OcrNetworkError, OcrMode, NameplateResult,
} from './ocrAPI';
import {
  anomalyAPI, AnomalyNetworkError, Reading, ScoreRequest, ScoreResult, Severity,
} from './anomalyAPI';
import {
  statusFor, sensorByRole, deviationOf, registerSensorLimits,
} from './sensorLimits';
import { assetStatusFromSensors } from '../utils/plantStatus';
import { supabase, describeSupabaseError } from '../lib/supabase';
import type { ViewRow } from '../types/database';

// Força o uso do mock mesmo com backend disponível (útil para demo offline)
const FORCE_OCR_MOCK = import.meta.env.VITE_OCR_USE_MOCK === 'true';
const FORCE_ANOMALY_MOCK = import.meta.env.VITE_ANOMALY_USE_MOCK === 'true';

function fail(error: unknown, message: string): never {
  throw new Error(describeSupabaseError(error, message));
}

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

// ─── Mapeamento banco → domínio ─────────────────────────────────────────────
//
// O status do sensor NÃO é lido do banco: sai de `statusFor`, comparando o
// valor com os limites da grandeza. Como esses limites passam a ser registrados
// a partir do próprio banco (registerSensorLimits), as duas pontas contam a
// mesma história — gauge, status do ativo e alerta seguem coerentes.

type RawSensor = {
  id: string;
  tag: string;
  name: string;
  unit: string;
  value: number | null;
  status: Sensor['status'];
  min_value: number;
  max_value: number;
  warning_threshold: number | null;
  critical_threshold: number | null;
  limit_direction?: string;
  nominal_value?: number | null;
  limit_source?: string | null;
};

/** Faixa do gauge: precisa englobar os limites, senão o marcador satura. */
const gaugeBounds = (raw: RawSensor): { min: number; max: number } => {
  const candidates = [
    raw.min_value,
    raw.max_value,
    raw.warning_threshold,
    raw.critical_threshold,
  ].filter((n): n is number => n != null);
  return { min: Math.min(...candidates), max: Math.max(...candidates) };
};

function mapSensor(raw: RawSensor, assetTag: string): Sensor {
  const value = raw.value ?? 0;
  const { min, max } = gaugeBounds(raw);
  return {
    id: raw.id,
    name: raw.name,
    unit: raw.unit,
    value: parseFloat(value.toFixed(2)),
    min,
    max,
    threshold: raw.warning_threshold ?? max,
    status: statusFor(raw.name, value, assetTag),
  };
}

type RawNameplate = {
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  power_kw: number | null;
  power_hp: number | null;
  voltage: string | null;
  current_a: number | null;
  rpm: number | null;
  poles: number | null;
  connection_type: string | null;
  frequency_hz: number | null;
  ip_rating: string | null;
  insulation_class: string | null;
  year_manufactured: number | null;
  image_url: string | null;
  ocr_confidence: number | null;
  confirmed_at: string | null;
  created_at: string;
};

function mapNameplate(raw: RawNameplate | null, tag: string): MotorNameplate | undefined {
  if (!raw) return undefined;
  return {
    tag,
    manufacturer: raw.manufacturer ?? '',
    model: raw.model ?? '',
    serialNumber: raw.serial_number ?? '',
    power_kw: Number(raw.power_kw ?? 0),
    power_cv: Number(raw.power_hp ?? 0),
    voltage: raw.voltage ?? '',
    current_a: Number(raw.current_a ?? 0),
    rpm: Number(raw.rpm ?? 0),
    poles: Number(raw.poles ?? 0),
    connection: raw.connection_type ?? '',
    frequency_hz: Number(raw.frequency_hz ?? 60),
    ip_class: raw.ip_rating ?? '',
    insulation_class: raw.insulation_class ?? '',
    yearManufactured: Number(raw.year_manufactured ?? 0),
    registeredAt: raw.confirmed_at ?? raw.created_at,
    imageUrl: raw.image_url ?? undefined,
    // O banco guarda 0-1; a UI exibe em porcentagem.
    ocrConfidence: raw.ocr_confidence != null ? Math.round(raw.ocr_confidence * 100) : undefined,
  };
}

function mapAsset(row: ViewRow<'v_assets_full'>): Asset {
  const tag = row.tag as string;
  const rawSensors = Array.isArray(row.sensors) ? (row.sensors as unknown as RawSensor[]) : [];

  // Os limites vindos do banco passam a valer no lugar da tabela estática.
  for (const s of rawSensors) {
    registerSensorLimits(tag, s.name, {
      warn: s.warning_threshold,
      crit: s.critical_threshold,
      direction: s.limit_direction,
      nominal: s.nominal_value,
      source: s.limit_source,
    });
  }

  const asset: Asset = {
    id: row.id as string,
    tag,
    name: row.name as string,
    type: row.asset_type as Asset['type'],
    area: (row.area_name as string) ?? '',
    location: row.location as string,
    status: row.status as Asset['status'],
    uptime: Number(row.uptime ?? 0),
    sensors: rawSensors.map((s) => mapSensor(s, tag)),
    lastMaintenance: (row.last_maintenance as string) ?? '',
    nextMaintenance: (row.next_maintenance as string) ?? '',
    imageUrl: (row.image_url as string) ?? undefined,
    x: Number(row.grid_x ?? 1),
    y: Number(row.grid_y ?? 1),
    plantX: Number(row.plant_x ?? 50),
    plantY: Number(row.plant_y ?? 50),
    anomalyScore: Number(row.anomaly_score ?? 0),
    healthIndex: row.health_index != null ? Number(row.health_index) : undefined,
    severity: (row.severity as Asset['severity']) ?? undefined,
    insight: (row.insight as string) ?? undefined,
    thermalResidual: row.thermal_residual != null ? Number(row.thermal_residual) : null,
    nameplate: mapNameplate(row.nameplate as unknown as RawNameplate | null, tag),
  };

  // O pior sensor manda: um ativo nunca aparece em alerta sem sensor fora de faixa.
  asset.status = assetStatusFromSensors(asset);
  return asset;
}

function mapAlert(row: ViewRow<'v_alerts_full'>): Alert {
  return {
    id: row.id as string,
    assetId: row.asset_id as string,
    assetTag: row.asset_tag as string,
    assetName: row.asset_name as string,
    severity: row.severity as Alert['severity'],
    title: row.title as string,
    description: row.message as string,
    timestamp: row.triggered_at as string,
    resolved: Boolean(row.resolved),
    mlInsight: row.ml_insight ?? undefined,
  };
}

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
 * Condição "verdadeira" do ativo (0-1, maior = pior), lida DOS SENSORES, para
 * que o health_index e o insight expliquem o que está na tela.
 */
const conditionOf = (asset: Asset): number => {
  const relevantes = [
    sensorByRole(asset.sensors, 'temperature'),
    sensorByRole(asset.sensors, 'vibration'),
  ].filter((s): s is Sensor => s != null);
  if (relevantes.length === 0) return 0;
  return Math.max(...relevantes.map((s) => deviationOf(s, asset.tag)));
};

// Constantes calibradas empiricamente contra o serviço de anomalia (porta 8001).
const AN_WINDOW_POINTS = 30;         // 30 x 10s = 5 min (casa com RESAMPLE_RULE/FEATURE_WIN)
const AN_STEP_MS = 10_000;
const AN_BASE_VELOCITY = 6.8;        // mm/s — carga saudável (faixa de treino)
const AN_BASE_ACCEL = 0.04;          // g
const AN_TEMP_HEALTHY = 34;          // °C que ~zera o resíduo térmico p/ a carga base
const AN_THERMAL_SPAN = 25;          // °C de offset térmico no desvio máximo
const AN_VEL_ANOM_SPAN = 2.5;        // mm/s de anomalia de velocidade no desvio máximo

/**
 * Constrói uma janela de leituras para o modelo a partir da condição atual dos
 * sensores. As constantes AN_* posicionam essa condição na faixa numérica em
 * que o modelo foi treinado — o que atravessa é a severidade, não a unidade.
 */
const buildReadings = (asset: Asset): ScoreRequest => {
  const dev = conditionOf(asset);
  const seed = makeSeed(asset.tag);
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

/** Persiste o diagnóstico. Só grava o que veio do modelo real, nunca o mock. */
async function persistScore(asset: Asset, result: ScoreResult): Promise<void> {
  if (result.modelUsed !== 'anomaly') return;
  const { error } = await supabase.rpc('apply_anomaly_score', {
    p_asset_id: asset.id,
    p_health_index: result.health_index,
    p_anomaly_score: 100 - result.health_index,
    p_severity: result.severity,
    p_insight: result.insight,
    p_thermal_residual: result.thermal_residual ?? undefined,
  });
  if (error) console.warn('[anomaly] não foi possível gravar o score:', error.message);
}

// ─── API Service ──────────────────────────────────────────────────────────────
export const apiService = {
  async getAssets(): Promise<Asset[]> {
    const { data, error } = await supabase
      .from('v_assets_full')
      .select('*')
      .order('tag', { ascending: true });

    if (error) fail(error, 'Não foi possível carregar os ativos.');
    const assets = (data ?? []).map(mapAsset);

    // Pontua todos os ativos com o modelo real (fallback p/ mock se offline).
    await Promise.all(
      assets.map(async (asset) => {
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
        await persistScore(asset, result);
      }),
    );

    return assets;
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
    const { data, error } = await supabase
      .from('v_assets_full')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) fail(error, 'Não foi possível carregar o ativo.');
    return data ? mapAsset(data) : undefined;
  },

  async getAssetByTag(tag: string): Promise<Asset | undefined> {
    const { data, error } = await supabase
      .from('v_assets_full')
      .select('*')
      .eq('tag', tag)
      .maybeSingle();

    if (error) fail(error, 'Não foi possível carregar o ativo.');
    return data ? mapAsset(data) : undefined;
  },

  /**
   * Relê o ativo do banco.
   *
   * As leituras chegam pelo consumidor OPC-UA (`ingest_readings`); aqui só
   * refletimos o que já foi gravado, sem sintetizar valor no cliente.
   */
  async updateAssetSensors(assetId: string): Promise<Asset | undefined> {
    return apiService.getAssetById(assetId);
  },

  /** Séries históricas de todos os sensores de um ativo, agregadas no banco. */
  async getSensorHistory(
    assetId: string,
    range: '1h' | '2h' | '6h' | '24h' | '7d' = '24h',
  ): Promise<SensorHistorySeries[]> {
    const cfg: Record<string, { hours: number; bucketMinutes: number }> = {
      '1h':  { hours: 1,   bucketMinutes: 1 },
      '2h':  { hours: 2,   bucketMinutes: 5 },
      '6h':  { hours: 6,   bucketMinutes: 5 },
      '24h': { hours: 24,  bucketMinutes: 30 },
      '7d':  { hours: 168, bucketMinutes: 120 },
    };
    const { hours, bucketMinutes } = cfg[range];

    const { data, error } = await supabase.rpc('get_asset_series', {
      p_asset_id: assetId,
      p_hours: hours,
      p_bucket_minutes: bucketMinutes,
    });

    if (error) fail(error, 'Não foi possível carregar o histórico do ativo.');

    const grouped = new Map<string, SensorHistorySeries>();
    for (const row of data ?? []) {
      if (!grouped.has(row.sensor_name)) {
        grouped.set(row.sensor_name, {
          sensorName: row.sensor_name,
          unit: row.unit,
          color: sensorColor(row.sensor_name),
          data: [],
        });
      }
      grouped.get(row.sensor_name)!.data.push({
        timestamp: row.bucket,
        value: parseFloat(Number(row.avg_value).toFixed(2)),
      });
    }
    return [...grouped.values()];
  },

  async getAlerts(): Promise<Alert[]> {
    const { data, error } = await supabase
      .from('v_alerts_full')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(200);

    if (error) fail(error, 'Não foi possível carregar os alertas.');

    const peso = { critical: 0, warning: 1, info: 2 } as const;
    return (data ?? [])
      .map(mapAlert)
      .sort(
        (a, b) => peso[a.severity] - peso[b.severity]
          || Date.parse(b.timestamp) - Date.parse(a.timestamp),
      );
  },

  async getAlertsByAsset(assetId: string): Promise<Alert[]> {
    const alerts = await apiService.getAlerts();
    return alerts.filter((a) => a.assetId === assetId);
  },

  async resolveAlert(alertId: string): Promise<void> {
    const { error } = await supabase.rpc('resolve_alert', { p_alert_id: alertId });
    if (error) fail(error, 'Não foi possível resolver o alerta.');
  },

  /** Perfis que podem receber uma OM. Engenheiros entram junto porque em planta
   *  pequena costumam assumir a execução — a policy de leitura já os expõe. */
  async getTechnicians(): Promise<Technician[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, job_title')
      .in('role', ['technician', 'engineer'])
      .eq('is_active', true)
      .order('full_name');

    if (error) fail(error, 'Não foi possível carregar os técnicos.');

    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.full_name as string) || (row.email as string),
      role: row.role as 'technician' | 'engineer',
      jobTitle: (row.job_title as string) ?? null,
    }));
  },

  /** Abre uma OM agendada para o ativo. `scheduledFor` já vem em ISO/UTC. */
  async createMaintenanceOrder(input: NewMaintenanceOrder): Promise<{ orderNumber: string }> {
    const { data: auth } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('maintenance_orders')
      .insert({
        asset_id: input.assetId,
        maintenance_type: input.type,
        priority: input.priority,
        title: input.title,
        description: input.description || null,
        scheduled_for: input.scheduledFor,
        assigned_to: input.assignedTo,
        created_by: auth?.user?.id ?? null,
        status: 'scheduled',
      })
      .select('order_number')
      .single();

    if (error) fail(error, 'Não foi possível agendar a manutenção.');

    return { orderNumber: data.order_number as string };
  },

  async getKPIMetrics(): Promise<KPIMetrics> {
    const { data, error } = await supabase.from('v_kpi_metrics').select('*').single();
    if (error) fail(error, 'Não foi possível carregar os indicadores.');

    return {
      totalUptime: parseFloat(Number(data.total_uptime ?? 0).toFixed(2)),
      activeAlerts: Number(data.active_alerts ?? 0),
      anomaliesDetected: Number(data.anomalies_detected ?? 0),
      assetsOnline: Number(data.assets_online ?? 0),
      totalAssets: Number(data.total_assets ?? 0),
      predictedFailures: Number(data.predicted_failures ?? 0),
    };
  },

  async registerEquipment(
    data: Omit<EquipmentRegistration, 'id' | 'registeredAt'>,
  ): Promise<EquipmentRegistration> {
    const { data: auth } = await supabase.auth.getUser();

    const { data: row, error } = await supabase
      .from('asset_nameplates')
      .insert({
        asset_id: data.assetId || null,
        status: 'confirmed',
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serial_number: data.serialNumber || null,
        year_manufactured: data.yearManufactured || null,
        power_kw: data.powerRating || null,
        image_url: data.imageUrl || null,
        registered_by: auth.user?.id ?? null,
        confirmed_by: auth.user?.id ?? null,
        confirmed_at: new Date().toISOString(),
      })
      .select('id, created_at')
      .single();

    if (error) fail(error, 'Não foi possível registrar o equipamento.');
    return { ...data, id: row.id, registeredAt: row.created_at };
  },

  /**
   * Grava a placa lida pelo OCR, com a imagem original como evidência.
   * `assetId` nulo registra a placa sem vínculo, para associação posterior.
   */
  async registerNameplate(
    assetId: string | null,
    nameplate: Partial<MotorNameplate>,
    image?: { url: string; path: string } | null,
    meta?: { provider?: string; confidence?: number },
  ): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const confidence = meta?.confidence ?? nameplate.ocrConfidence;

    const { error } = await supabase.from('asset_nameplates').insert({
      asset_id: assetId,
      status: 'confirmed',
      manufacturer: nameplate.manufacturer || null,
      model: nameplate.model || null,
      serial_number: nameplate.serialNumber || null,
      year_manufactured: nameplate.yearManufactured || null,
      power_kw: nameplate.power_kw ?? null,
      power_hp: nameplate.power_cv ?? null,
      voltage: nameplate.voltage || null,
      current_a: nameplate.current_a ?? null,
      rpm: nameplate.rpm ?? null,
      poles: nameplate.poles ?? null,
      connection_type: nameplate.connection || null,
      frequency_hz: nameplate.frequency_hz ?? null,
      ip_rating: nameplate.ip_class || null,
      insulation_class: nameplate.insulation_class || null,
      image_url: image?.url ?? null,
      storage_path: image?.path ?? null,
      ocr_provider: meta?.provider ?? 'easyocr',
      // A UI trabalha em 0-100; o banco guarda 0-1.
      ocr_confidence: confidence != null ? Math.min(Math.max(confidence / 100, 0), 1) : null,
      registered_by: auth.user?.id ?? null,
      confirmed_by: auth.user?.id ?? null,
      confirmed_at: new Date().toISOString(),
    });

    if (error) fail(error, 'Não foi possível registrar a placa.');
  },

  /** Últimos equipamentos com placa confirmada — para a lista "Registros Recentes". */
  async getRecentEquipment(limit = 5): Promise<
    { id: string; name: string; spec: string; date: string; assetTag: string | null }[]
  > {
    const { data, error } = await supabase
      .from('asset_nameplates')
      .select('id, manufacturer, model, serial_number, confirmed_at, created_at, assets(tag, name)')
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false })
      .limit(limit);

    if (error) fail(error, 'Não foi possível carregar os registros recentes.');

    return (data ?? []).map((row) => {
      const asset = (Array.isArray(row.assets) ? row.assets[0] : row.assets) as
        | { tag: string; name: string }
        | null;
      const name = asset?.name ?? row.model ?? 'Equipamento sem vínculo';
      const spec = [row.manufacturer, row.model].filter(Boolean).join(' ')
        + (row.serial_number ? ` | SN: ${row.serial_number}` : '');
      return {
        id: row.id,
        name,
        spec: spec || 'Sem especificações extraídas',
        date: new Date(row.confirmed_at ?? row.created_at).toLocaleDateString('pt-BR'),
        assetTag: asset?.tag ?? null,
      };
    });
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

  /**
   * Resposta do assistente conversacional.
   *
   * Envia a pergunta, o histórico recente e o ativo em foco para a Edge
   * Function `ai-chat`, que monta o contexto real do site (telemetria,
   * alertas, predições, manutenção, documentação técnica) e delega a redação
   * da resposta ao Gemini — preservando o contexto entre turnos da conversa.
   *
   * Se a function não estiver disponível (não implantada, sem
   * `GEMINI_API_KEY`, ou offline), cai para o motor determinístico local
   * (`assistantEngine`), no mesmo padrão de fallback já usado para OCR e
   * anomalia: a demo nunca quebra, só perde a redação em linguagem natural.
   */
  async getChatResponse(
    message: string,
    assetContext: string | undefined,
    history: Pick<ChatMessage, 'role' | 'content'>[],
    conversationId: string | null,
  ): Promise<ChatMessage & { conversationId: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { question: message, assetContext: assetContext ?? null, conversationId, history },
      });
      if (error) throw error;
      if (!data?.content) throw new Error('empty_response');

      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString(),
        assetContext,
        citations: data.citations,
        conversationId: data.conversationId ?? conversationId,
      };
    } catch (err) {
      console.warn('[ai-chat] indisponível — usando motor local determinístico:', (err as Error).message);
      const { answerQuestion } = await import('./assistantEngine');
      const answer = await answerQuestion(message, assetContext ?? null);

      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: answer.content,
        timestamp: new Date().toISOString(),
        assetContext,
        offline: true,
        conversationId,
      };
    }
  },

  /** Envia a foto da placa para o bucket de equipamentos. */
  async uploadEquipmentImage(
    file: File,
  ): Promise<{ url: string; path: string; extractedData: Partial<EquipmentRegistration> }> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `nameplates/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from('equipment-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) fail(error, 'Falha ao enviar a imagem da placa.');

    const { data } = supabase.storage.from('equipment-images').getPublicUrl(path);

    // A extração de campos é responsabilidade de `extractNameplate` (OCR).
    return { url: data.publicUrl, path, extractedData: {} };
  },
};

// ─── Realtime ───────────────────────────────────────────────────────────────

/**
 * Acompanha um ativo. Reage a mudanças em `assets` e a novas leituras via
 * Realtime do Postgres, com um poll de segurança caso o canal não esteja
 * disponível. Devolve a função de cancelamento.
 */
export const startRealtimeUpdates = (assetId: string, callback: (asset: Asset) => void) => {
  let stopped = false;

  const refresh = async () => {
    if (stopped) return;
    try {
      const updated = await apiService.getAssetById(assetId);
      if (updated && !stopped) callback(updated);
    } catch {
      // Silencioso: o poll seguinte tenta de novo.
    }
  };

  const channel = supabase
    .channel(`asset-${assetId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'assets', filter: `id=eq.${assetId}` },
      () => void refresh(),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sensor_readings', filter: `asset_id=eq.${assetId}` },
      () => void refresh(),
    )
    .subscribe();

  const interval = setInterval(() => void refresh(), 10_000);
  void refresh();

  return () => {
    stopped = true;
    clearInterval(interval);
    void supabase.removeChannel(channel);
  };
};
