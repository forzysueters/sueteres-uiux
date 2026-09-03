import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, EyeOff, CheckCircle2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { Asset } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { cn } from '../lib/utils';

type Usage = Awaited<ReturnType<typeof apiService.getAssetUsage>>;
type Mode = 'deactivate' | 'delete';

interface AssetRemovalDialogProps {
  asset: Asset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após a remoção, com o modo efetivamente aplicado. */
  onRemoved: (mode: Mode) => void;
}

/**
 * Confirmação de remoção de ativo.
 *
 * Desativar é sempre oferecido e é o padrão: as views filtram por `is_active`,
 * então o ativo some da aplicação sem que nada seja destruído. Apagar de vez só
 * aparece quando não há sensores, leituras, alertas nem ordens de manutenção —
 * o ON DELETE CASCADE das FKs não pede licença antes de levar a telemetria.
 */
export const AssetRemovalDialog: React.FC<AssetRemovalDialogProps> = ({
  asset, open, onOpenChange, onRemoved,
}) => {
  const { language } = useAppStore();
  const t = translations[language].assetRemoval;

  const [usage, setUsage] = useState<Usage | null>(null);
  const [mode, setMode] = useState<Mode>('deactivate');
  const [confirmTag, setConfirmTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomeça a cada abertura: um diálogo reaberto não pode herdar a TAG já
  // digitada da vez anterior, senão o passo de confirmação vira decorativo.
  useEffect(() => {
    if (!open) return;
    setUsage(null);
    setMode('deactivate');
    setConfirmTag('');
    setError(null);
    apiService.getAssetUsage(asset.id)
      .then(setUsage)
      .catch((err) => setError((err as Error).message));
  }, [open, asset.id]);

  const tagMatches = confirmTag.trim().toUpperCase() === asset.tag.toUpperCase();
  const canDelete = usage?.isEmpty === true;

  const handleConfirm = async () => {
    if (busy || !tagMatches) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'delete') {
        await apiService.deleteAsset(asset.id);
      } else {
        await apiService.deactivateAsset(asset.id);
      }
      onRemoved(mode);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message || t.error);
    } finally {
      setBusy(false);
    }
  };

  const rows: { label: string; value: number }[] = usage ? [
    { label: t.usage_sensors, value: usage.sensors },
    { label: t.usage_readings, value: usage.readings },
    { label: t.usage_alerts, value: usage.alerts },
    { label: t.usage_orders, value: usage.maintenanceOrders },
  ] : [];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title.replace('{tag}', asset.tag)}
      description={t.subtitle}
    >
      <div className="space-y-4">
        {/* O que está pendurado no ativo */}
        {usage === null ? (
          <div className="flex items-center gap-2 text-xs text-muted py-4">
            <Loader2 size={14} className="animate-spin" />
            {t.checking}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card-hover p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">{t.usage_title}</p>
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-muted">{label}</span>
                <span className={cn('font-bold tabular-nums', value > 0 ? 'text-amber-400' : 'text-muted-soft')}>
                  {value.toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US')}
                </span>
              </div>
            ))}
            {usage.isEmpty && (
              <p className="flex items-center gap-1.5 pt-2 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 size={12} />
                {t.is_empty}
              </p>
            )}
          </div>
        )}

        {/* Escolha do modo */}
        {usage !== null && (
          <div className="space-y-2">
            {([
              { id: 'deactivate' as Mode, icon: EyeOff, label: t.mode_deactivate, hint: t.mode_deactivate_hint, disabled: false },
              { id: 'delete' as Mode, icon: Trash2, label: t.mode_delete, hint: canDelete ? t.mode_delete_hint : t.mode_delete_blocked, disabled: !canDelete },
            ]).map(({ id, icon: Icon, label, hint, disabled }) => (
              <button
                key={id}
                type="button"
                disabled={disabled || busy}
                onClick={() => setMode(id)}
                className={cn(
                  'w-full p-3 rounded-lg border text-left transition-all',
                  mode === id
                    ? (id === 'delete' ? 'bg-red-500/5 border-red-500/40' : 'bg-primary/5 border-primary/40')
                    : 'bg-card-hover border-border hover:border-primary/30',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                <span className="flex items-center gap-2 font-bold text-xs text-foreground">
                  <Icon size={13} className={mode === id ? (id === 'delete' ? 'text-red-400' : 'text-primary') : 'text-muted'} />
                  {label}
                </span>
                <span className="block text-[11px] text-muted mt-1 leading-relaxed">{hint}</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'delete' && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium leading-relaxed">{t.delete_warning}</p>
          </div>
        )}

        {/* Confirmação por TAG */}
        {usage !== null && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">
              {t.confirm_label.replace('{tag}', asset.tag)}
            </label>
            <input
              value={confirmTag}
              onChange={(e) => setConfirmTag(e.target.value)}
              placeholder={asset.tag}
              autoComplete="off"
              className="w-full h-10 bg-card-hover border border-border rounded-lg px-3 text-sm font-mono font-medium text-foreground focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium leading-relaxed">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <button
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="h-10 rounded-lg font-bold text-xs bg-card-hover border border-border text-muted hover:bg-border transition-all sm:flex-1 disabled:opacity-40"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || !tagMatches || usage === null}
            className={cn(
              'h-10 rounded-lg font-bold text-xs text-white transition-all flex items-center justify-center gap-2 sm:flex-[2]',
              mode === 'delete' ? 'bg-red-500 hover:bg-red-500/90' : 'bg-primary hover:bg-primary/90',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {busy
              ? <><Loader2 size={14} className="animate-spin" />{t.working}</>
              : <>{mode === 'delete' ? <Trash2 size={14} /> : <EyeOff size={14} />}
                  {mode === 'delete' ? t.confirm_delete : t.confirm_deactivate}</>}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
