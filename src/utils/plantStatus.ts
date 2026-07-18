import { Asset, Sensor } from '../types';

export interface StatusConfig {
  fill: string;
  stroke: string;
  pulse: string;
  label: string;
}

/**
 * Cores semânticas de status — NÃO mudam com o tema.
 * Antes viviam duplicadas em PlantFloorMap/Cards/AssetDetailPanel; a planta 3D
 * e o mapa SVG precisam concordar, então a fonte passa a ser esta.
 */
export const STATUS_COLORS: Record<string, StatusConfig> = {
  normal:   { fill: '#10b981', stroke: '#059669', pulse: '#10b981', label: 'Normal' },
  warning:  { fill: '#f59e0b', stroke: '#d97706', pulse: '#f59e0b', label: 'Alerta' },
  critical: { fill: '#ef4444', stroke: '#dc2626', pulse: '#ef4444', label: 'Crítico' },
  offline:  { fill: '#64748b', stroke: '#475569', pulse: '#64748b', label: 'Offline' },
};

export const statusConfig = (status: string): StatusConfig =>
  STATUS_COLORS[status] ?? STATUS_COLORS.normal;

/** Quanto o status "grita" (0 = calmo, 1 = crítico). Dirige brilho e pulso na cena. */
export const statusUrgency = (status: string): number =>
  status === 'critical' ? 1 : status === 'warning' ? 0.55 : 0;

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  offline: 2,
  normal: 3,
};

/** Ordem de triagem: o que está pior primeiro; empate desempata por anomalia. */
export function byTriage(a: Asset, b: Asset): number {
  const delta = (SEVERITY_RANK[a.status] ?? 9) - (SEVERITY_RANK[b.status] ?? 9);
  return delta !== 0 ? delta : (b.anomalyScore ?? 0) - (a.anomalyScore ?? 0);
}

/** Sensor mais fora de faixa — o "porquê" do alerta na régua de triagem. */
export function worstSensor(asset: Asset): Sensor | null {
  const rank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
  const offenders = asset.sensors.filter((s) => s.status !== 'normal');
  if (offenders.length === 0) return null;
  return [...offenders].sort((a, b) => rank(a.status) - rank(b.status))[0];
}

/**
 * Status do ativo a partir dos seus sensores: o pior sensor manda.
 *
 * Antes o status era literal no mock, o que permitia um ativo marcado como
 * "Alerta" sem nenhum sensor fora de faixa — a régua de triagem mostrava o
 * ativo sem conseguir dizer o porquê. `offline` é preservado porque é um estado
 * de comunicação, não de leitura.
 */
export function assetStatusFromSensors(asset: Asset): Asset['status'] {
  if (asset.status === 'offline') return 'offline';
  const worst = worstSensor(asset);
  if (!worst) return 'normal';
  return worst.status === 'critical' ? 'critical' : 'warning';
}
