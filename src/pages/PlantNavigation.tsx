import React, { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { AssetTile } from '../components/Cards';
import { Map, AlertTriangle, CheckCircle2, WifiOff, Info } from 'lucide-react';

export const PlantNavigation: React.FC = () => {
  const { assets, setAssets, selectedAssetId, setSelectedAsset } = useAppStore();

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const data = await apiService.getAssets();
    setAssets(data);
  };

  const maxX = Math.max(...assets.map(a => a.x), 3);
  const maxY = Math.max(...assets.map(a => a.y), 3);

  const totalOnline = assets.filter(a => a.status !== 'offline').length;
  const criticalCount = assets.filter(a => a.status === 'critical').length;
  const warningCount = assets.filter(a => a.status === 'warning').length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center">
              <Map className="w-7 h-7 text-primary" />
            </div>
            Planta / Gêmeo Digital
          </h1>
          <p>
            Layout interativo da fábrica — clique em um ativo para inspecionar a telemetria
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="badge badge-success px-3 py-1.5">
            <CheckCircle2 size={14} />
            {totalOnline} Online
          </div>
          {criticalCount > 0 && (
            <div className="badge badge-critical px-3 py-1.5">
              <AlertTriangle size={14} />
              {criticalCount} Crítico
            </div>
          )}
          {warningCount > 0 && (
            <div className="badge badge-warning px-3 py-1.5">
              <AlertTriangle size={14} />
              {warningCount} Alerta
            </div>
          )}
        </div>
      </div>

      <div className="saas-card p-10 overflow-auto bg-slate-900/30">
        <div
          className="grid gap-8 relative mx-auto"
          style={{
            gridTemplateColumns: `repeat(${maxX}, minmax(220px, 1fr))`,
            gridTemplateRows: `repeat(${maxY}, auto)`,
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          {Array.from({ length: maxX }).map((_, x) =>
            Array.from({ length: maxY }).map((_, y) => {
              const asset = assets.find(a => a.x === x + 1 && a.y === y + 1);

              if (!asset) {
                return (
                  <div
                    key={`empty-${x}-${y}`}
                    className="min-h-[160px] rounded-xl flex flex-col items-center justify-center gap-2 border border-border bg-slate-800/10"
                  >
                    <span className="text-[10px] font-mono text-slate-500">
                      {x + 1}, {y + 1}
                    </span>
                  </div>
                );
              }

              return (
                <div key={asset.id} className="h-full min-h-[160px]">
                  <AssetTile
                    asset={asset}
                    isSelected={selectedAssetId === asset.id}
                    onClick={(id) => setSelectedAsset(selectedAssetId === id ? null : id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="saas-card p-4 flex items-center gap-8 flex-wrap">
        <span className="section-title !mb-0">Legenda</span>
        {[
          { color: 'bg-emerald-500', label: 'Normal' },
          { color: 'bg-amber-500', label: 'Alerta' },
          { color: 'bg-red-500', label: 'Crítico' },
          { color: 'bg-slate-500', label: 'Offline' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-[11px] font-bold text-muted">{label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <WifiOff size={14} className="text-muted" />
          <span className="text-[11px] font-bold text-muted uppercase tracking-tighter">
            {assets.filter(a => a.status === 'offline').length} offline
          </span>
        </div>
      </div>

      {selectedAssetId && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3 text-primary">
          <Info size={16} className="flex-shrink-0" />
          <p className="text-xs font-medium">
            Os detalhes do ativo são exibidos no painel lateral. Clique no mesmo ativo novamente para desmarcar.
          </p>
        </div>
      )}
    </div>
  );
};
