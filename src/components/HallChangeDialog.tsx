import React from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { Dialog } from './Dialog';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import type { PendingMove } from '../hooks/usePlantLayoutEditor';

interface HallChangeDialogProps {
  move: PendingMove | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação de troca de hall.
 *
 * Aparece no DROP, não no Salvar: é neste instante que o usuário tem o contexto
 * do que acabou de arrastar. Confirmar muda a área do ativo, o que vale para a
 * planta, o dashboard e o assistente — bem mais que mover uns pixels.
 */
export const HallChangeDialog: React.FC<HallChangeDialogProps> = ({ move, onConfirm, onCancel }) => {
  const { language } = useAppStore();
  const t = translations[language].plantLayout;

  return (
    <Dialog
      open={move !== null}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title={t.hall_change_title}
      description={t.hall_change_desc}
    >
      {move && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card-hover p-4 space-y-2">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[10px] font-mono text-primary">
                {move.asset.tag}
              </span>
              <span className="truncate">{move.asset.name}</span>
            </p>
            <p className="flex items-center gap-2 text-xs">
              <span className="text-muted">{move.from?.area ?? '—'}</span>
              <ArrowRight size={13} className="text-primary flex-shrink-0" />
              <span className="font-bold text-foreground">{move.to.area}</span>
            </p>
          </div>

          {/* `location` é texto escrito por gente ("Hall A — Posto 1").
              Reescrevê-lo automaticamente destruiria informação. */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-card-hover border border-border">
            <Info size={14} className="flex-shrink-0 mt-0.5 text-muted" />
            <p className="text-[11px] text-muted leading-relaxed">{t.hall_change_location}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onCancel}
              className="h-10 rounded-lg font-bold text-xs bg-card-hover border border-border text-muted hover:bg-border transition-all sm:flex-1"
            >
              {t.hall_change_cancel}
            </button>
            <button
              onClick={onConfirm}
              className="h-10 rounded-lg font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all flex items-center justify-center gap-2 sm:flex-[2]"
            >
              <ArrowRight size={14} />
              {t.hall_change_confirm}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
};
