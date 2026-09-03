import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { canWriteAssets } from '../types/auth';
import { translations } from '../translations';
import { apiService } from '../services/api';
import { AssetTile } from '../components/Cards';
import { AssetRemovalDialog } from '../components/AssetRemovalDialog';
import { InactiveAssetsPanel } from '../components/InactiveAssetsPanel';
import { PlantLayoutToolbar } from '../components/PlantLayoutToolbar';
import { HallChangeDialog } from '../components/HallChangeDialog';
import { Dialog } from '../components/Dialog';
import { usePlantLayoutEditor } from '../hooks/usePlantLayoutEditor';
import { PlantFloorMap } from '../components/PlantFloorMap';
import { PlantAlertRail } from '../components/PlantAlertRail';
import { STATUS_COLORS, statusLabel } from '../utils/plantStatus';
import {
  Map, LayoutGrid, AlertTriangle, CheckCircle2, WifiOff, Filter, Tag, Box, Maximize2, Factory, AlertOctagon, Move,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Asset, InactiveAsset } from '../types';
import type { CameraFocus } from '../components/three/PlantScene3D';
// plantLayout é TS puro (não importa `three`) — seguro trazer para cá sem
// arrastar a biblioteca 3D para o bundle inicial.
import { HALLS, hallForArea, hallBounds, PLANT_BOUNDS } from '../components/three/plantLayout';
import { hasWebGL } from '../utils/webgl';
import { useIsMobile } from '../hooks/useMediaQuery';
import { PageLoader } from '../components/SkeletonLoaders';

// A cena arrasta three.js junto — só carrega quando o modo 3D é usado.
const PlantScene3D = lazy(() => import('../components/three/PlantScene3D'));

type ViewMode = '3d' | 'map' | 'grid';

export const PlantNavigation: React.FC = () => {
  const { assets, setAssets, selectedAssetId, setSelectedAsset, language } = useAppStore();
  // Mesma regra da página do ativo: quem cadastra ativo também o remove.
  const mayRemoveAsset = canWriteAssets(useAuthStore((s) => s.user)?.role);
  /** Mesma regra: quem cadastra e remove ativo também reposiciona. */
  const mayEditLayout = mayRemoveAsset;
  const [removalTarget, setRemovalTarget] = useState<Asset | null>(null);
  const [inactive, setInactive] = useState<InactiveAsset[]>([]);
  const t = translations[language].plant;
  const common = translations[language].common;
  const navigate = useNavigate();

  const VIEW_TABS: { id: ViewMode; label: string; icon: typeof Map }[] = [
    { id: '3d', label: t.view_3d, icon: Box },
    { id: 'map', label: t.view_map, icon: Map },
    { id: 'grid', label: t.view_grid, icon: LayoutGrid },
  ];

  // WebGL ausente (VM, driver bloqueado, GPU em lista negra) → 2D direto.
  const webgl = useMemo(() => hasWebGL(), []);
  // A grade posicional (linhas x colunas da planta) nao cabe em 375px: no
  // celular ela vira uma lista de uma coluna so, sem as celulas vazias.
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(webgl ? '3d' : 'map');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [focus, setFocus] = useState<CameraFocus>({ kind: 'scope', assetId: null, nonce: 0 });
  const [editMode, setEditMode] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = () => {
    setLoading(true);
    apiService
      .getAssets()
      .then((data) => {
        setAssets(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.load_error))
      .finally(() => setLoading(false));
  };

  // Só admin/engenheiro veem (e podem reativar) ativo desativado; para os
  // demais nem vale a consulta.
  const loadInactive = () => {
    if (!mayRemoveAsset) return;
    apiService.getInactiveAssets().then(setInactive).catch(() => setInactive([]));
  };

  useEffect(() => {
    loadAssets();
  }, []);

  // Depende do papel, que chega depois do primeiro render: `verifyAuth` resolve
  // a sessão de forma assíncrona, então um efeito com [] leria o papel ainda
  // vazio e a lista nunca carregaria.
  useEffect(() => {
    loadInactive();
  }, [mayRemoveAsset]);

  const areas = ['all', ...Array.from(new Set(assets.map(a => a.area)))];
  const editor = usePlantLayoutEditor(assets, editMode);

  // Em edição as vistas desenham o RASCUNHO, não o que está no banco.
  const shownAssets = editMode ? editor.displayAssets : assets;
  const filteredAssets = areaFilter === 'all'
    ? shownAssets
    : shownAssets.filter(a => a.area === areaFilter);

  const movedCount = useMemo(() => {
    if (!editMode) return 0;
    return editor.displayAssets.filter((d) => {
      const orig = assets.find((a) => a.id === d.id);
      return orig && (d.plantX !== orig.plantX || d.plantY !== orig.plantY || d.area !== orig.area);
    }).length;
  }, [editMode, editor.displayAssets, assets]);

  const invalidCount = useMemo(
    () => Array.from(editor.placement.values()).filter((p) => p !== 'ok').length,
    [editor.placement],
  );

  /**
   * Entrar em edição zera o filtro de área: a colisão é validada contra a
   * planta inteira, e com um hall isolado a cena só receberia parte dos ativos
   * — daria para empilhar equipamento sem ver.
   */
  const enterEditMode = () => {
    setAreaFilter('all');
    setFocus(f => ({ kind: 'scope', assetId: null, nonce: f.nonce + 1 }));
    if (viewMode === 'grid') setViewMode(webgl ? '3d' : 'map');
    setEditMode(true);
  };

  const leaveEditMode = () => {
    if (editor.isDirty) { setConfirmDiscard(true); return; }
    setEditMode(false);
  };

  const saveLayout = async () => {
    try {
      await editor.save();
      setEditMode(false);
    } catch {
      // A mensagem já está em editor.error, renderizada na toolbar.
    }
  };

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

  if (loading && assets.length === 0) {
    return <PageLoader label={t.loading} />;
  }

  if (error && assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
          <AlertOctagon size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{error}</p>
          <p className="text-xs text-muted mt-1">{t.retry_hint}</p>
        </div>
        <button onClick={loadAssets} className="btn-ghost text-xs">{common.retry}</button>
      </div>
    );
  }

  if (!loading && !error && assets.length === 0) {
    return (
      <div className="saas-card flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-card-hover border border-border flex items-center justify-center text-muted">
          <Factory size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t.empty_title}</p>
          <p className="text-xs text-muted mt-1">{t.empty_desc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-card border border-border flex flex-shrink-0 items-center justify-center">
              <Map className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <span className="min-w-0 break-words">{t.title}</span>
          </h1>
          <p className="text-sm text-muted">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="badge badge-success px-3 py-1.5">
            <CheckCircle2 size={14} />
            {totalOnline} {common.online}
          </div>
          {criticalCount > 0 && (
            <div className="badge badge-critical px-3 py-1.5">
              <AlertTriangle size={14} />
              {criticalCount} {statusLabel('critical', language)}
            </div>
          )}
          {warningCount > 0 && (
            <div className="badge badge-warning px-3 py-1.5">
              <AlertTriangle size={14} />
              {warningCount} {statusLabel('warning', language)}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-card border border-border">
          {VIEW_TABS.map(tab => {
            const Icon = tab.icon;
            // A vista Grade é outra coisa (matriz por área, não geometria):
            // não há o que arrastar nela.
            const disabled = (tab.id === '3d' && !webgl) || (editMode && tab.id === 'grid');
            return (
              <button
                key={tab.id}
                onClick={() => !disabled && setViewMode(tab.id)}
                disabled={disabled}
                title={disabled ? t.webgl_unavailable : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all',
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

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-card border border-border">
          <Filter size={12} className="text-muted ml-2" />
          {areas.map(area => (
            <button
              key={area}
              onClick={() => changeArea(area)}
              // Travado na edição: a colisão é validada contra a planta inteira.
              disabled={editMode}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all',
                areaFilter === area ? 'bg-card-hover text-foreground' : 'text-muted hover:text-foreground-soft',
                editMode && 'opacity-40 cursor-not-allowed',
              )}
            >
              {area === 'all' ? t.all_areas : area}
            </button>
          ))}
        </div>

        {mayEditLayout && !isMobile && !editMode && (
          <button onClick={enterEditMode} className="btn-ghost text-xs">
            <Move size={13} />
            {translations[language].plantLayout.edit_layout}
          </button>
        )}

        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <WifiOff size={13} className="text-muted" />
          <span className="text-[11px] font-bold text-muted uppercase tracking-tighter">
            {assets.filter(a => a.status === 'offline').length} {common.status.offline.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Main view */}
      {viewMode === '3d' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px] xl:h-[calc(100vh-15rem)] xl:min-h-[540px]">
          <div data-tour="plant-scene" className="saas-card bg-card-hover flex h-[55vh] min-h-[320px] flex-col p-2 sm:min-h-[400px] sm:p-3 xl:h-full">
            {/* min-h-0 é o que permite o canvas encolher dentro do flex */}
            <div className="relative min-h-0 flex-1">
              <Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-card-hover">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-[11px] font-semibold text-muted">{t.loading_scene}</span>
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
                  editMode={editMode}
                  editor={editMode ? {
                    draft: editor.draft,
                    placement: editor.placement,
                    dragId: editor.dragId,
                    startDrag: editor.startDrag,
                    moveTo: editor.moveTo,
                    endDrag: editor.endDrag,
                  } : null}
                />
              </Suspense>

              {/* Reenquadra o escopo atual. O rótulo acompanha o escopo — fixo
                  em "Vista geral" ele mentiria com um hall isolado. */}
              <button
                onClick={resetCamera}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-[10px] font-bold text-muted backdrop-blur-sm transition-colors hover:text-foreground"
              >
                <Maximize2 size={11} />
                {isolated ? `${t.reframe} ${areaFilter}` : t.general_view}
              </button>

              {/* Legenda de status */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card/85 px-3 py-1.5 backdrop-blur-sm sm:right-auto">
                {Object.keys(STATUS_COLORS).map((key) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key].fill }} />
                    <span className="text-[9px] font-semibold text-muted">{statusLabel(key, language)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-2 shrink-0 text-center text-[10px] text-muted">
              {t.orbit_hint}
              {isolated ? t.orbit_hint_exit_hall : t.orbit_hint_isolate_hall}
            </p>
          </div>

          <div data-tour="triage-rail" className="saas-card max-h-[70vh] overflow-hidden p-3 sm:p-4 xl:max-h-none xl:h-full">
            <PlantAlertRail
              assets={filteredAssets}
              selectedAssetId={selectedAssetId}
              onFocus={handleFocusAsset}
              onOpen={handleAssetSelect}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {editMode && (
          <PlantLayoutToolbar
            key="layout-toolbar"
            movedCount={movedCount}
            invalidCount={invalidCount}
            saving={editor.saving}
            error={editor.error}
            onSave={saveLayout}
            onCancel={leaveEditMode}
          />
        )}
      </AnimatePresence>

      {viewMode === 'map' && (
        <div className="saas-card p-2 sm:p-4 bg-card-hover">
          <PlantFloorMap
            assets={areaFilter === 'all' ? shownAssets : filteredAssets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={handleAssetSelect}
            editMode={editMode}
            draftRects={editor.draft}
            placement={editor.placement}
            dragId={editor.dragId}
            onDragStart={editor.startDrag}
            onDragMove={editor.moveTo}
            onDragEnd={editor.endDrag}
          />
        </div>
      )}

      {viewMode === 'grid' && (
        <div className="saas-card p-3 sm:p-6 lg:p-8 bg-card-hover">
          {/* Em telas pequenas a matriz posicional passaria de 1200px de
              largura e obrigaria a arrastar para o lado — vira lista. */}
          {isMobile ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredAssets.map((asset) => (
                <AssetTile
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAssetId === asset.id}
                  onClick={handleAssetSelect}
                  onRemove={mayRemoveAsset ? setRemovalTarget : undefined}
                />
              ))}
            </div>
          ) : (
            <div
              className="grid w-full gap-4 relative lg:gap-6"
              style={{
                gridTemplateColumns: `repeat(${maxX}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${maxY}, auto)`,
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
                        onRemove={mayRemoveAsset ? setRemovalTarget : undefined}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Resumo por área — só nos modos 2D. No 3D estes cards seriam ruído:
          o filtro de área que eles fazem já existe na toolbar acima, e o
          detalhamento de status já está na régua de triagem ao lado da cena. */}
      {viewMode !== '3d' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <span className="text-[10px] font-mono text-muted">{areaAssets.length} {t.assets_suffix}</span>
              </div>
              <div className="flex gap-3 mb-2">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{ok} {statusLabel('normal', language).toLowerCase()}</span>
                {warn > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{warn} {statusLabel('warning', language).toLowerCase()}</span>}
                {crit > 0 && <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">{crit} {statusLabel('critical', language).toLowerCase()}</span>}
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

      <HallChangeDialog
        move={editor.pendingMove}
        onConfirm={editor.confirmPendingMove}
        onCancel={editor.cancelPendingMove}
      />

      <Dialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={translations[language].plantLayout.discard_title}
        description={translations[language].plantLayout.discard_desc}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setConfirmDiscard(false)}
            className="h-10 rounded-lg font-bold text-xs bg-card-hover border border-border text-muted hover:bg-border transition-all sm:flex-1"
          >
            {translations[language].plantLayout.discard_keep}
          </button>
          <button
            onClick={() => { setConfirmDiscard(false); setEditMode(false); }}
            className="h-10 rounded-lg font-bold text-xs bg-red-500 text-white hover:bg-red-500/90 transition-all sm:flex-[2]"
          >
            {translations[language].plantLayout.discard_confirm}
          </button>
        </div>
      </Dialog>

      {mayRemoveAsset && (
        <InactiveAssetsPanel
          assets={inactive}
          onReactivated={() => { loadAssets(); loadInactive(); }}
        />
      )}

      {removalTarget && (
        <AssetRemovalDialog
          asset={removalTarget}
          open={removalTarget !== null}
          onOpenChange={(open) => { if (!open) setRemovalTarget(null); }}
          onRemoved={() => {
            // Sai do store na hora; desativado some da view, apagado deixa de
            // existir. Se era o selecionado, limpa o contexto do assistente.
            setAssets(assets.filter((a) => a.id !== removalTarget.id));
            if (selectedAssetId === removalTarget.id) setSelectedAsset(null);
            setRemovalTarget(null);
            loadInactive();
          }}
        />
      )}
    </div>
  );
};
