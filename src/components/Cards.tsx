import React from 'react';
import { AlertCircle, AlertTriangle, Activity } from 'lucide-react';
import { Asset } from '../types';

interface StatusIndicatorProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, size = 'md' }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'offline':
        return 'text-slate-500';
      default:
        return 'text-green-400';
    }
  };

  const getStatusBgColor = () => {
    switch (status) {
      case 'critical':
        return 'bg-red-500/20';
      case 'warning':
        return 'bg-yellow-500/20';
      case 'offline':
        return 'bg-slate-500/20';
      default:
        return 'bg-green-500/20';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };

  return (
    <div className={`rounded-full ${getSizeClass()} ${getStatusBgColor()} ${getStatusColor()} ${status !== 'offline' ? 'animate-pulse-glow' : ''}`} />
  );
};

interface SensorCardProps {
  label: string;
  value: number;
  unit: string;
  status: string;
  min: number;
  max: number;
  threshold: number;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  label,
  value,
  unit,
  status,
  min,
  max,
  threshold,
}) => {
  const getValueColor = () => {
    switch (status) {
      case 'critical':
        return 'text-red-300';
      case 'warning':
        return 'text-yellow-300';
      default:
        return 'text-green-300';
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case 'critical':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{label}</span>
        <StatusIndicator status={status} size="sm" />
      </div>
      <div className={`text-2xl font-bold ${getValueColor()} mb-3`}>
        {value.toFixed(2)} <span className="text-sm text-slate-400">{unit}</span>
      </div>
      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Min: {min.toFixed(1)}</span>
          <span>Threshold: {threshold.toFixed(1)}</span>
          <span>Max: {max.toFixed(1)}</span>
        </div>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-full rounded-full transition-all ${getProgressColor()}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
};

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: number;
  status?: 'positive' | 'negative' | 'neutral';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  icon,
  trend,
  status = 'neutral',
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'positive':
        return 'text-green-400';
      case 'negative':
        return 'text-red-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-800/25 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-all">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
        <div className={`${getStatusColor()}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${getStatusColor()}`}>{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={`text-xs mt-3 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last hour
        </div>
      )}
    </div>
  );
};

interface AssetTileProps {
  asset: Asset;
  isSelected: boolean;
  onClick: (id: string) => void;
}

export const AssetTile: React.FC<AssetTileProps> = ({ asset, isSelected, onClick }) => {
  const getStatusColor = () => {
    switch (asset.status) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10 hover:bg-red-500/15';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/15';
      case 'offline':
        return 'border-slate-600/50 bg-slate-700/10 hover:bg-slate-700/15';
      default:
        return 'border-green-500/50 bg-green-500/10 hover:bg-green-500/15';
    }
  };

  const getTypeIcon = () => {
    switch (asset.type) {
      case 'motor':
        return '⚙️';
      case 'pump':
        return '💧';
      case 'compressor':
        return '💨';
      case 'fan':
        return '🌀';
      default:
        return '🔧';
    }
  };

  return (
    <button
      onClick={() => onClick(asset.id)}
      className={`relative border-2 rounded-lg p-4 transition-all cursor-pointer group ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-400'
          : `${getStatusColor()}`
      }`}
    >
      <div className="text-2xl mb-2">{getTypeIcon()}</div>
      <h4 className="font-semibold text-sm text-slate-100 text-left mb-1">{asset.name}</h4>
      <p className="text-xs text-slate-400 text-left mb-3">{asset.location}</p>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <StatusIndicator status={asset.status} size="sm" />
          <span className="text-xs text-slate-400 capitalize">{asset.status}</span>
        </div>
        <span className="text-xs font-mono text-slate-400">{asset.uptime.toFixed(1)}%</span>
      </div>
      {asset.anomalyScore > 50 && (
        <div className="text-xs text-red-300 bg-red-500/20 rounded px-2 py-1">
          Anomaly: {asset.anomalyScore.toFixed(0)}%
        </div>
      )}
    </button>
  );
};
