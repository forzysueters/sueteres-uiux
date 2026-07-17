import React from 'react';
import { Sensor } from '../types';
import { cn } from '../lib/utils';

interface SensorGaugeProps {
  sensor: Sensor;
  compact?: boolean;
}

export const SensorGauge: React.FC<SensorGaugeProps> = ({ sensor, compact = false }) => {
  const pct = Math.min(100, Math.max(0, ((sensor.value - sensor.min) / (sensor.max - sensor.min)) * 100));
  const thresholdPct = Math.min(100, ((sensor.threshold - sensor.min) / (sensor.max - sensor.min)) * 100);

  const isOver = sensor.value >= sensor.threshold;
  const barColor = sensor.status === 'critical'
    ? 'bg-red-500'
    : sensor.status === 'warning' || isOver
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-muted truncate">{sensor.name}</span>
            <span className={cn('text-[11px] font-bold tabular-nums', isOver ? 'text-amber-400' : 'text-foreground')}>
              {sensor.value.toFixed(1)} <span className="text-muted font-normal">{sensor.unit}</span>
            </span>
          </div>
          <div className="relative h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-400/70"
              style={{ left: `${thresholdPct}%` }}
            />
          </div>
        </div>
        <span className={cn(
          'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0',
          sensor.status === 'normal' && !isOver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400',
        )}>
          {sensor.status === 'normal' && !isOver ? 'OK' : 'ALT'}
        </span>
      </div>
    );
  }

  return (
    <div className="saas-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-muted uppercase tracking-wider">{sensor.name}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={cn(
              'text-2xl font-bold tabular-nums',
              sensor.status === 'critical' ? 'text-red-400'
              : isOver ? 'text-amber-400'
              : 'text-foreground',
            )}>
              {sensor.value.toFixed(1)}
            </span>
            <span className="text-sm text-muted">{sensor.unit}</span>
          </div>
        </div>
        <span className={cn(
          'text-[9px] font-bold px-2 py-1 rounded-md uppercase',
          sensor.status === 'normal' && !isOver
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
        )}>
          {sensor.status === 'normal' && !isOver ? 'Normal' : 'Atenção'}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="relative h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
            style={{ left: `${thresholdPct}%` }}
            title={`Threshold: ${sensor.threshold} ${sensor.unit}`}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted font-mono">
          <span>{sensor.min} {sensor.unit}</span>
          <span className="text-amber-500/70">lim {sensor.threshold} {sensor.unit}</span>
          <span>{sensor.max} {sensor.unit}</span>
        </div>
      </div>
    </div>
  );
};
