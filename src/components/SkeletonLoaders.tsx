import React from 'react';

const shimmerStyle: React.CSSProperties = {
  background:
    'linear-gradient(90deg, transparent 25%, rgba(var(--primary-rgb), 0.12) 50%, transparent 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 2s linear infinite',
};

const baseCardClass = 'bg-card-hover border border-border rounded-xl';

export const SkeletonLoader: React.FC<{ count?: number; height?: string }> = ({ count = 3, height = 'h-8' }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`${height} rounded-xl`} style={shimmerStyle} />
    ))}
  </div>
);

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`${baseCardClass} p-5`}>
        <div className="flex items-start justify-between mb-5">
          <div className="w-10 h-10 rounded-xl" style={shimmerStyle} />
          <div className="h-4 w-10 rounded-md" style={shimmerStyle} />
        </div>
        <div className="h-3 w-24 rounded-full mb-2" style={shimmerStyle} />
        <div className="h-8 w-20 rounded-lg" style={shimmerStyle} />
      </div>
    ))}
  </div>
);

export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 280 }) => (
  <div className={`${baseCardClass} p-6`}>
    <div className="h-3 w-40 rounded-full mb-5" style={shimmerStyle} />
    <div className="rounded-xl" style={{ ...shimmerStyle, height }} />
  </div>
);

export const AlertSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`${baseCardClass} p-4`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex-shrink-0" style={shimmerStyle} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded-full" style={shimmerStyle} />
            <div className="h-3 w-full rounded-full" style={shimmerStyle} />
            <div className="h-3 w-3/4 rounded-full" style={shimmerStyle} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/** Spinner de página inteira — mesmo tratamento visual em todo lugar que hoje improvisa o próprio spinner. */
export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Carregando…' }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-24">
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 rounded-full border-2 border-border" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      <div className="absolute inset-0 rounded-full blur-lg bg-primary/25 animate-pulse" />
    </div>
    <p className="text-sm font-medium text-muted">{label}</p>
  </div>
);
