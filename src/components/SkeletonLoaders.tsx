import React from 'react';

export const SkeletonLoader: React.FC<{ count?: number; height?: string }> = ({
  count = 3,
  height = 'h-8',
}) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`${height} bg-slate-800 rounded animate-pulse`}
      />
    ))}
  </div>
);

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-slate-900 rounded-lg p-4 border border-slate-800 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-3/4 mb-4" />
        <div className="h-8 bg-slate-800 rounded w-1/2" />
      </div>
    ))}
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
    <div className="h-4 bg-slate-800 rounded w-1/4 mb-6" />
    <div className="h-64 bg-slate-800 rounded animate-pulse" />
  </div>
);
