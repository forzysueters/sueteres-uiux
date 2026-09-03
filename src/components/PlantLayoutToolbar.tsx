import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
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

/**
 * Painel do modo de edição da planta.
 *
 * Fica FLUTUANDO no topo da tela, não no fluxo da página. No fluxo ele caía
 * abaixo da cena 3D — fora da primeira dobra —, e quem clicava em "Editar
 * planta" não via nem a instrução nem o botão de salvar.
 *
 * Não é um modal: os controles precisam continuar visíveis enquanto o usuário
 * arrasta as máquinas. É uma barra fixa, que aparece com o modo e acompanha a
 * rolagem. Desenhada em portal sobre o `body` para não herdar `overflow` nem
 * contexto de empilhamento de nenhum contêiner da página.
 */
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      role="region"
      aria-label={t.editing}
      // Abaixo da navbar (h-16 no celular, h-20 a partir de md) e acima do
      // conteúdo, mas sob os diálogos (z-50) — descartar alterações precisa
      // aparecer por cima desta barra.
      className={cn(
        // Centralizado por margem, não por transform: o framer-motion escreve a
        // propriedade `transform` do elemento e apagaria um `-translate-x-1/2`.
        'fixed inset-x-0 z-[45] mx-auto w-[calc(100%-1.5rem)] max-w-3xl',
        'top-[4.75rem] md:top-[5.75rem]',
        'rounded-2xl border border-primary/40 bg-card/95 p-3 sm:p-4 shadow-panel backdrop-blur-xl',
        'space-y-3',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            'text-[11px] font-bold tabular-nums whitespace-nowrap',
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
    </motion.div>,
    document.body,
  );
};
