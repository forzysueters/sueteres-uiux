import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, Crosshair, WifiOff } from 'lucide-react';
import { Asset } from '../types';
import { byTriage, statusConfig, statusLabel, worstSensor } from '../utils/plantStatus';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { cn } from '../lib/utils';

/**
 * Régua de triagem — HTML puro, fora do canvas.
 *
 * Este é o instrumento real de triagem: a cena 3D dá o contexto espacial, mas
 * a resposta para "o que está ruim agora?" tem que estar legível sem depender
 * de enxergar nenhuma máquina.
 */

interface PlantAlertRailProps {
  assets: Asset[];
  selectedAssetId: string | null;
  /** Um clique aproxima a câmera. */
  onFocus: (id: string) => void;
  /** O botão abre a página do ativo. */
  onOpen: (id: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export const PlantAlertRail: React.FC<PlantAlertRailProps> = ({
  assets,
  selectedAssetId,
  onFocus,
  onOpen,
}) => {
  const { language } = useAppStore();
  const t = translations[language].plantAlertRail;
  const common = translations[language].common;
  const ordered = useMemo(() => [...assets].sort(byTriage), [assets]);
  const needsAttention = ordered.filter((a) => a.status === 'critical' || a.status === 'warning');
  const healthy = ordered.length - needsAttention.length;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="section-title">{t.triage}</span>
        <span className="font-mono text-[10px] text-muted">
          {needsAttention.length} {t.of} {ordered.length} {t.need_attention}
        </span>
      </div>

      {needsAttention.length === 0 && ordered.length > 0 && (
        <div className="saas-card flex items-center gap-2 p-4">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span className="text-xs font-semibold text-foreground">
            {t.no_active_alerts}
          </span>
        </div>
      )}

      <motion.ul
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="scrollbar-thin flex-1 space-y-2 overflow-y-auto pr-1"
      >
        {ordered.map((asset) => {
          const cfg = statusConfig(asset.status);
          const sensor = worstSensor(asset);
          const isSelected = selectedAssetId === asset.id;
          const urgent = asset.status === 'critical' || asset.status === 'warning';

          return (
            <motion.li key={asset.id} variants={itemVariants}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onFocus(asset.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onFocus(asset.id);
                  }
                }}
                className={cn(
                  'saas-card group w-full cursor-pointer p-3 text-left transition-all hover:border-primary/40',
                  isSelected && 'border-primary/50 bg-primary/5',
                  !urgent && 'opacity-70 hover:opacity-100',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', urgent && 'animate-pulse')}
                    style={{ backgroundColor: cfg.fill }}
                  />
                  <span className="font-mono text-[11px] font-bold text-foreground">{asset.tag}</span>
                  <span
                    className="ml-auto text-[9px] font-bold uppercase tracking-wide"
                    style={{ color: cfg.fill }}
                  >
                    {statusLabel(asset.status, language)}
                  </span>
                </div>

                <p className="mt-1.5 truncate text-[11px] font-medium text-foreground-soft">
                  {asset.name}
                </p>
                <p className="text-[10px] text-muted">{asset.area}</p>

                {/* O "porquê" do alerta */}
                {sensor && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-card-hover px-2 py-1">
                    <AlertTriangle size={10} style={{ color: cfg.fill }} />
                    <span className="text-[10px] text-muted">{sensor.name}</span>
                    <span className="ml-auto font-mono text-[10px] font-bold text-foreground">
                      {sensor.value.toFixed(1)}
                      <span className="ml-0.5 font-normal text-muted">{sensor.unit}</span>
                    </span>
                  </div>
                )}

                {asset.status === 'offline' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
                    <WifiOff size={10} />
                    {t.no_comm}
                  </div>
                )}

                {/* Anomalia
                    O rótulo não é enfeite: a barra fica logo abaixo do valor do
                    sensor, e sem ele o "70%" era lido como percentual DAQUELE
                    sensor — "a pressão está em 70%?". É o índice de anomalia do
                    ativo inteiro, grandeza diferente da linha de cima. */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-wide text-muted">
                    {common.anomaly}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(asset.anomalyScore, 100)}%`,
                        backgroundColor: cfg.fill,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[9px] font-bold text-muted">
                    {asset.anomalyScore}%
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                  <span className="flex items-center gap-1 text-[9px] text-muted">
                    <Crosshair size={9} />
                    {t.focus}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(asset.id);
                    }}
                    className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-primary transition-colors hover:bg-primary/10"
                  >
                    {t.inspect}
                    <ArrowRight size={9} />
                  </button>
                </div>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>

      {healthy > 0 && (
        <p className="text-center text-[10px] text-muted">
          {healthy} {healthy === 1 ? t.all_normal_singular : t.all_normal_plural}
        </p>
      )}
    </div>
  );
};
