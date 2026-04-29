import React from 'react';

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.02) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 2s linear infinite',
};

const baseCard: React.CSSProperties = {
  background: 'rgba(15,22,35,0.8)',
  border: '1px solid rgba(124,58,237,0.1)',
  borderRadius: '0.75rem',
};

export const SkeletonLoader: React.FC<{ count?: number; height?: string }> = ({ count = 3, height = 'h-8' }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`${height} rounded-xl`} style={shimmerStyle} />
    ))}
  </div>
);

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl p-5" style={baseCard}>
        <div className="flex items-start justify-between mb-4">
          <div className="h-3 w-24 rounded-full" style={shimmerStyle} />
          <div className="w-9 h-9 rounded-xl" style={shimmerStyle} />
        </div>
        <div className="h-10 w-20 rounded-lg mb-3" style={shimmerStyle} />
        <div className="h-3 w-32 rounded-full" style={shimmerStyle} />
      </div>
    ))}
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="rounded-xl p-6" style={baseCard}>
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-6 rounded-full" style={{ background: 'rgba(124,58,237,0.2)' }} />
      <div className="h-4 w-40 rounded-full" style={shimmerStyle} />
    </div>
    <div className="h-64 rounded-xl" style={shimmerStyle} />
  </div>
);

export const AlertSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl p-4 overflow-hidden" style={{ ...baseCard, paddingLeft: '1.25rem' }}>
        <div
          className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
          style={{ background: 'rgba(124,58,237,0.2)' }}
        />
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex-shrink-0" style={shimmerStyle} />
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
