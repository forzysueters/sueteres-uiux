import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { useAssetRealtime } from '../hooks/useAssetRealtime';
import { useAlerts } from '../hooks/useAlerts';
import { SensorGauge } from '../components/SensorGauge';
import { NameplateCard } from '../components/NameplateCard';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { SensorHistorySeries } from '../types';
import {
  ArrowLeft, Activity, Tag, AlertTriangle, CheckCircle2,
  TrendingUp, Sparkles, Calendar, Zap, Shield, RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';

const RANGES = ['1h', '6h', '24h', '7d'] as const;

export const AssetMonitorPage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { assets, setAssets } = useAppStore();

  const [historyRange, setHistoryRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [history, setHistory] = useState<SensorHistorySeries[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { alerts, resolveAlert } = useAlerts(assetId);

  // Load assets if not already in store
  useEffect(() => {
    if (assets.length === 0) {
      apiService.getAssets().then(setAssets);
    }
  }, []);

  const asset = assets.find(a => a.id === assetId);

  // Realtime updates
  useAssetRealtime(assetId ?? null);

  // Load history
  useEffect(() => {
    if (!assetId) return;
    setHistoryLoading(true);
    apiService.getSensorHistory(assetId, historyRange).then(data => {
      setHistory(data);
      if (!selectedSensor && data.length > 0) setSelectedSensor(data[0].sensorName);
      setHistoryLoading(false);
    });
  }, [assetId, historyRange]);

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        Ativo não encontrado.
      </div>
    );
  }

  const statusConfig = {
    critical: { text: 'text-red-500', label: 'Crítico', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    warning:  { text: 'text-amber-500', label: 'Alerta', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    normal:   { text: 'text-emerald-500', label: 'Normal', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    offline:  { text: 'text-slate-500', label: 'Offline', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  };
  const cfg = statusConfig[asset.status] || statusConfig.normal;

  const activeAlerts = alerts.filter(a => !a.resolved);
  const currentHistory = selectedSensor ? history.find(h => h.sensorName === selectedSensor) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/planta')}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Planta
        </button>
        <span className="text-muted">/</span>
        <span className="text-muted">{asset.area}</span>
        <span className="text-muted">/</span>
        <span className="text-foreground font-semibold">{asset.tag}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center border', cfg.bg, cfg.border)}>
            <Activity size={28} className={cfg.text} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-bold text-primary font-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded flex items-center gap-1">
                <Tag size={11} />
                {asset.tag}
              </span>
              <span className={cn('text-xs font-bold uppercase', cfg.text)}>{cfg.label}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{asset.name}</h1>
            <p className="text-sm text-muted">{asset.location}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · 2s
          </span>
          {activeAlerts.length > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={12} />
              {activeAlerts.length} alerta{activeAlerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Disponibilidade', value: `${asset.uptime.toFixed(1)}%`, color: 'text-emerald-400' },
          { label: 'Score de Anomalia', value: `${asset.anomalyScore}%`, color: asset.anomalyScore > 50 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Sensores Ativos', value: `${asset.sensors.length}`, color: 'text-blue-400' },
          { label: 'Alertas Ativos', value: `${activeAlerts.length}`, color: activeAlerts.length > 0 ? 'text-amber-400' : 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="saas-card p-4 text-center">
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-muted uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* AI insight */}
      {asset.anomalyScore > 25 && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
          <Sparkles size={16} className="text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-primary mb-1">Insight Preditivo IA</p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              {asset.anomalyScore > 70
                ? `Score de anomalia crítico (${asset.anomalyScore}%). O modelo ML prediz risco de falha em até 7 dias com alta confiança. Recomenda-se inspeção imediata dos rolamentos e verificação do sistema de lubrificação.`
                : `Score de anomalia elevado (${asset.anomalyScore}%). Tendência de degradação detectada. Planejar manutenção preventiva para as próximas 2 semanas. Monitorar sensores de vibração e temperatura.`}
            </p>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-primary/10">
              <div>
                <p className="text-[9px] text-primary/60 uppercase">Vida Útil Estimada</p>
                <p className="text-xs font-bold text-foreground">~ {Math.round((100 - asset.anomalyScore) * 2.4)} dias</p>
              </div>
              <div>
                <p className="text-[9px] text-primary/60 uppercase">Confiança Modelo</p>
                <p className="text-xs font-bold text-foreground">{Math.round(70 + asset.anomalyScore * 0.25)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sensors */}
        <div className="saas-card p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
              <Activity size={12} className="text-primary" />
              Telemetria em Tempo Real
            </span>
          </div>
          {asset.sensors.map(sensor => (
            <SensorGauge key={sensor.id} sensor={sensor} />
          ))}
        </div>

        {/* History */}
        <div className="saas-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={12} className="text-primary" />
              Histórico de Sensores
            </span>
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setHistoryRange(r)}
                  className={cn(
                    'px-2 py-1 rounded text-[10px] font-bold transition-all',
                    historyRange === r ? 'bg-primary text-white' : 'bg-slate-800 text-muted hover:text-foreground',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {history.map(h => (
              <button
                key={h.sensorName}
                onClick={() => setSelectedSensor(h.sensorName)}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-bold transition-all border',
                  selectedSensor === h.sensorName
                    ? 'border-current'
                    : 'border-transparent bg-slate-800 text-muted hover:text-foreground',
                )}
                style={selectedSensor === h.sensorName ? { color: h.color, borderColor: h.color, background: `${h.color}15` } : {}}
              >
                {h.sensorName}
              </button>
            ))}
          </div>

          {historyLoading ? (
            <div className="h-48 flex items-center justify-center text-muted text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" />
              Carregando histórico…
            </div>
          ) : currentHistory ? (
            <TimeSeriesChart
              data={currentHistory.data.map(d => ({ timestamp: d.timestamp, value: d.value }))}
              title={`${currentHistory.sensorName}`}
              dataKey="value"
              unit={currentHistory.unit}
              color={currentHistory.color}
              type="area"
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-muted text-sm">
              Selecione um sensor acima
            </div>
          )}
        </div>
      </div>

      {/* Nameplate */}
      {asset.nameplate && (
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Tag size={14} className="text-primary" />
            Placa de Identificação — Dados OCR
          </h2>
          <NameplateCard nameplate={asset.nameplate} />
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            Histórico de Alertas do Ativo
          </h2>
          <div className="space-y-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={cn(
                  'p-4 rounded-xl border-l-4',
                  alert.severity === 'critical' ? 'border-l-red-500 bg-red-500/5' :
                  alert.severity === 'warning'  ? 'border-l-amber-500 bg-amber-500/5' :
                  'border-l-blue-500 bg-blue-500/5',
                  alert.resolved && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted mt-0.5">{alert.description}</p>
                    {alert.mlInsight && (
                      <p className="text-[10px] text-amber-300/80 mt-2 flex items-start gap-1">
                        <Sparkles size={10} className="text-primary mt-0.5 flex-shrink-0" />
                        {alert.mlInsight}
                      </p>
                    )}
                  </div>
                  {!alert.resolved && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 hover:text-emerald-400 transition-colors whitespace-nowrap"
                    >
                      <CheckCircle2 size={12} />
                      Resolver
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[9px] font-mono text-muted">{new Date(alert.timestamp).toLocaleString('pt-BR')}</span>
                  {alert.resolved && <span className="text-[9px] font-bold text-emerald-500">Resolvido</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance info */}
      <div className="saas-card p-5">
        <h2 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar size={12} className="text-primary" />
          Manutenção
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Última Manutenção', date: asset.lastMaintenance, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Próxima Manutenção', date: asset.nextMaintenance, icon: Zap, color: 'text-primary' },
          ].map(({ label, date, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/30 border border-border">
              <Icon size={18} className={color} />
              <div>
                <p className="text-[9px] text-muted uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-foreground">{new Date(date).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="w-full mt-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-all">
          <Shield size={14} />
          Agendar Manutenção Preventiva
        </button>
      </div>
    </div>
  );
};
