import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

type Severity = 'ok' | 'info' | 'alerta' | 'critico';

interface HealthGaugeProps {
  /** Índice de Saúde 0–100 (maior = mais saudável) */
  value: number;
  severity?: Severity;
  /** Diâmetro do medidor em px */
  size?: number;
  className?: string;
}

// Cor do arco segue a faixa de saúde (consistente com o resto da tela do ativo).
const colorForHealth = (v: number) => {
  if (v >= 85) return { stroke: '#10b981', text: 'text-emerald-500 dark:text-emerald-400', label: 'Saudável' };
  if (v >= 65) return { stroke: '#f59e0b', text: 'text-amber-500 dark:text-amber-400', label: 'Alerta' };
  return { stroke: '#ef4444', text: 'text-red-500 dark:text-red-400', label: 'Crítico' };
};

const labelForSeverity: Record<Severity, string> = {
  ok: 'Saudável',
  info: 'Estável',
  alerta: 'Alerta',
  critico: 'Crítico',
};

export const HealthGauge: React.FC<HealthGaugeProps> = ({
  value,
  severity,
  size = 176,
  className,
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  const cfg = colorForHealth(clamped);
  const label = severity ? labelForSeverity[severity] : cfg.label;

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Deixa uma pequena folga no topo — arco de ~270° para leitura tipo "gauge".
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const progress = arcLength * (clamped / 100);
  const gapRotation = 135; // início do arco (canto inferior esquerdo)

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: `rotate(${gapRotation}deg)` }}
        aria-hidden
      >
        {/* Trilha de fundo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        {/* Arco de saúde animado */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={cfg.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: arcLength - progress }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${cfg.stroke}66)` }}
        />
      </svg>

      {/* Centro */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-0.5">
          <span className={cn('text-4xl font-bold tabular-nums tracking-tight', cfg.text)}>
            {Math.round(clamped)}
          </span>
          <span className="text-lg font-semibold text-muted">%</span>
        </div>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
          Saúde
        </span>
        <span
          className={cn(
            'mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            cfg.text,
          )}
          style={{ borderColor: `${cfg.stroke}40`, background: `${cfg.stroke}12` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.stroke }} />
          {label}
        </span>
      </div>
    </div>
  );
};
