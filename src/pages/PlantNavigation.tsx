import React, { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { AssetTile } from '../components/Cards';

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

  return (
    <div className="space-y-6">
      {/* Plant Layout Info */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-100">Factory Digital Twin</h2>
        <p className="text-sm text-slate-400 mt-1">
          Interactive plant layout. Click on any asset to view detailed sensor data and diagnostics.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-6">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${maxX}, minmax(200px, 1fr))`,
            gridTemplateRows: `repeat(${maxY}, auto)`,
          }}
        >
          {Array.from({ length: maxX }).map((_, x) =>
            Array.from({ length: maxY }).map((_, y) => {
              const asset = assets.find(a => a.x === x + 1 && a.y === y + 1);

              if (!asset) {
                return (
                  <div
                    key={`empty-${x}-${y}`}
                    className="min-h-32 rounded-lg border-2 border-dashed border-slate-700/50 bg-slate-800/20 flex items-center justify-center"
                  >
                    <span className="text-xs text-slate-600">Station ({x + 1}, {y + 1})</span>
                  </div>
                );
              }

              return (
                <div key={asset.id} className="h-full">
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

      {/* Legend */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse-glow" />
            <span className="text-xs text-slate-400">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse-glow" />
            <span className="text-xs text-slate-400">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse-glow" />
            <span className="text-xs text-slate-400">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-500" />
            <span className="text-xs text-slate-400">Offline</span>
          </div>
        </div>
      </div>

      {/* Selected Asset Info */}
      {selectedAssetId && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            ℹ️ Selected asset details are shown in the right panel. Click on another asset to switch or click the same asset again to deselect.
          </p>
        </div>
      )}
    </div>
  );
};
