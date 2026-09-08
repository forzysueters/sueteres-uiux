import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { AvatarState } from './types';

interface AvatarFaceProps {
  size?: number;
  state?: AvatarState;
  /** Anel de dados orbitando a cabeça. Some nos tamanhos muito pequenos. */
  orbit?: boolean;
  className?: string;
}

/**
 * Órion — o personagem.
 *
 * Desenhado em SVG puro (nada de imagem raster) para ficar nítido de 32 a 320px
 * e para que a cor de destaque acompanhe o tema do site: tudo que é âmbar aqui
 * lê `--primary-rgb`, então o avatar troca de cor junto com a plataforma.
 *
 * As decisões de forma são deliberadas, para não cair no robô genérico nem no
 * mascote infantil:
 *   • cabeça em "squircle" grafite, como um produto industrial, não uma bolinha;
 *   • olhos em fresta dentro de um visor — leitura de HUD, não de desenho animado;
 *   • a boca é um equalizador de 5 barras: fala é dado, não lábio;
 *   • anel de dados com marcações, evocando telemetria orbitando o rosto.
 */
export const AvatarFace: React.FC<AvatarFaceProps> = ({
  size = 120,
  state = 'idle',
  orbit = true,
  className,
}) => {
  // IDs precisam ser únicos: o launcher e o painel montam dois avatares juntos.
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `orion-${name}-${uid}`;

  const speaking = state === 'speaking';
  const thinking = state === 'thinking';
  const listening = state === 'listening';

  // Barras da boca: desenhadas na altura máxima e escaladas a partir do centro.
  // `rest` é a fração da altura que sobra em silêncio — quase uma linha reta.
  const MOUTH_Y = 74;
  const mouthBars = [
    { x: 47.5, h: 7, rest: 0.34 },
    { x: 53, h: 12, rest: 0.26 },
    { x: 58.5, h: 15, rest: 0.24 },
    { x: 64, h: 11, rest: 0.28 },
    { x: 69.5, h: 6.5, rest: 0.36 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Órion, assistente virtual"
    >
      <defs>
        <linearGradient id={id('head')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A3345" />
          <stop offset="45%" stopColor="#1A2130" />
          <stop offset="100%" stopColor="#0D1119" />
        </linearGradient>
        <linearGradient id={id('bust')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#232C3D" />
          <stop offset="100%" stopColor="#10141D" />
        </linearGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(var(--primary-rgb), 0.9)" />
          <stop offset="55%" stopColor="rgba(var(--primary-rgb), 0.15)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
        </linearGradient>
        <radialGradient id={id('aura')} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="rgba(var(--primary-rgb), 0.42)" />
          <stop offset="60%" stopColor="rgba(var(--primary-rgb), 0.10)" />
          <stop offset="100%" stopColor="rgba(var(--primary-rgb), 0)" />
        </radialGradient>
        <filter id={id('glow')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.9" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Mantém o busto contido no disco do avatar. */}
        <clipPath id={id('disc')}>
          <circle cx="60" cy="60" r="58" />
        </clipPath>
      </defs>

      {/* ── Halo ─────────────────────────────────────────────────────────── */}
      <motion.circle
        cx="60"
        cy="58"
        r="52"
        fill={`url(#${id('aura')})`}
        animate={{ opacity: speaking ? [0.75, 1, 0.75] : [0.45, 0.68, 0.45] }}
        transition={{ duration: speaking ? 1.6 : 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Anel de dados ────────────────────────────────────────────────── */}
      {orbit && (
        <motion.g
          style={{ originX: '60px', originY: '60px' }}
          animate={{ rotate: 360 }}
          transition={{ duration: thinking ? 5 : 26, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="rgba(var(--primary-rgb), 0.30)"
            strokeWidth="1.2"
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="rgba(var(--primary-rgb), 0.85)"
            strokeWidth="2"
            strokeDasharray="16 323"
            strokeLinecap="round"
          />
          <circle cx="114" cy="60" r="2.4" fill="rgb(var(--primary-rgb))" filter={`url(#${id('glow')})`} />
          <circle cx="6" cy="60" r="1.4" fill="rgba(var(--primary-rgb), 0.6)" />
        </motion.g>
      )}

      {/* ── Corpo (cabeça + busto), com respiração ───────────────────────── */}
      <motion.g
        clipPath={`url(#${id('disc')})`}
        animate={{ y: [0, -1.4, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Busto */}
        <path
          d="M22 120 C22 98, 38 89, 60 89 C82 89, 98 98, 98 120 Z"
          fill={`url(#${id('bust')})`}
          stroke="rgba(var(--primary-rgb), 0.22)"
          strokeWidth="1"
        />
        {/* Gola / indicador de status no peito */}
        <path
          d="M44 97 Q60 106 76 97"
          fill="none"
          stroke="rgba(var(--primary-rgb), 0.55)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <motion.circle
          cx="60"
          cy="108"
          r="2.6"
          fill="rgb(var(--primary-rgb))"
          filter={`url(#${id('glow')})`}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Módulos laterais (fones) */}
        {[
          { x: 25.5, delay: 0 },
          { x: 88.5, delay: 0.6 },
        ].map(({ x, delay }) => (
          <g key={x}>
            <rect x={x} y="50" width="6" height="18" rx="3" fill="#1A2130" stroke="rgba(var(--primary-rgb), 0.35)" strokeWidth="0.9" />
            <motion.rect
              x={x + 1.8}
              y="54"
              width="2.4"
              height="10"
              rx="1.2"
              fill="rgb(var(--primary-rgb))"
              animate={{ opacity: [0.3, 0.95, 0.3] }}
              transition={{ duration: 2.8, repeat: Infinity, delay, ease: 'easeInOut' }}
            />
          </g>
        ))}

        {/* Cabeça */}
        <rect
          x="30"
          y="22"
          width="60"
          height="64"
          rx="24"
          fill={`url(#${id('head')})`}
          stroke={`url(#${id('rim')})`}
          strokeWidth="1.4"
        />
        {/* Brilho superior — dá volume sem sombra pesada */}
        <path
          d="M38 34 Q60 24 82 34"
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Antena / indicador de atividade */}
        <line x1="60" y1="22" x2="60" y2="15" stroke="rgba(var(--primary-rgb), 0.5)" strokeWidth="1.4" strokeLinecap="round" />
        <motion.circle
          cx="60"
          cy="12.5"
          r="3"
          fill="rgb(var(--primary-rgb))"
          filter={`url(#${id('glow')})`}
          style={{ originX: '60px', originY: '12.5px' }}
          animate={{
            opacity: thinking ? [0.3, 1, 0.3] : [0.6, 1, 0.6],
            scale: thinking ? [0.8, 1.25, 0.8] : [1, 1, 1],
          }}
          transition={{ duration: thinking ? 0.9 : 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Visor */}
        <rect x="36" y="40" width="48" height="21" rx="10.5" fill="#070A11" stroke="rgba(var(--primary-rgb), 0.28)" strokeWidth="0.9" />

        {/* Olhos — piscam e olham em volta */}
        <motion.g
          filter={`url(#${id('glow')})`}
          animate={{ x: listening ? [0, 1.6, 0, -1.6, 0] : [0, 1.2, 0, -1.2, 0] }}
          transition={{ duration: listening ? 3.2 : 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.g
            style={{ originX: '60px', originY: '50.5px' }}
            animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
            transition={{
              duration: 5.4,
              repeat: Infinity,
              times: [0, 0.93, 0.955, 0.98, 1],
              ease: 'easeInOut',
            }}
          >
            <rect x="45" y="47" width="11" height="7" rx="3.5" fill="rgb(var(--primary-rgb))" />
            <rect x="64" y="47" width="11" height="7" rx="3.5" fill="rgb(var(--primary-rgb))" />
          </motion.g>
        </motion.g>

        {/* Boca-equalizador — a fala vira forma de onda */}
        <g>
          {mouthBars.map((bar, i) => (
            <motion.rect
              key={bar.x}
              x={bar.x}
              y={MOUTH_Y - bar.h / 2}
              width="3"
              height={bar.h}
              rx="1.5"
              fill="rgb(var(--primary-rgb))"
              style={{ originX: `${bar.x + 1.5}px`, originY: `${MOUTH_Y}px` }}
              initial={false}
              animate={
                speaking
                  ? {
                      scaleY: [bar.rest, 1, bar.rest * 1.9, 0.78, bar.rest],
                      opacity: 1,
                    }
                  : { scaleY: bar.rest, opacity: thinking ? 0.35 : 0.75 }
              }
              transition={
                speaking
                  ? {
                      duration: 0.52 + i * 0.05,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.04,
                    }
                  : { duration: 0.3 }
              }
            />
          ))}
        </g>
      </motion.g>

      {/* ── Partículas de dado ───────────────────────────────────────────── */}
      {orbit &&
        [
          { cx: 18, cy: 34, d: 0 },
          { cx: 102, cy: 40, d: 1.3 },
          { cx: 96, cy: 92, d: 2.4 },
        ].map(({ cx, cy, d }) => (
          <motion.rect
            key={`${cx}-${cy}`}
            x={cx}
            y={cy}
            width="3"
            height="3"
            rx="0.8"
            fill="rgba(var(--primary-rgb), 0.75)"
            animate={{ y: [0, -6, 0], opacity: [0, 0.9, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, delay: d, ease: 'easeInOut' }}
          />
        ))}
    </svg>
  );
};
