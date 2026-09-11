import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Sparkles, ChevronDown, ArrowUpRight } from 'lucide-react';
import { Alert } from '../types';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { cn } from '../lib/utils';

interface AlertItemProps {
  alert: Alert;
  onResolve: (alertId: string) => void;
}

// Classes estáticas e completas — o compilador JIT do Tailwind não reconhece
// nomes montados em runtime (ex.: `text-x`.replace(...)), por isso cada
// severidade precisa das strings escritas por extenso.
const severityConfig = {
  critical: { iconColor: 'text-danger', iconBg: 'bg-danger/10', borderL: 'border-l-danger', badge: 'badge-critical', Icon: AlertCircle },
  warning: { iconColor: 'text-warning', iconBg: 'bg-warning/10', borderL: 'border-l-warning', badge: 'badge-warning', Icon: AlertTriangle },
  info: { iconColor: 'text-info', iconBg: 'bg-info/10', borderL: 'border-l-info', badge: 'badge-info', Icon: Info },
};

const SEVERITY_LABELS = {
  pt: { critical: 'Crítico', warning: 'Alerta', info: 'Info' },
  en: { critical: 'Critical', warning: 'Warning', info: 'Info' },
};

export const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve }) => {
  const { language } = useAppStore();
  const t = translations[language].alerts;
  const [insightOpen, setInsightOpen] = useState(false);
  const cfg = severityConfig[alert.severity as keyof typeof severityConfig] ?? severityConfig.info;
  const { Icon } = cfg;

  return (
    <div
      className={cn(
        'saas-card border-l-[3px] transition-opacity',
        alert.resolved ? 'opacity-60 border-l-border-strong' : cfg.borderL,
      )}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cfg.iconBg, cfg.iconColor)}>
          <Icon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h4 className="min-w-0 font-bold text-sm text-foreground break-words">{alert.title}</h4>
              <span className={`badge ${cfg.badge}`}>
                {SEVERITY_LABELS[language][alert.severity as keyof typeof SEVERITY_LABELS['pt']] ?? alert.severity}
              </span>
              {alert.resolved && (
                <span className="badge badge-success">
                  <CheckCircle2 size={11} />
                  {t.resolved_badge}
                </span>
              )}
            </div>
            <span className="flex-shrink-0 text-[10px] font-medium font-mono text-muted-soft">
              {new Date(alert.timestamp).toLocaleTimeString(language === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{alert.description}</p>

          <div className="flex min-w-0 items-center gap-1.5 mt-2 text-[10px] font-medium text-muted-soft">
            <span className="flex-shrink-0 font-mono font-bold text-foreground-soft">{alert.assetTag}</span>
            <span className="text-border-strong">•</span>
            <span className="truncate">{alert.assetName}</span>
          </div>

          {alert.mlInsight && !alert.resolved && (
            <div className="mt-2.5">
              <button
                onClick={() => setInsightOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
              >
                <Sparkles size={12} />
                {t.insight}
                <ChevronDown size={12} className={cn('transition-transform', insightOpen && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {insightOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-muted leading-relaxed mt-2 border-l-2 border-primary/30 pl-3">
                      {alert.mlInsight}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {!alert.resolved && (
              <button
                onClick={() => onResolve(alert.id)}
                className="text-[11px] font-bold text-success hover:text-success/80 flex items-center gap-1.5 transition-colors px-2.5 py-1 rounded-md hover:bg-success/10"
              >
                <CheckCircle2 size={13} />
                {t.resolve}
              </button>
            )}
            <Link
              to={`/planta/ativo/${alert.assetId}`}
              className="text-[11px] font-bold text-muted hover:text-foreground flex items-center gap-1 transition-colors px-2.5 py-1 rounded-md hover:bg-card-hover"
            >
              {t.view_asset}
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
