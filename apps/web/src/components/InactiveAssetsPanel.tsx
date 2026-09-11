import React, { useState } from 'react';
import { Archive, RotateCcw, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
import { InactiveAsset } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { cn } from '../lib/utils';

interface InactiveAssetsPanelProps {
  assets: InactiveAsset[];
  /** Chamado após reativar, para recarregar a frota e a própria lista. */
  onReactivated: () => void;
}

/**
 * Ativos desativados, com ação de reativar.
 *
 * Existe porque `v_assets_full` filtra por `is_active`: sem esta lista, um
 * ativo desativado fica invisível em toda a aplicação e não haveria por onde
 * trazê-lo de volta pela interface. Vem recolhida e some quando não há nenhum
 * desativado — no uso normal, nem aparece.
 */
export const InactiveAssetsPanel: React.FC<InactiveAssetsPanelProps> = ({ assets, onReactivated }) => {
  const { language } = useAppStore();
  const t = translations[language].inactiveAssets;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (assets.length === 0) return null;

  const handleReactivate = async (asset: InactiveAsset) => {
    if (busyId) return;
    setBusyId(asset.id);
    setError(null);
    try {
      await apiService.reactivateAsset(asset.id);
      onReactivated();
    } catch (err) {
      setError((err as Error)?.message || t.error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="saas-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 bg-card-hover hover:bg-border/40 transition-colors"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-card-hover border border-border flex items-center justify-center text-muted">
            <Archive size={15} />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-sm font-bold text-foreground">{t.title}</span>
            <span className="block text-[10px] text-muted">{t.subtitle}</span>
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <span className="badge bg-card-hover border-border text-muted px-2.5 py-1 tabular-nums">
            {assets.length}
          </span>
          <ChevronDown size={15} className={cn('text-muted transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="p-4 sm:p-5 space-y-3 border-t border-border">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-col gap-3 p-3 rounded-lg bg-card-hover border border-border sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[9px] font-mono text-primary">
                    {asset.tag}
                  </span>
                  <span className="truncate">{asset.name}</span>
                </p>
                <p className="text-[10px] text-muted mt-1 truncate">
                  {[asset.area, asset.location].filter(Boolean).join(' · ')}
                </p>
                <p className="text-[10px] text-muted-soft mt-0.5">
                  {t.deactivated_at} {new Date(asset.deactivatedAt).toLocaleString(locale)}
                </p>
              </div>
              <button
                onClick={() => handleReactivate(asset)}
                disabled={busyId !== null}
                className="btn-ghost text-xs flex-shrink-0 disabled:opacity-40 disabled:cursor-wait"
              >
                {busyId === asset.id
                  ? <><Loader2 size={13} className="animate-spin" />{t.reactivating}</>
                  : <><RotateCcw size={13} />{t.reactivate}</>}
              </button>
            </div>
          ))}

          <p className="text-[10px] text-muted leading-relaxed pt-1">{t.hint}</p>
        </div>
      )}
    </div>
  );
};
