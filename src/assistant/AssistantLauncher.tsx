import React from 'react';
import { motion } from 'framer-motion';
import { AvatarFace } from './AvatarFace';
import type { AvatarState } from './types';

interface AssistantLauncherProps {
  state: AvatarState;
  label: string;
  /** Chamariz discreto exibido uma única vez, para o usuário novo. */
  teaser?: string | null;
  onOpen: () => void;
}

/**
 * Estado minimizado: um disco no canto inferior direito.
 *
 * Discreto por padrão — a única animação constante é um anel que respira. O
 * chamariz de texto só aparece para quem ainda não fez o tour, e some assim que
 * o painel abre.
 */
export const AssistantLauncher: React.FC<AssistantLauncherProps> = ({
  state,
  label,
  teaser,
  onOpen,
}) => (
  <div className="fixed bottom-4 right-4 z-[65] flex items-center gap-3 sm:bottom-6 sm:right-6">
    {teaser && (
      <motion.button
        type="button"
        onClick={onOpen}
        initial={{ opacity: 0, x: 12, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="hidden max-w-[210px] rounded-2xl rounded-br-md border border-border bg-card px-3.5 py-2.5 text-left shadow-panel sm:block"
      >
        <span className="block text-[11px] font-semibold leading-snug text-foreground">
          {teaser}
        </span>
      </motion.button>
    )}

    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      initial={{ opacity: 0, scale: 0.6, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
      className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-panel sm:h-16 sm:w-16"
    >
      {/* Anel de disponibilidade */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: 'rgba(var(--primary-rgb), 0.55)' }}
        animate={{ scale: [1, 1.22, 1], opacity: [0.55, 0, 0.55] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: '0 0 26px -6px rgba(var(--primary-rgb), 0.7)' }}
      />
      <AvatarFace size={54} state={state} orbit={false} className="relative sm:hidden" />
      <AvatarFace size={62} state={state} orbit={false} className="relative hidden sm:block" />
    </motion.button>
  </div>
);
