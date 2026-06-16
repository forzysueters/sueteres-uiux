import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { AssetTile } from '../components/Cards';
import { PlantFloorMap } from '../components/PlantFloorMap';
import { Map, LayoutGrid, AlertTriangle, CheckCircle2, WifiOff, Filter, Tag, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

type ViewMode = 'map' | 'grid';

export const PlantNavigation: React.FC = () => {
  const { assets, setAssets, selectedAssetId, setSelectedAsset } = useAppStore();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [areaFilter, setAreaFilter] = useState<string>('all');

  useEffect(() => {
    apiService.getAssets().then(setAssets);
  }, []);

  const areas = ['all', ...Array.from(new Set(assets.map(a => a.area)))];
  const filteredAssets = areaFilter === 'all' ? assets : assets.filter(a => a.area === areaFilter);

  const totalOnline = assets.filter(a => a.status !== 'offline').length;
  const criticalCount = assets.filter(a => a.status === 'critical').length;
  const warningCount = assets.filter(a => a.status === 'warning').length;

  const maxX = Math.max(...filteredAssets.map(a => a.x), 3);
  const maxY = Math.max(...filteredAssets.map(a => a.y), 3);

  const handleAssetSelect = (id: string | null) => {
    setSelectedAsset(selectedAssetId === id ? null : id);
  };

  const handleAssetDrilldown = (id: string) => {
    navigate(`/planta/ativo/${id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center">
              <Map className="w-7 h-7 text-primary" />
            </div>
            Planta / Gêmeo Digital
          </h1>
          <p className="text-sm text-muted">
            Navegação hierárquica por área e ativo — clique em um ativo para inspecionar a telemetria
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-card border border-border">
          <button
            onClick={() => setViewMode('map')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              viewMode === 'map' ? 'bg-primary text-white' : 'text-muted hover:text-foreground',
            )}
          >
            <Map size={13} />
            Mapa da Planta
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              viewMode === 'grid' ? 'bg-primary text-white' : 'text-muted hover:text-foreground',
            )}
          >
            <LayoutGrid size={13} />
            Grade
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-card border border-border">
          <Filter size={12} className="text-muted ml-2" />
          {areas.map(area => (
            <button
              key={area}
              onClick={() => setAreaFilter(area)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                areaFilter === area ? 'bg-card-hover text-foreground' : 'text-muted hover:text-foreground-soft',
              )}
            >
              {area === 'all' ? 'Todas as Áreas' : area}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <WifiOff size={13} className="text-muted" />
          <span className="text-[11px] font-bold text-muted uppercase tracking-tighter">
            {assets.filter(a => a.status === 'offline').length} offline
          </span>
        </div>
      </div>

      {/* Main view */}
      {viewMode === 'map' ? (
        <div className="saas-card p-4 bg-slate-900/30">
          <PlantFloorMap
            assets={areaFilter === 'all' ? assets : filteredAssets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={handleAssetSelect}
          />
        </div>
      ) : (
        <div className="saas-card p-8 overflow-auto bg-slate-900/30">
          <div
            className="grid gap-6 relative mx-auto"
            style={{
              gridTemplateColumns: `repeat(${maxX}, minmax(200px, 1fr))`,
              gridTemplateRows: `repeat(${maxY}, auto)`,
              width: 'max-content',
              minWidth: '100%',
            }}
          >
            {Array.from({ length: maxX }).map((_, x) =>
              Array.from({ length: maxY }).map((_, y) => {
                const asset = filteredAssets.find(a => a.x === x + 1 && a.y === y + 1);
                if (!asset) {
                  return (
                    <div key={`empty-${x}-${y}`} className="min-h-[150px] rounded-xl flex flex-col items-center justify-center border border-border bg-slate-800/10">
                      <span className="text-[10px] font-mono text-slate-600">{x + 1},{y + 1}</span>
                    </div>
                  );
                }
                return (
                  <div key={asset.id} className="h-full min-h-[150px]">
                    <AssetTile
                      asset={asset}
                      isSelected={selectedAssetId === asset.id}
                      onClick={handleAssetSelect}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Area summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {areas.filter(a => a !== 'all').map(area => {
          const areaAssets = assets.filter(a => a.area === area);
          const ok   = areaAssets.filter(a => a.status === 'normal').length;
          const warn = areaAssets.filter(a => a.status === 'warning').length;
          const crit = areaAssets.filter(a => a.status === 'critical').length;
          return (
            <div
              key={area}
              onClick={() => setAreaFilter(areaFilter === area ? 'all' : area)}
              className={cn(
                'saas-card p-4 cursor-pointer transition-all hover:border-primary/40',
                areaFilter === area && 'border-primary/50 bg-primary/5',
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">{area}</span>
                <span className="text-[10px] font-mono text-muted">{areaAssets.length} ativos</span>
              </div>
              <div className="flex gap-3 mb-2">
                <span className="text-[10px] text-emerald-400 font-bold">{ok} normal</span>
                {warn > 0 && <span className="text-[10px] text-amber-400 font-bold">{warn} alerta</span>}
                {crit > 0 && <span className="text-[10px] text-red-400 font-bold">{crit} crítico</span>}
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${(ok / areaAssets.length) * 100}%` }} />
                <div className="h-full bg-amber-500" style={{ width: `${(warn / areaAssets.length) * 100}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${(crit / areaAssets.length) * 100}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {areaAssets.map(a => (
                  <button
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); handleAssetDrilldown(a.id); }}
                    className={cn(
                      'text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 transition-all hover:bg-primary/10 hover:text-primary',
                      a.status === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      a.status === 'warning'  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-slate-800 text-slate-400',
                    )}
                  >
                    <Tag size={7} />
                    {a.tag}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected asset quick-open */}
      {selectedAssetId && (() => {
        const sel = assets.find(a => a.id === selectedAssetId);
        return sel ? (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <Tag size={16} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">{sel.name}</p>
                <p className="text-[10px] text-muted">{sel.tag} · {sel.location}</p>
              </div>
            </div>
            <button
              onClick={() => handleAssetDrilldown(selectedAssetId)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
            >
              Ver Monitoramento Completo
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null;
      })()}
    </div>
  );
};
