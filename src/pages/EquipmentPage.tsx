import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Plus, Search, Pencil, Trash2, Inbox, AlertTriangle, Gauge, FileText,
} from 'lucide-react';
import { EquipmentRegistrationForm } from '../components/EquipmentRegistrationForm';
import { AssetEditDialog } from '../components/AssetEditDialog';
import { AssetRemovalDialog } from '../components/AssetRemovalDialog';
import { InactiveAssetsPanel } from '../components/InactiveAssetsPanel';
import { Dialog } from '../components/Dialog';
import { AlertSkeleton } from '../components/SkeletonLoaders';
import { useAppStore } from '../store/appStore';
import { usePermissions } from '../hooks/usePermissions';
import { apiService } from '../services/api';
import { HALLS } from '../components/three/plantLayout';
import { translations } from '../translations';
import { cn } from '../lib/utils';
import type { Asset, InactiveAsset } from '../types';

type Situation = 'all' | 'no_nameplate' | 'no_sensors';

/**
 * Ordem canônica dos halls, a mesma do desenho da planta. Alfabética poria a
 * Cobertura antes do Hall A, e o `Set` sozinho devolve a ordem em que os ativos
 * vieram do banco — que é por TAG, ou seja, nenhuma.
 */
const areaRank = (area: string) => {
  const i = HALLS.findIndex((h) => h.area === area);
  return i === -1 ? HALLS.length : i;   // área desconhecida vai para o fim
};

/**
 * Gestão de equipamentos.
 *
 * É AQUI que se controla o ciclo de vida do ativo: cadastrar, editar, remover e
 * reativar. A planta e a página do ativo são observação — antes, remover estava
 * duplicado nas duas, e o painel de desativados morava no rodapé da planta.
 *
 * A lista mostra os ATIVOS. A versão anterior desta tela listava as 5 últimas
 * placas confirmadas, o que deixava de fora justamente os ativos sem placa —
 * que são os que mais precisam de atenção.
 */
export const EquipmentPage: React.FC = () => {
  const { selectedAssetId, language } = useAppStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const t = translations[language].equipment;

  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [inactive, setInactive] = useState<InactiveAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [area, setArea] = useState('all');
  const [situation, setSituation] = useState<Situation>('all');

  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [removing, setRemoving] = useState<Asset | null>(null);

  const mayCreate = can('nameplate:register');
  const mayEdit = can('asset:update');
  const mayRemove = can('asset:deactivate');

  const load = () => {
    setAssets(null);
    setError(null);
    // `listAssets` e não `getAssets`: esta tela não precisa do score de anomalia,
    // e aquela função faz uma ida ao FastAPI por ativo.
    apiService.listAssets()
      .then(setAssets)
      .catch((err) => { setError((err as Error).message); setAssets([]); });
  };

  const loadInactive = () => {
    if (!mayRemove) return;
    apiService.getInactiveAssets().then(setInactive).catch(() => setInactive([]));
  };

  useEffect(load, []);
  // Depende do papel, que chega depois do primeiro render (o `verifyAuth` é
  // assíncrono) — sem a dependência, rodaria uma vez com o papel vazio e nunca mais.
  useEffect(loadInactive, [mayRemove]);

  const areas = useMemo(
    () => [
      'all',
      ...Array.from(new Set((assets ?? []).map((a) => a.area).filter(Boolean)))
        .sort((x, y) => areaRank(x) - areaRank(y) || x.localeCompare(y)),
    ],
    [assets],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (assets ?? []).filter((a) => {
      if (q && !a.tag.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
      if (area !== 'all' && a.area !== area) return false;
      if (situation === 'no_nameplate' && a.nameplate) return false;
      if (situation === 'no_sensors' && a.sensors.length > 0) return false;
      return true;
    })
      // Agrupa por hall e, dentro dele, mantém a TAG em ordem.
      .sort((a, b) => areaRank(a.area) - areaRank(b.area)
        || a.area.localeCompare(b.area)
        || a.tag.localeCompare(b.tag));
  }, [assets, search, area, situation]);

  const SITUATIONS: { id: Situation; label: string }[] = [
    { id: 'all', label: t.situation_all },
    { id: 'no_nameplate', label: t.situation_no_nameplate },
    { id: 'no_sensors', label: t.situation_no_sensors },
  ];

  const selectClass = 'h-9 rounded-lg bg-card border border-border px-3 text-xs font-semibold text-foreground focus:outline-none focus:border-primary/50';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <Package className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0 text-primary" />
          <span className="min-w-0 break-words">{t.title}</span>
        </h1>
        <p>{t.subtitle}</p>
      </div>

      {/* Barra de controle. O botão de cadastrar fica em destaque à direita —
          a queixa da versão anterior era não haver nada dizendo que ali se
          adiciona equipamento. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search_placeholder}
            className="h-9 w-full rounded-lg bg-card border border-border pl-9 pr-3 text-xs font-medium text-foreground focus:outline-none focus:border-primary/50"
          />
        </div>

        <select value={area} onChange={(e) => setArea(e.target.value)} className={selectClass}>
          {areas.map((a) => (
            <option key={a} value={a}>{a === 'all' ? t.area_all : a}</option>
          ))}
        </select>

        <select
          value={situation}
          onChange={(e) => setSituation(e.target.value as Situation)}
          className={selectClass}
        >
          {SITUATIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        {mayCreate && (
          <button onClick={() => setRegistering(true)} className="btn-primary text-xs sm:ml-auto">
            <Plus size={14} />
            {t.add_asset}
          </button>
        )}
      </div>

      {error && (
        <div className="saas-card border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <p className="text-xs font-medium text-red-400 leading-relaxed">{error}</p>
        </div>
      )}

      <div className="saas-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-border bg-card-hover flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-foreground">{t.list_title}</span>
          {assets && (
            <span className="text-[11px] font-bold tabular-nums text-muted">
              {filtered.length === assets.length
                ? t.count.replace('{n}', String(assets.length))
                : t.count_filtered.replace('{n}', String(filtered.length)).replace('{total}', String(assets.length))}
            </span>
          )}
        </div>

        {assets === null ? (
          <div className="p-4"><AlertSkeleton count={3} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-6">
            <div className="w-10 h-10 rounded-lg bg-card-hover border border-border flex items-center justify-center text-muted">
              <Inbox size={18} />
            </div>
            <p className="text-sm font-bold text-foreground">
              {assets.length === 0 ? t.empty_title : t.empty_filtered_title}
            </p>
            <p className="text-xs text-muted max-w-sm leading-relaxed">
              {assets.length === 0 ? t.empty_desc : t.empty_filtered_desc}
            </p>
            {assets.length === 0 && mayCreate && (
              <button onClick={() => setRegistering(true)} className="btn-primary text-xs mt-3">
                <Plus size={14} />
                {t.add_asset}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Cabeçalho só no desktop: em telas estreitas cada ativo vira card. */}
            <div className="hidden lg:grid grid-cols-[7rem_1fr_9rem_6rem_6rem_6.5rem] gap-4 px-5 py-2.5 border-b border-border text-[9px] font-bold uppercase tracking-widest text-muted">
              <span>{t.col_tag}</span>
              <span>{t.col_name}</span>
              <span>{t.col_area}</span>
              <span>{t.col_nameplate}</span>
              <span>{t.col_sensors}</span>
              <span />
            </div>

            <div className="divide-y divide-border">
              {filtered.map((asset) => (
                <div
                  key={asset.id}
                  className="px-4 sm:px-5 py-3.5 lg:grid lg:grid-cols-[7rem_1fr_9rem_6rem_6rem_6.5rem] lg:gap-4 lg:items-center flex flex-col gap-2 hover:bg-card-hover/60 transition-colors"
                >
                  <button
                    onClick={() => navigate(`/planta/ativo/${asset.id}`)}
                    className="flex items-center gap-2 text-left min-w-0"
                    title={t.open_asset}
                  >
                    <span className="px-1.5 py-0.5 rounded bg-card-hover border border-border text-[10px] font-mono font-bold text-primary flex-shrink-0">
                      {asset.tag}
                    </span>
                  </button>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{asset.name}</p>
                    <p className="text-[10px] text-muted truncate lg:hidden">
                      {[asset.area, asset.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <span className="hidden lg:block text-xs text-muted truncate">{asset.area}</span>

                  {/* Quais ativos ainda não têm placa: pergunta que nenhuma
                      outra tela responde. */}
                  <span className={cn(
                    'inline-flex items-center gap-1.5 text-[11px] font-bold',
                    asset.nameplate ? 'text-emerald-400' : 'text-muted-soft',
                  )}>
                    <FileText size={11} />
                    <span className="lg:hidden">{t.col_nameplate}:</span>
                    {asset.nameplate ? t.has_nameplate : '—'}
                  </span>

                  {/* Ativo criado pelo wizard nasce sem instrumentação. */}
                  <span className={cn(
                    'inline-flex items-center gap-1.5 text-[11px] font-bold tabular-nums',
                    asset.sensors.length > 0 ? 'text-foreground-soft' : 'text-amber-500',
                  )}>
                    <Gauge size={11} />
                    <span className="lg:hidden">{t.col_sensors}:</span>
                    {asset.sensors.length}
                  </span>

                  <div className="flex items-center gap-1 lg:justify-end">
                    {mayEdit && (
                      <button
                        onClick={() => setEditing(asset)}
                        className="btn-ghost text-xs"
                        title={t.edit}
                      >
                        <Pencil size={13} />
                        <span className="lg:sr-only">{t.edit}</span>
                      </button>
                    )}
                    {mayRemove && (
                      <button
                        onClick={() => setRemoving(asset)}
                        className="btn-ghost text-xs text-red-400 hover:text-red-300"
                        title={t.remove}
                      >
                        <Trash2 size={13} />
                        <span className="lg:sr-only">{t.remove}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {mayRemove && (
        <InactiveAssetsPanel
          assets={inactive}
          onReactivated={() => { load(); loadInactive(); }}
        />
      )}

      {/* ─── Diálogos ─── */}

      <Dialog
        open={registering}
        onOpenChange={setRegistering}
        title={t.register_title}
        description={t.register_subtitle}
        className="max-w-4xl"
      >
        <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1">
          <EquipmentRegistrationForm
            assetId={selectedAssetId || undefined}
            onRegistered={() => { setRegistering(false); load(); loadInactive(); }}
          />
        </div>
      </Dialog>

      <AssetEditDialog
        asset={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />

      {removing && (
        <AssetRemovalDialog
          asset={removing}
          open={removing !== null}
          onOpenChange={(open) => { if (!open) setRemoving(null); }}
          onRemoved={() => { setRemoving(null); load(); loadInactive(); }}
        />
      )}
    </div>
  );
};
