import React from 'react';
import { AlertTriangle, Loader2, Move, Save, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { cn } from '../lib/utils';

interface PlantLayoutToolbarProps {
  movedCount: number;
  invalidCount: number;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

/** Barra do modo de edição — some junto com o modo. */
export const PlantLayoutToolbar: React.FC<PlantLayoutToolbarProps> = ({
  movedCount, invalidCount, saving, error, onSave, onCancel,
}) => {
  const { language } = useAppStore();
  const t = translations[language].plantLayout;

  const moved = movedCount === 0
    ? t.no_changes
    : movedCount === 1 ? t.moved_one : t.moved_many.replace('{n}', String(movedCount));

  const invalid = invalidCount === 1
    ? t.invalid_one
    : t.invalid_many.replace('{n}', String(invalidCount));

  return (
    <div className="saas-card border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Move size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{t.editing}</p>
            <p className="text-[11px] text-muted leading-relaxed">{t.hint}</p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={cn(
            'text-[11px] font-bold tabular-nums',
            movedCount > 0 ? 'text-primary' : 'text-muted',
          )}>
            {moved}
          </span>
          <button
            onClick={onCancel}
            disabled={saving}
            className="btn-ghost text-xs disabled:opacity-40"
          >
            <X size={14} />
            {t.cancel}
          </button>
          <button
            onClick={onSave}
            // Layout inválido não pode virar estado salvo: um ativo sobreposto
            // a outro passaria a valer para a planta, o 3D e o assistente.
            disabled={saving || invalidCount > 0 || movedCount === 0}
            className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" />{t.saving}</>
              : <><Save size={14} />{t.save}</>}
          </button>
        </div>
      </div>

      {invalidCount > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-500/90">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium leading-relaxed">
            <span className="font-bold">{invalid}.</span> {t.invalid_hint}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium leading-relaxed">{error}</p>
        </div>
      )}
    </div>
  );
};
