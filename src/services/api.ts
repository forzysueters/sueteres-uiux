import {
  Asset, Alert, KPIMetrics, Area, NewAssetInput, InactiveAsset,
  ChatMessage, Sensor, SensorHistorySeries, MotorNameplate,
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
import type { Json, ViewRow } from '../types/database';

// Força o uso do mock mesmo com backend disponível (útil para demo offline)
const FORCE_OCR_MOCK = import.meta.env.VITE_OCR_USE_MOCK === 'true';
const FORCE_ANOMALY_MOCK = import.meta.env.VITE_ANOMALY_USE_MOCK === 'true';

function fail(error: unknown, message: string): never {
  throw new Error(describeSupabaseError(error, message));
}

/** Marca em `ocr_provider` uma placa cujos valores foram corrigidos à mão. */
const MANUAL_PROVIDER = 'manual';

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
  ocr_provider: string | null;
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
    source: raw.ocr_provider === MANUAL_PROVIDER ? 'manual' : 'ocr',
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
    areaId: (row.area_id as string) ?? null,
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
    range: '1h' | '6h' | '24h' | '7d' = '24h',
  ): Promise<SensorHistorySeries[]> {
    const cfg: Record<string, { hours: number; bucketMinutes: number }> = {
      '1h':  { hours: 1,   bucketMinutes: 1 },
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

  /** Áreas da planta — alimenta o seletor de destino do wizard de OCR. */
  async getAreas(): Promise<Area[]> {
    const { data, error } = await supabase
      .from('areas')
      .select('id, code, name, plant_id')
      .order('code');

    if (error) fail(error, 'Não foi possível carregar as áreas da planta.');

    return (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      plantId: row.plant_id,
    }));
  },

  /**
   * Cria um ativo a partir da placa lida pelo OCR.
   *
   * Sem sensores: a instrumentação é cadastrada à parte, e sem ela o ativo não
   * tem telemetria, gauges nem alertas. A RLS de `assets` só aceita escrita de
   * admin/engineer — mais restrita que `can_write()`, que vale para a placa.
   */
  async createAsset(input: NewAssetInput): Promise<string> {
    const { data, error } = await supabase
      .from('assets')
      .insert({
        plant_id: input.plantId,
        area_id: input.areaId,
        tag: input.tag,
        name: input.name,
        asset_type: input.type,
        location: input.location,
        criticality: input.criticality,
        plant_x: input.plantX,
        plant_y: input.plantY,
      })
      .select('id')
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      // assets_tag_plant_key: a TAG é única por planta.
      if (code === '23505') {
        throw new Error(`Já existe um ativo com a TAG "${input.tag}" nesta planta.`);
      }
      // RLS recusa a escrita para technician/viewer.
      if (code === '42501') {
        throw new Error('Seu papel não permite criar ativos. Necessário administrador ou engenheiro.');
      }
      fail(error, 'Não foi possível criar o ativo.');
    }

    return data.id;
  },

  /**
   * Grava a placa lida pelo OCR, com a imagem original como evidência.
   * `assetId` nulo registra a placa sem vínculo, para associação posterior.
   *
   * `ocr_raw` guarda a resposta crua do modelo (campos com confiança
   * individual, texto por zona, validação física, tempo de processamento) —
   * é a evidência que sustenta o que foi cadastrado.
   */
  async registerNameplate(
    assetId: string | null,
    nameplate: Partial<MotorNameplate>,
    image?: { url: string; path: string } | null,
    meta?: {
      provider?: string;
      confidence?: number;
      motorType?: string;
      status?: 'draft' | 'confirmed';
      raw?: Json;
    },
  ): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    const confidence = meta?.confidence ?? nameplate.ocrConfidence;
    const status = meta?.status ?? 'confirmed';
    const confirmed = status === 'confirmed';

    const { data, error } = await supabase
      .from('asset_nameplates')
      .insert({
        asset_id: assetId,
        status,
        manufacturer: nameplate.manufacturer || null,
        model: nameplate.model || null,
        serial_number: nameplate.serialNumber || null,
        year_manufactured: nameplate.yearManufactured || null,
        motor_type: meta?.motorType || null,
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
        ocr_raw: meta?.raw ?? {},
        registered_by: auth.user?.id ?? null,
        confirmed_by: confirmed ? auth.user?.id ?? null : null,
        confirmed_at: confirmed ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (error) fail(error, 'Não foi possível registrar a placa.');
    return data.id;
  },

  /**
   * Promove a placa a `confirmed` e a vincula ao ativo.
   *
   * O cadastro grava a placa como `draft` sem vínculo antes de criar o ativo:
   * se a criação falhar, o que sobra é um rascunho invisível — `v_assets_full`,
   * o assistente, a lista de registros recentes e o índice único de série
   * filtram todos por `confirmed`. Sem isso, uma falha no meio do caminho
   * deixaria um ativo órfão que só um admin conseguiria apagar.
   */
  async confirmNameplate(nameplateId: string, assetId: string | null): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();

    if (assetId) {
      // A checagem de série vem ANTES de rebaixar a placa anterior: se o
      // conflito só aparecesse no update final, o ativo já teria perdido a
      // placa que tinha e ficaria sem nenhuma confirmada.
      const { data: draft } = await supabase
        .from('asset_nameplates')
        .select('serial_number')
        .eq('id', nameplateId)
        .maybeSingle();

      if (draft?.serial_number) {
        const { data: clash } = await supabase
          .from('asset_nameplates')
          .select('id, assets(tag)')
          .eq('serial_number', draft.serial_number)
          .eq('status', 'confirmed')
          .neq('asset_id', assetId)
          .maybeSingle();

        if (clash) {
          const other = (Array.isArray(clash.assets) ? clash.assets[0] : clash.assets) as
            | { tag: string } | null;
          throw new Error(
            `O número de série "${draft.serial_number}" já pertence a uma placa confirmada`
            + `${other?.tag ? ` do ativo ${other.tag}` : ''}. Confira o campo antes de registrar.`,
          );
        }
      }

      // Reprocessar a placa de um ativo que já tem uma confirmada esbarraria em
      // `nameplates_serial_key` (único parcial sobre serial_number onde status =
      // 'confirmed'): a foto nova traz o mesmo número de série. A anterior é
      // rebaixada primeiro — o enum não tem 'superseded', e 'rejected' é o mais
      // próximo; a linha continua no banco com sua auditoria, nada se perde.
      const { error: supersedeError } = await supabase
        .from('asset_nameplates')
        .update({ status: 'rejected' })
        .eq('asset_id', assetId)
        .eq('status', 'confirmed')
        .neq('id', nameplateId);

      if (supersedeError) fail(supersedeError, 'Não foi possível substituir a placa anterior.');
    }

    const { error } = await supabase
      .from('asset_nameplates')
      .update({
        asset_id: assetId,
        status: 'confirmed',
        confirmed_by: auth.user?.id ?? null,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', nameplateId);

    if (error) {
      // O serial já pertence a uma placa confirmada de OUTRO ativo.
      if ((error as { code?: string }).code === '23505') {
        throw new Error(
          'Já existe uma placa confirmada com este número de série em outro ativo. '
          + 'Confira o campo "Número de Série" antes de registrar.',
        );
      }
      fail(error, 'Não foi possível confirmar a placa.');
    }
  },

  /**
   * Salva uma correção manual da placa como uma NOVA versão confirmada.
   *
   * Não altera a linha existente: a leitura original do OCR fica preservada
   * (com seu `ocr_raw`, confiança e autoria) e apenas deixa de ser a vigente —
   * `confirmNameplate` rebaixa a anterior. A view sempre entrega a confirmada
   * mais recente, então a tela passa a mostrar a corrigida.
   *
   * A imagem é herdada da versão anterior: a foto continua sendo a evidência
   * de onde os valores vieram, mesmo depois de ajustados à mão.
   */
  async saveNameplateRevision(
    assetId: string,
    nameplate: Partial<MotorNameplate>,
  ): Promise<void> {
    const { data: previous } = await supabase
      .from('asset_nameplates')
      .select('id, image_url, storage_path, ocr_provider, ocr_confidence, motor_type')
      .eq('asset_id', assetId)
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const image = previous?.image_url
      ? { url: previous.image_url, path: previous.storage_path ?? '' }
      : null;

    const nameplateId = await apiService.registerNameplate(null, nameplate, image, {
      provider: MANUAL_PROVIDER,
      // Confiança herdada: descreve a extração que originou esses valores, e o
      // selo "editado manualmente" no card avisa que não valem como acurácia
      // do modelo.
      confidence: previous?.ocr_confidence != null ? previous.ocr_confidence * 100 : undefined,
      motorType: previous?.motor_type ?? undefined,
      status: 'draft',
      raw: {
        edited_from: previous?.id ?? null,
        original_provider: previous?.ocr_provider ?? null,
        edited_at: new Date().toISOString(),
      },
    });

    await apiService.confirmNameplate(nameplateId, assetId);
  },

  /**
   * O que existe pendurado no ativo — decide se a remoção pode ser definitiva.
   *
   * As 11 FKs que apontam para `assets` usam ON DELETE CASCADE, então apagar um
   * ativo instrumentado levaria junto sensores, leituras, alertas e ordens de
   * manutenção. A placa não entra na conta: ela é parte do ativo e cai com ele
   * por definição.
   */
  async getAssetUsage(assetId: string): Promise<{
    sensors: number;
    readings: number;
    alerts: number;
    maintenanceOrders: number;
    isEmpty: boolean;
  }> {
    const count = async (table: 'sensors' | 'sensor_readings' | 'alerts' | 'maintenance_orders') => {
      const { count: n, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('asset_id', assetId);
      if (error) fail(error, 'Não foi possível verificar os dados do ativo.');
      return n ?? 0;
    };

    const [sensors, readings, alerts, maintenanceOrders] = await Promise.all([
      count('sensors'), count('sensor_readings'), count('alerts'), count('maintenance_orders'),
    ]);

    return {
      sensors, readings, alerts, maintenanceOrders,
      isEmpty: sensors === 0 && readings === 0 && alerts === 0 && maintenanceOrders === 0,
    };
  },

  /**
   * Remoção padrão: tira o ativo de circulação sem destruir nada.
   *
   * `v_assets_full` filtra por `is_active`, então o ativo some da planta, do
   * dashboard, do 3D e da lista que o assistente lê — mas a linha e todo o
   * histórico continuam no banco, e a operação é reversível.
   */
  async deactivateAsset(assetId: string): Promise<void> {
    const { error } = await supabase
      .from('assets')
      .update({ is_active: false })
      .eq('id', assetId);

    if (error) {
      if ((error as { code?: string }).code === '42501') {
        throw new Error('Seu papel não permite remover ativos. Necessário administrador ou engenheiro.');
      }
      fail(error, 'Não foi possível desativar o ativo.');
    }
  },

  /**
   * Move um ativo na planta: grava o centro da pegada e, quando ele mudou de
   * hall, a área e a célula da vista em grade.
   *
   * `grid_x`/`grid_y` são de OUTRA coisa (a matriz da vista "Grade", que agrupa
   * por área) e normalmente não se mexe neles. Mas ao trocar de área o ativo
   * entra numa matriz onde a célula antiga pode já estar ocupada — e como
   * aquela vista faz `.find()` por célula, um dos dois sumiria da tela. Por
   * isso o chamador passa uma célula livre junto.
   */
  async updateAssetLayout(
    assetId: string,
    layout: {
      plantX: number;
      plantY: number;
      areaId?: string;
      gridX?: number;
      gridY?: number;
    },
  ): Promise<void> {
    const patch = {
      plant_x: layout.plantX,
      plant_y: layout.plantY,
      ...(layout.areaId ? { area_id: layout.areaId } : {}),
      ...(layout.gridX != null ? { grid_x: layout.gridX } : {}),
      ...(layout.gridY != null ? { grid_y: layout.gridY } : {}),
    };

    // O `.select('id')` não é cosmético: a RLS de UPDATE em `assets` é
    // has_role('admin','engineer') e uma escrita recusada NÃO devolve erro —
    // devolve zero linhas. Sem conferir isso, o editor diria "salvo" para quem
    // não tem permissão e descartaria o rascunho do usuário.
    const { data, error } = await supabase
      .from('assets')
      .update(patch)
      .eq('id', assetId)
      .select('id');

    if (error) {
      if ((error as { code?: string }).code === '42501') {
        throw new Error('Seu papel não permite reposicionar ativos. Necessário administrador ou engenheiro.');
      }
      fail(error, 'Não foi possível gravar a posição do ativo.');
    }

    if (!data?.length) {
      throw new Error('Posição recusada pelo banco — permissão insuficiente ou ativo inexistente.');
    }
  },

  /**
   * Ativos desativados — a única leitura que NÃO passa por `v_assets_full`.
   *
   * A view filtra por `is_active`, o que torna o ativo desativado invisível em
   * toda a aplicação. Sem esta consulta direta à tabela não haveria como
   * chegar até ele para reativá-lo.
   */
  async getInactiveAssets(): Promise<InactiveAsset[]> {
    const { data, error } = await supabase
      .from('assets')
      .select('id, tag, name, asset_type, location, updated_at, areas(name)')
      .eq('is_active', false)
      .order('updated_at', { ascending: false });

    if (error) fail(error, 'Não foi possível carregar os ativos desativados.');

    return (data ?? []).map((row) => {
      const area = (Array.isArray(row.areas) ? row.areas[0] : row.areas) as { name: string } | null;
      return {
        id: row.id,
        tag: row.tag,
        name: row.name,
        type: row.asset_type as Asset['type'],
        location: row.location,
        area: area?.name ?? '',
        deactivatedAt: row.updated_at,
      };
    });
  },

  /** Reverte a desativação. */
  async reactivateAsset(assetId: string): Promise<void> {
    const { error } = await supabase
      .from('assets')
      .update({ is_active: true })
      .eq('id', assetId);

    if (error) fail(error, 'Não foi possível reativar o ativo.');
  },

  /**
   * Apaga o ativo em definitivo. Só deve ser chamado quando `getAssetUsage`
   * disser que não há nada pendurado — o cascade não avisa antes de levar
   * telemetria junto. Requer admin ou engenheiro (migração 0015).
   */
  async deleteAsset(assetId: string): Promise<void> {
    const { error } = await supabase.from('assets').delete().eq('id', assetId);

    if (error) {
      if ((error as { code?: string }).code === '42501') {
        throw new Error('Seu papel não permite apagar ativos. Necessário administrador ou engenheiro.');
      }
      fail(error, 'Não foi possível apagar o ativo.');
    }
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
   * da resposta à OpenAI — preservando o contexto entre turnos da conversa.
   *
   * Se a function não estiver disponível (não implantada, sem
   * `OPENAI_API_KEY`, ou offline), cai para o motor determinístico local
   * (`assistantEngine`), no mesmo padrão de fallback já usado para OCR e
   * anomalia: a demo nunca quebra, só perde a redação em linguagem natural.
   *
   * O histórico não vai no corpo da requisição — a Edge Function reconstrói os
   * últimos turnos a partir do que já está gravado no banco, pela
   * `conversationId`. Confiar num histórico vindo do cliente permitiria
   * forjar turnos falsos do próprio modelo para manipular respostas futuras.
   */
  async getChatResponse(
    message: string,
    assetContext: string | undefined,
    conversationId: string | null,
  ): Promise<ChatMessage & { conversationId: string | null }> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { question: message, assetContext: assetContext ?? null, conversationId },
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

  /**
   * Retoma a conversa mais recente do usuário com o assistente, se houver.
   *
   * A memória já é gravada no banco a cada turno (`chat_conversations` /
   * `chat_messages`, RLS restrita a `user_id = auth.uid()`) — isto só lê o que
   * já está lá, para a conversa sobreviver a um recarregamento de página em
   * vez de começar do zero a cada visita.
   */
  async getLatestConversation(): Promise<{ conversationId: string; messages: ChatMessage[] } | null> {
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conversation) return null;

    const { data: rows } = await supabase
      .from('chat_messages')
      .select('id, role, content, asset_context, citations, created_at')
      .eq('conversation_id', conversation.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true });
    if (!rows || rows.length === 0) return null;

    const messages: ChatMessage[] = rows.map((r) => ({
      id: r.id,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      timestamp: r.created_at,
      assetContext: r.asset_context ?? undefined,
      citations: (r.citations as unknown as ChatMessage['citations']) ?? undefined,
    }));

    return { conversationId: conversation.id, messages };
  },

  /**
   * Transcreve um áudio gravado no navegador via Edge Function `stt`, que
   * delega à OpenAI (Whisper) — mesma chave do `ai-chat`. Existe pra não
   * depender do reconhecimento de voz embutido no navegador, que manda o
   * áudio direto pro Google por fora da nossa aplicação e se mostrou
   * instável fora do ambiente de desenvolvimento (bloqueios de rede, cota,
   * falhas silenciosas).
   */
  async transcribeAudio(audioBase64: string, mimeType: string, lang: 'pt' | 'en'): Promise<string> {
    const { data, error } = await supabase.functions.invoke('stt', {
      body: { audio: audioBase64, mimeType, lang },
    });
    if (error) throw error;
    return (data?.text ?? '').trim();
  },

  /** Envia a foto da placa para o bucket de equipamentos. */
  async uploadEquipmentImage(file: File): Promise<{ url: string; path: string }> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `nameplates/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from('equipment-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) fail(error, 'Falha ao enviar a imagem da placa.');

    const { data } = supabase.storage.from('equipment-images').getPublicUrl(path);

    // A extração de campos é responsabilidade de `extractNameplate` (OCR).
    return { url: data.publicUrl, path };
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
