import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Cpu, Activity, Factory } from 'lucide-react';
import { Asset } from '../types';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: number;
  status?: 'positive' | 'negative' | 'neutral';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  trend,
}) => {
  return (
    <div className="saas-card saas-card-hover p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-primary">
          <Icon size={18} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      
      <span className="section-title !mb-1">{title}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-foreground dark:text-white tabular-nums tracking-tight">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
};

interface AssetTileProps {
  asset: Asset;
  isSelected: boolean;
  onClick: (id: string) => void;
}

export const AssetTile: React.FC<AssetTileProps> = ({ asset, isSelected, onClick }) => {
  const statusConfig = {
    critical: { border: 'border-l-red-500', text: 'text-red-500', label: 'Crítico', dot: 'bg-red-500' },
    warning: { border: 'border-l-amber-500', text: 'text-amber-500', label: 'Alerta', dot: 'bg-amber-500' },
    normal: { border: 'border-l-emerald-500', text: 'text-emerald-500', label: 'Normal', dot: 'bg-emerald-500' },
    offline: { border: 'border-l-slate-500', text: 'text-slate-500', label: 'Offline', dot: 'bg-slate-500' },
  };

  const cfg = statusConfig[asset.status] || statusConfig.normal;

  return (
    <div
      onClick={() => onClick(asset.id)}
      className={`saas-card saas-card-hover p-5 cursor-pointer border-l-4 ${cfg.border} ${
        isSelected ? 'bg-slate-800/50 border-primary/50' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-slate-800 text-muted'}`}>
          <Factory size={20} />
        </div>
        <div className={`badge ${cfg.text} bg-slate-800/50 border-slate-700/50`}>
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
          {cfg.label}
        </div>
      </div>

      <h4 className="font-bold text-sm text-foreground dark:text-white mb-0.5 truncate">{asset.name}</h4>
      <p className="text-[10px] text-muted font-medium uppercase tracking-wider mb-4">{asset.location}</p>

      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
        <div>
          <span className="text-[9px] font-bold text-muted uppercase tracking-tight">Uptime</span>
          <p className="text-xs font-bold text-foreground dark:text-white">{asset.uptime.toFixed(1)}%</p>
        </div>
        <div>
          <span className="text-[9px] font-bold text-muted uppercase tracking-tight">Sensores</span>
          <p className="text-xs font-bold text-foreground dark:text-white">{asset.sensors.length}</p>
        </div>
      </div>

      {asset.anomalyScore > 40 && (
        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-red-500">
          <Activity size={12} className="animate-pulse" />
          <span>Anomalia detectada: {asset.anomalyScore}%</span>
        </div>
      )}
    </div>
  );
};
