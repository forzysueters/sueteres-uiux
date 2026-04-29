import React from 'react';
import { X, Activity, Clock, AlertTriangle, CheckCircle2, TrendingUp, Sparkles, Settings, Calendar, Zap, Shield } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';

interface AssetDetailPanelProps {
  assetId: string;
  onClose: () => void;
}

export const AssetDetailPanel: React.FC<AssetDetailPanelProps> = ({ assetId, onClose }) => {
  const { assets } = useAppStore();
  const asset = assets.find((a) => a.id === assetId);

  if (!asset) return null;

  const statusConfig = {
    critical: { text: 'text-red-500', label: 'Crítico', icon: AlertTriangle, bg: 'bg-red-500/10' },
    warning: { text: 'text-amber-500', label: 'Alerta', icon: AlertTriangle, bg: 'bg-amber-500/10' },
    normal: { text: 'text-emerald-500', label: 'Normal', icon: CheckCircle2, bg: 'bg-emerald-500/10' },
    offline: { text: 'text-slate-500', label: 'Offline', icon: Clock, bg: 'bg-slate-500/10' },
  };

  const cfg = statusConfig[asset.status] || statusConfig.normal;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-card h-full border-l border-border flex flex-col animate-slide-in-right shadow-panel overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-slate-900/20">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.text}`}>
              <cfg.icon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground dark:text-white tracking-tight leading-none mb-1">{asset.name}</h2>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{asset.location}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="saas-card p-4">
              <span className="section-title !mb-2 flex items-center gap-2">
                <Activity size={12} className="text-primary" />
                Disponibilidade Global
              </span>
              <p className="text-2xl font-bold text-foreground dark:text-white tabular-nums">{asset.uptime.toFixed(1)}%</p>
            </div>
            <div className="saas-card p-4">
              <span className="section-title !mb-2 flex items-center gap-2">
                <TrendingUp size={12} className={asset.anomalyScore > 50 ? 'text-red-400' : 'text-emerald-400'} />
                Índice de Anomalia
              </span>
              <p className={`text-2xl font-bold tabular-nums ${asset.anomalyScore > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                {asset.anomalyScore}%
              </p>
            </div>
          </div>

          {/* AI Insights Section */}
          <div className="p-5 rounded-xl bg-primary/5 border border-primary/10 relative group">
            <div className="absolute top-4 right-4 text-primary/20 group-hover:text-primary/40 transition-colors">
              <Sparkles size={24} />
            </div>
            <h3 className="text-xs font-bold text-primary flex items-center gap-2 mb-3">
              <Zap size={14} />
              INSIGHTS PREDITIVOS IA
            </h3>
            <p className="text-sm text-amber-900 dark:text-amber-200/70 leading-relaxed mb-4">
              Os padrões de vibração atuais sugerem um <strong>desgaste de rolamento de 12%</strong>. Recomenda-se agendar uma lubrificação preventiva nos próximos 15 dias para evitar paradas não planejadas.
            </p>
            <div className="flex items-center gap-6 pt-4 border-t border-primary/10">
              <div>
                <span className="text-[9px] font-bold text-primary/60 uppercase">Vida Útil Restante</span>
                <p className="text-sm font-bold text-foreground dark:text-white">~ 240 dias</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-primary/60 uppercase">Confiança</span>
                <p className="text-sm font-bold text-foreground dark:text-white">94%</p>
              </div>
            </div>
          </div>

          {/* Sensors List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="section-title !mb-0 flex items-center gap-2">
                <Settings size={14} className="text-muted" />
                TELEMETRIA DE SENSORES
              </span>
              <span className="text-[10px] font-bold text-muted uppercase">{asset.sensors.length} ATIVOS</span>
            </div>
            <div className="space-y-2">
              {asset.sensors.map((sensor) => (
                <div
                  key={sensor.id}
                  className="saas-card p-4 flex items-center justify-between hover:bg-slate-800/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-sm font-medium text-slate-300">{sensor.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground dark:text-white">{sensor.value}</span>
                      <span className="text-[10px] font-medium text-muted ml-1 uppercase">{sensor.unit}</span>
                    </div>
                    <span className={`badge ${sensor.status === 'normal' ? 'badge-success' : 'badge-critical'} text-[8px]`}>
                      {sensor.status === 'normal' ? 'OK' : 'FALHA'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Performance Trend */}
          <section>
            <span className="section-title flex items-center gap-2">
              <TrendingUp size={14} className="text-muted" />
              TENDÊNCIA HISTÓRICA (24H)
            </span>
            <div className="h-40 w-full saas-card p-4 bg-slate-900/50">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={Array.from({ length: 12 }).map((_, i) => ({ time: i, val: 40 + Math.random() * 20 }))}>
                  <Area type="monotone" dataKey="val" stroke="var(--primary)" strokeWidth={2} fill="var(--primary)" fillOpacity={0.05} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Maintenance List */}
          <section>
            <span className="section-title flex items-center gap-2">
              <Calendar size={14} className="text-muted" />
              PRÓXIMAS MANUTENÇÕES
            </span>
            <div className="space-y-2">
              {[
                { type: 'Preventiva', date: '12 de Maio, 2026', tech: 'Carlos Silva', status: 'Agendada' },
                { type: 'Calibração', date: '28 de Junho, 2026', tech: 'Ana Souza', status: 'Pendente' },
              ].map((m, i) => (
                <div
                  key={i}
                  className="saas-card p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center text-muted">
                      <Shield size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground dark:text-white">{m.type}</p>
                      <p className="text-[10px] text-muted">{m.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-muted mb-1">{m.tech}</p>
                    <span className="text-[9px] font-bold text-primary uppercase tracking-widest">{m.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-border bg-card">
          <button className="w-full btn-primary !rounded-lg !py-3">
            Gerar Relatório Detalhado
          </button>
        </div>
      </div>
    </div>
  );
};
