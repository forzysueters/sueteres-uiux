import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/api';
import { AssetTile } from '../components/Cards';
import { PlantFloorMap } from '../components/PlantFloorMap';
import { PlantAlertRail } from '../components/PlantAlertRail';
import { STATUS_COLORS } from '../utils/plantStatus';
import {
  Map, LayoutGrid, AlertTriangle, CheckCircle2, WifiOff, Filter, Tag, Box, Maximize2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { CameraFocus } from '../components/three/PlantScene3D';
// plantLayout é TS puro (não importa `three`) — seguro trazer para cá sem
// arrastar a biblioteca 3D para o bundle inicial.
import { HALLS, hallForArea, hallBounds, PLANT_BOUNDS } from '../components/three/plantLayout';
import { hasWebGL } from '../utils/webgl';

// A cena arrasta three.js junto — só carrega quando o modo 3D é usado.
const PlantScene3D = lazy(() => import('../components/three/PlantScene3D'));

type ViewMode = '3d' | 'map' | 'grid';

const VIEW_TABS: { id: ViewMode; label: string; icon: typeof Map }[] = [
  { id: '3d', label: 'Planta 3D', icon: Box },
  { id: 'map', label: 'Mapa 2D', icon: Map },
  { id: 'grid', label: 'Grade', icon: LayoutGrid },
];

export const PlantNavigation: React.FC = () => {
  const { assets, setAssets, selectedAssetId, setSelectedAsset } = useAppStore();
  const navigate = useNavigate();

  // WebGL ausente (VM, driver bloqueado, GPU em lista negra) → 2D direto.
  const webgl = useMemo(() => hasWebGL(), []);
  const [viewMode, setViewMode] = useState<ViewMode>(webgl ? '3d' : 'map');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [focus, setFocus] = useState<CameraFocus>({ kind: 'scope', assetId: null, nonce: 0 });

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

  // Clicar em um ativo define o contexto (usado pelo Assistente e Equipamentos)
  // e abre a tela dedicada de monitoramento. `null` = limpar seleção (clique no
  // vazio da cena, ou re-clique no mesmo ativo no mapa 2D).
  const handleAssetSelect = (id: string | null) => {
    if (!id) {
      setSelectedAsset(null);
      return;
    }
    setSelectedAsset(id);
    navigate(`/planta/ativo/${id}`);
  };

  /** Régua de triagem: aproxima a câmera sem sair da planta. */
  const handleFocusAsset = (id: string) => {
    setSelectedAsset(id);
    setFocus(f => ({ kind: 'asset', assetId: id, nonce: f.nonce + 1 }));
  };

  /** "Vista geral" reenquadra o escopo ATUAL — não limpa o filtro. */
  const resetCamera = () => setFocus(f => ({ kind: 'scope', assetId: null, nonce: f.nonce + 1 }));

  // ─── Escopo da cena 3D ─────────────────────────────────────────────────────
  // O filtro de área é a única fonte de verdade: dele saem quais halls desenhar,
  // quais ativos mostrar e para onde a câmera vai. A cena não guarda escopo.
  const activeHall = hallForArea(areaFilter);
  const isolated = activeHall !== null;
  const sceneHalls = useMemo(() => (activeHall ? [activeHall] : HALLS), [activeHall]);
  const sceneBounds = useMemo(
    () => (activeHall ? hallBounds(activeHall) : PLANT_BOUNDS),
    [activeHall],
  );

  /** Troca de área sempre reenquadra — inclusive largando o foco num ativo. */
  const changeArea = (area: string) => {
    setAreaFilter(area);
    setFocus(f => ({ kind: 'scope', assetId: null, nonce: f.nonce + 1 }));
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
          {VIEW_TABS.map(tab => {
            const Icon = tab.icon;
            const disabled = tab.id === '3d' && !webgl;
            return (
              <button
                key={tab.id}
                onClick={() => !disabled && setViewMode(tab.id)}
                disabled={disabled}
                title={disabled ? 'WebGL indisponível neste navegador' : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  viewMode === tab.id ? 'bg-primary text-white' : 'text-muted hover:text-foreground',
                  disabled && 'opacity-40 cursor-not-allowed hover:text-muted',
                )}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-card border border-border">
          <Filter size={12} className="text-muted ml-2" />
          {areas.map(area => (
            <button
              key={area}
              onClick={() => changeArea(area)}
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
      {viewMode === '3d' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px] xl:h-[calc(100vh-15rem)] xl:min-h-[540px]">
          <div className="saas-card bg-card-hover flex h-[60vh] min-h-[400px] flex-col p-3 xl:h-full">
            {/* min-h-0 é o que permite o canvas encolher dentro do flex */}
            <div className="relative min-h-0 flex-1">
              <Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-card-hover">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-[11px] font-semibold text-muted">Montando a planta…</span>
                    </div>
                  </div>
                }
              >
                <PlantScene3D
                  assets={filteredAssets}
                  halls={sceneHalls}
                  bounds={sceneBounds}
                  isolated={isolated}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={handleAssetSelect}
                  onIsolateHall={changeArea}
                  onExitIsolation={() => changeArea('all')}
                  focus={focus}
                />
              </Suspense>

              {/* Reenquadra o escopo atual. O rótulo acompanha o escopo — fixo
                  em "Vista geral" ele mentiria com um hall isolado. */}
              <button
                onClick={resetCamera}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-[10px] font-bold text-muted backdrop-blur-sm transition-colors hover:text-foreground"
              >
                <Maximize2 size={11} />
                {isolated ? `Reenquadrar ${areaFilter}` : 'Vista geral'}
              </button>

              {/* Legenda de status */}
              <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-lg border border-border bg-card/85 px-3 py-1.5 backdrop-blur-sm">
                {Object.entries(STATUS_COLORS).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.fill }} />
                    <span className="text-[9px] font-semibold text-muted">{cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-2 shrink-0 text-center text-[10px] text-muted">
              Arraste para orbitar · role para aproximar · clique num equipamento para inspecionar
              {isolated ? ' · clique fora do hall para voltar' : ' · clique num hall para isolá-lo'}
            </p>
          </div>

          <div className="saas-card overflow-hidden p-4 xl:h-full">
            <PlantAlertRail
              assets={filteredAssets}
              selectedAssetId={selectedAssetId}
              onFocus={handleFocusAsset}
              onOpen={handleAssetSelect}
            />
          </div>
        </div>
      )}

      {viewMode === 'map' && (
        <div className="saas-card p-4 bg-card-hover">
          <PlantFloorMap
            assets={areaFilter === 'all' ? assets : filteredAssets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={handleAssetSelect}
          />
        </div>
      )}

      {viewMode === 'grid' && (
        <div className="saas-card p-8 overflow-auto bg-card-hover">
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
                    <div key={`empty-${x}-${y}`} className="min-h-[150px] rounded-xl flex flex-col items-center justify-center border border-border bg-card-hover/50">
                      <span className="text-[10px] font-mono text-muted-soft">{x + 1},{y + 1}</span>
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

      {/* Resumo por área — só nos modos 2D. No 3D estes cards seriam ruído:
          o filtro de área que eles fazem já existe na toolbar acima, e o
          detalhamento de status já está na régua de triagem ao lado da cena. */}
      {viewMode !== '3d' && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {areas.filter(a => a !== 'all').map(area => {
          const areaAssets = assets.filter(a => a.area === area);
          const ok   = areaAssets.filter(a => a.status === 'normal').length;
          const warn = areaAssets.filter(a => a.status === 'warning').length;
          const crit = areaAssets.filter(a => a.status === 'critical').length;
          return (
            <div
              key={area}
              onClick={() => changeArea(areaFilter === area ? 'all' : area)}
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
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{ok} normal</span>
                {warn > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{warn} alerta</span>}
                {crit > 0 && <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">{crit} crítico</span>}
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${(ok / areaAssets.length) * 100}%` }} />
                <div className="h-full bg-amber-500" style={{ width: `${(warn / areaAssets.length) * 100}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${(crit / areaAssets.length) * 100}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {areaAssets.map(a => (
                  <button
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); handleAssetSelect(a.id); }}
                    className={cn(
                      'text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 transition-all hover:bg-primary/10 hover:text-primary',
                      a.status === 'critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                      a.status === 'warning'  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                      'bg-card-hover text-muted',
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
      )}
    </div>
  );
};
