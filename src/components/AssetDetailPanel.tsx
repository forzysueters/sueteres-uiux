import React, { useState, useEffect } from 'react';
import { X, Activity, Clock, AlertTriangle, CheckCircle2, TrendingUp, Sparkles, Settings, Calendar, Zap, Shield, Tag, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { SensorHistorySeries } from '../types';
import { apiService } from '../services/api';
import { useAssetRealtime } from '../hooks/useAssetRealtime';
import { useAlerts } from '../hooks/useAlerts';
import { SensorGauge } from './SensorGauge';
import { NameplateCard } from './NameplateCard';
import { TimeSeriesChart } from './TimeSeriesChart';
import { cn } from '../lib/utils';

interface AssetDetailPanelProps {
  assetId: string;
  onClose: () => void;
}

type Tab = 'sensors' | 'history' | 'nameplate' | 'alerts';

const HISTORY_RANGES = ['1h', '6h', '24h', '7d'] as const;

export const AssetDetailPanel: React.FC<AssetDetailPanelProps> = ({ assetId, onClose }) => {
  const { assets } = useAppStore();
  const asset = assets.find((a) => a.id === assetId);

  const [tab, setTab] = useState<Tab>('sensors');
  const [historyRange, setHistoryRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [history, setHistory] = useState<SensorHistorySeries[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { alerts, resolveAlert } = useAlerts(assetId);

  // Realtime sensor updates
  useAssetRealtime(assetId);

  // Load history when tab or range changes
  useEffect(() => {
    if (tab !== 'history') return;
    setHistoryLoading(true);
    apiService.getSensorHistory(assetId, historyRange).then((data) => {
      setHistory(data);
      if (!selectedSensor && data.length > 0) setSelectedSensor(data[0].sensorName);
      setHistoryLoading(false);
    });
  }, [assetId, tab, historyRange]);

  if (!asset) return null;

  const statusConfig = {
    critical: { text: 'text-red-500', label: 'Crítico', icon: AlertTriangle, bg: 'bg-red-500/10' },
    warning:  { text: 'text-amber-500', label: 'Alerta', icon: AlertTriangle, bg: 'bg-amber-500/10' },
    normal:   { text: 'text-emerald-500', label: 'Normal', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
    offline:  { text: 'text-slate-500', label: 'Offline', icon: Clock, bg: 'bg-slate-500/10' },
  };
  const cfg = statusConfig[asset.status] || statusConfig.normal;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'sensors',   label: 'Sensores',  icon: Settings },
    { id: 'history',   label: 'Histórico', icon: TrendingUp },
    { id: 'nameplate', label: 'Placa',     icon: Tag },
    { id: 'alerts',    label: 'Alertas',   icon: AlertTriangle },
  ];

  const activeAlerts = alerts.filter(a => !a.resolved);
  const currentHistory = selectedSensor
    ? history.find(h => h.sensorName === selectedSensor)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-card h-full border-l border-border flex flex-col animate-slide-in-right shadow-panel overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-slate-900/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', cfg.bg, cfg.text)}>
              <cfg.icon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-primary font-mono">{asset.tag}</span>
                <span className={cn('text-[9px] font-bold uppercase', cfg.text)}>{cfg.label}</span>
              </div>
              <h2 className="text-base font-bold text-foreground leading-tight">{asset.name}</h2>
              <p className="text-[10px] text-muted">{asset.location}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-muted transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 border-b border-border flex-shrink-0">
          {[
            { label: 'Disponibilidade', value: `${asset.uptime.toFixed(1)}%`, color: 'text-emerald-400' },
            { label: 'Score Anomalia', value: `${asset.anomalyScore}%`, color: asset.anomalyScore > 50 ? 'text-red-400' : 'text-emerald-400' },
            { label: 'Sensores', value: `${asset.sensors.length}`, color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-3 text-center border-r border-border last:border-r-0">
              <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* AI Insight strip */}
        {asset.anomalyScore > 30 && (
          <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 flex-shrink-0">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200/80 leading-relaxed">
                {asset.anomalyScore > 70
                  ? `Score de anomalia crítico (${asset.anomalyScore}%). Recomenda-se inspeção imediata — risco de falha estimado em até 7 dias.`
                  : `Score de anomalia elevado (${asset.anomalyScore}%). Monitorar tendência e planejar manutenção preventiva.`}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-bold uppercase tracking-wider transition-all relative',
                tab === id ? 'text-primary' : 'text-muted hover:text-foreground',
              )}
            >
              <Icon size={12} />
              {label}
              {id === 'alerts' && activeAlerts.length > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {activeAlerts.length}
                </span>
              )}
              {tab === id && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* SENSORS TAB */}
          {tab === 'sensors' && (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                  <Activity size={12} className="text-primary" />
                  Telemetria em Tempo Real
                </span>
                <span className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live · 2s
                </span>
              </div>
              {asset.sensors.map(sensor => (
                <SensorGauge key={sensor.id} sensor={sensor} />
              ))}
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="p-5 space-y-4">
              {/* Range selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted font-bold uppercase">Período:</span>
                <div className="flex gap-1">
                  {HISTORY_RANGES.map(r => (
                    <button
                      key={r}
                      onClick={() => setHistoryRange(r)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-[10px] font-bold transition-all',
                        historyRange === r ? 'bg-primary text-white' : 'bg-slate-800 text-muted hover:text-foreground',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sensor selector */}
              <div className="flex flex-wrap gap-1.5">
                {history.map(h => (
                  <button
                    key={h.sensorName}
                    onClick={() => setSelectedSensor(h.sensorName)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border',
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
                  Carregando histórico…
                </div>
              ) : currentHistory ? (
                <TimeSeriesChart
                  data={currentHistory.data.map(d => ({ timestamp: d.timestamp, value: d.value }))}
                  title={`${currentHistory.sensorName} — ${historyRange}`}
                  dataKey="value"
                  unit={currentHistory.unit}
                  color={currentHistory.color}
                  type="area"
                />
              ) : (
                <div className="h-48 flex items-center justify-center text-muted text-sm">
                  Selecione um sensor para ver o histórico
                </div>
              )}
            </div>
          )}

          {/* NAMEPLATE TAB */}
          {tab === 'nameplate' && (
            <div className="p-5">
              {asset.nameplate ? (
                <NameplateCard nameplate={asset.nameplate} />
              ) : (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <Tag size={32} className="text-muted mb-4" />
                  <p className="text-sm font-semibold text-foreground">Placa não cadastrada</p>
                  <p className="text-xs text-muted mt-1">
                    Acesse Equipamentos para registrar a placa via OCR.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ALERTS TAB */}
          {tab === 'alerts' && (
            <div className="p-5 space-y-3">
              {alerts.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <CheckCircle2 size={32} className="text-emerald-500 mb-4" />
                  <p className="text-sm font-semibold text-foreground">Sem alertas para este ativo</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={cn(
                      'p-4 rounded-xl border-l-4',
                      alert.severity === 'critical' ? 'border-l-red-500 bg-red-500/5' :
                      alert.severity === 'warning'  ? 'border-l-amber-500 bg-amber-500/5' :
                      'border-l-blue-500 bg-blue-500/5',
                      alert.resolved && 'opacity-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
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
                          className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 whitespace-nowrap hover:text-emerald-400 transition-colors"
                        >
                          <CheckCircle2 size={12} />
                          Resolver
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[9px] font-mono text-muted">
                        {new Date(alert.timestamp).toLocaleString('pt-BR')}
                      </span>
                      {alert.resolved && (
                        <span className="text-[9px] font-bold text-emerald-500">Resolvido</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex-shrink-0">
          <div className="flex items-center justify-between text-[10px] text-muted">
            <span className="flex items-center gap-2">
              <Calendar size={12} />
              Última manutenção: {new Date(asset.lastMaintenance).toLocaleDateString('pt-BR')}
            </span>
            <span className="flex items-center gap-2">
              <Zap size={12} className="text-primary" />
              Próxima: {new Date(asset.nextMaintenance).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <button className="w-full mt-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-all">
            <Shield size={14} />
            Agendar Manutenção
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
