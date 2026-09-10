import React from 'react';
import { motion } from 'framer-motion';
import type { TargetRect } from './useTargetRect';

interface TourSpotlightProps {
  rect: TargetRect | null;
  /** Rótulo curto da etapa, colado ao elemento destacado. */
  label: string;
  stepIndex: number;
  stepCount: number;
  /** Origem do traço de indicação — o avatar dentro do painel. */
  origin: { x: number; y: number } | null;
  onSkip: () => void;
}

const RADIUS = 14;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Holofote do tour: escurece a tela inteira, abre um recorte sobre o elemento
 * da etapa e liga o avatar a ele com um traço pontilhado — é o "apontar".
 *
 * O recorte é feito com máscara SVG em vez de quatro divs, porque assim o
 * retângulo pode ser animado como uma coisa só quando muda de etapa.
 */
export const TourSpotlight: React.FC<TourSpotlightProps> = ({
  rect,
  label,
  stepIndex,
  stepCount,
  origin,
  onSkip,
}) => {
  const hasTarget = !!rect && rect.width > 0 && rect.height > 0;

  // A etiqueta fica acima do alvo; se não couber, desce para baixo dele.
  const labelBelow = hasTarget && rect!.top < 78;
  const labelY = hasTarget ? (labelBelow ? rect!.top + rect!.height + 10 : rect!.top - 34) : 0;

  // Traço do avatar até a borda mais próxima do recorte.
  let connector: string | null = null;
  let anchor: { x: number; y: number } | null = null;
  if (hasTarget && origin) {
    const cx = rect!.left + rect!.width / 2;
    const cy = rect!.top + rect!.height / 2;
    anchor = {
      x: Math.max(rect!.left, Math.min(origin.x, rect!.left + rect!.width)),
      y: Math.max(rect!.top, Math.min(origin.y, rect!.top + rect!.height)),
    };
    // Encosta o traço na borda, não no meio do elemento.
    if (Math.abs(origin.x - cx) > Math.abs(origin.y - cy)) {
      anchor.x = origin.x > cx ? rect!.left + rect!.width : rect!.left;
    } else {
      anchor.y = origin.y > cy ? rect!.top + rect!.height : rect!.top;
    }
    const mx = (origin.x + anchor.x) / 2;
    connector = `M ${origin.x} ${origin.y} Q ${mx} ${anchor.y} ${anchor.x} ${anchor.y}`;
  }

  return (
    <div className="orion-spotlight fixed inset-0 z-[60] pointer-events-none">
      {/* Véu + recorte. Clicar fora encerra o tour, como em qualquer overlay. */}
      <svg className="absolute inset-0 h-full w-full pointer-events-auto" onClick={onSkip}>
        <defs>
          <mask id="orion-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hasTarget && (
              <motion.rect
                initial={false}
                animate={{ x: rect!.left, y: rect!.top, width: rect!.width, height: rect!.height }}
                transition={{ duration: 0.45, ease: EASE }}
                rx={RADIUS}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(4, 6, 12, 0.62)"
          mask="url(#orion-spotlight-mask)"
        />

        {/* Traço de indicação avatar → elemento */}
        {connector && (
          <motion.path
            key={`c-${stepIndex}`}
            d={connector}
            fill="none"
            stroke="rgba(var(--primary-rgb), 0.65)"
            strokeWidth="1.5"
            strokeDasharray="5 6"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          />
        )}
        {anchor && (
          <motion.circle
            cx={anchor.x}
            cy={anchor.y}
            r="4"
            fill="rgb(var(--primary-rgb))"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.4, 1] }}
            transition={{ duration: 0.5, delay: 0.55, ease: EASE }}
          />
        )}
      </svg>

      {/* Moldura luminosa sobre o elemento */}
      {hasTarget && (
        <motion.div
          initial={false}
          animate={{
            top: rect!.top,
            left: rect!.left,
            width: rect!.width,
            height: rect!.height,
          }}
          transition={{ duration: 0.45, ease: EASE }}
          className="absolute rounded-[14px] border-2"
          style={{
            borderColor: 'rgba(var(--primary-rgb), 0.9)',
            boxShadow:
              '0 0 0 1px rgba(var(--primary-rgb), 0.25), 0 0 34px -4px rgba(var(--primary-rgb), 0.55)',
          }}
        >
          <motion.span
            className="absolute inset-0 rounded-[12px] border"
            style={{ borderColor: 'rgba(var(--primary-rgb), 0.55)' }}
            animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 1.012, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}

      {/* Etiqueta da etapa presa ao elemento */}
      {hasTarget && (
        <motion.div
          key={`l-${stepIndex}`}
          initial={{ opacity: 0, y: labelBelow ? -6 : 6 }}
          animate={{ opacity: 1, y: 0, top: labelY, left: rect!.left }}
          transition={{ duration: 0.3, ease: EASE }}
          className="orion-target-label absolute inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 backdrop-blur-md"
          style={{
            borderColor: 'rgba(var(--primary-rgb), 0.35)',
            background: 'rgba(var(--primary-rgb), 0.12)',
          }}
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: 'rgb(var(--primary-rgb))' }}
          >
            {stepIndex + 1}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white">{label}</span>
          <span className="text-[10px] font-medium text-white/55">
            {stepIndex + 1}/{stepCount}
          </span>
        </motion.div>
      )}
    </div>
  );
};
