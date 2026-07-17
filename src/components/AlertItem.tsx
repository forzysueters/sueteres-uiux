import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { Alert } from '../types';

interface AlertItemProps {
  alert: Alert;
  onResolve: (alertId: string) => void;
}

const severityConfig = {
  critical: {
    border: 'border-l-red-500',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-500/10',
    badge: 'badge-critical',
    Icon: AlertCircle,
    label: 'Crítico',
  },
  warning: {
    border: 'border-l-amber-500',
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
    badge: 'badge-warning',
    Icon: AlertTriangle,
    label: 'Alerta',
  },
  info: {
    border: 'border-l-blue-500',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    badge: 'badge-info',
    Icon: Info,
    label: 'Info',
  },
};

export const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve }) => {
  const cfg = severityConfig[alert.severity as keyof typeof severityConfig] ?? severityConfig.info;
  const { Icon } = cfg;

  return (
    <div
      className={`saas-card p-5 border-l-4 ${cfg.border} ${
        alert.resolved ? 'opacity-60 bg-card-hover' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg} ${cfg.iconColor}`}>
          <Icon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-foreground dark:text-white">{alert.title}</h4>
              <span className={`badge ${cfg.badge}`}>
                {cfg.label}
              </span>
              {alert.resolved && (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} />
                  Resolvido
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <Clock size={12} />
              <span className="text-[10px] font-medium font-mono uppercase tracking-tight">
                {new Date(alert.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted mb-3">{alert.description}</p>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest px-2 py-0.5 rounded bg-card-hover border border-border">
              {alert.assetName}
            </span>
          </div>

          {alert.mlInsight && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={14} className="text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Insight IA</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-200/80 leading-relaxed">{alert.mlInsight}</p>
            </div>
          )}

          {!alert.resolved && (
            <div className="mt-4 pt-4 border-t border-border flex justify-end">
              <button
                onClick={() => onResolve && onResolve(alert.id)}
                className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md hover:bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCircle2 size={14} />
                Marcar como Resolvido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
