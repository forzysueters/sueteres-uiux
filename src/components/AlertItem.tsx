import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { Alert } from '../types';

interface AlertItemProps {
  alert: Alert;
  onResolve: (alertId: string) => void | Promise<void>;
  isResolving?: boolean;
}

const getSeverityLabels = (language: 'pt' | 'en') => ({
  critical: language === 'pt' ? 'Crítico' : 'Critical',
  warning: language === 'pt' ? 'Alerta' : 'Warning',
  info: language === 'pt' ? 'Info' : 'Info',
  resolved: language === 'pt' ? 'Resolvido' : 'Resolved',
});

const severityConfig = (language: 'pt' | 'en') => {
  const labels = getSeverityLabels(language);
  return {
    critical: {
      border: 'border-l-red-500',
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      badge: 'badge-critical',
      Icon: AlertCircle,
      label: labels.critical,
    },
    warning: {
      border: 'border-l-amber-500',
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
      badge: 'badge-warning',
      Icon: AlertTriangle,
      label: labels.warning,
    },
    info: {
      border: 'border-l-blue-500',
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      badge: 'badge-info',
      Icon: Info,
      label: labels.info,
    },
  };
};

export const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve, isResolving = false }) => {
  const [showInsight, setShowInsight] = useState(false);
  const navigate = useNavigate();
  const { setSelectedAsset, language } = useAppStore();
  const t = translations[language];
  const cfg = severityConfig(language)[alert.severity as keyof typeof severityConfig];
  const { Icon } = cfg;

  const handleAssetClick = () => {
    setSelectedAsset(alert.assetId);
    navigate('/planta');
  };

  return (
    <div
      className={`saas-card p-4 ${
        alert.resolved ? 'opacity-60 bg-slate-900/50' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg} ${cfg.iconColor}`}>
          <Icon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-foreground dark:text-white">{alert.title}</h4>
              <span className={`badge ${cfg.badge} ${!alert.resolved && alert.severity === 'critical' ? 'animate-badge-pulse-critical' : ''} ${!alert.resolved && alert.severity === 'warning' ? 'animate-badge-pulse-warning' : ''}`}>
                {cfg.label}
              </span>
              {alert.resolved && (
                <span className="badge badge-success">
                  <CheckCircle2 size={12} />
                  {getSeverityLabels(language).resolved}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!alert.resolved && (
                <button
                  onClick={() => onResolve(alert.id)}
                  disabled={isResolving}
                  title={t.alerts.mark_resolved}
                  aria-label={t.alerts.mark_resolved}
                  className="w-8 h-8 rounded-md border border-emerald-500/25 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 inline-flex items-center justify-center transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed motion-safe:animate-pulse"
                >
                  <CheckCircle2 size={14} className={isResolving ? 'animate-spin' : ''} />
                </button>
              )}

              {alert.mlInsight && (
                <button
                  onClick={() => setShowInsight(!showInsight)}
                  title={t.alerts.view_insight}
                  aria-label={t.alerts.view_insight}
                  className="w-8 h-8 rounded-md border border-primary/25 text-primary hover:text-primary hover:bg-primary/10 inline-flex items-center justify-center transition-all hover:scale-105"
                >
                  <Sparkles size={14} />
                </button>
              )}

              <div className="flex items-center gap-1.5 text-muted">
                <Clock size={12} />
                <span className="text-[10px] font-medium font-mono uppercase tracking-tight">
                  {new Date(alert.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <button
              onClick={handleAssetClick}
              className="text-[10px] font-bold text-muted hover:text-primary uppercase tracking-widest px-2 py-0.5 rounded bg-slate-800 border border-border hover:border-primary/50 transition-all cursor-pointer"
              title={`${t.alerts.open_asset} ${alert.assetName}`}
            >
              {alert.assetName}
            </button>
          </div>

          <p className="text-sm text-muted mb-3">{alert.description}</p>

          {alert.mlInsight && showInsight && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={14} className="text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t.alerts.view_insight}</span>
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">{alert.mlInsight}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
