import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Area, Asset } from '../types';
import { apiService } from '../services/api';
import { useAppStore } from '../store/appStore';
import { HALLS } from '../components/three/plantLayout';
import type { Hall } from '../components/three/plantLayout';
import {
  CellRect, collides, footprintCells, footprintOf, hallForRect,
  rectToPlant, sameRect, snapToCell,
} from '../components/three/plantGrid';

export type Placement = 'ok' | 'collision' | 'outside';

export interface PendingMove {
  asset: Asset;
  rect: CellRect;
  from: Hall | null;
  to: Hall;
}

/**
 * Cérebro do editor de layout.
 *
 * As duas vistas (mapa SVG e cena 3D) são só superfícies de arrasto: elas
 * desenham `displayAssets` — os ativos com a posição do rascunho já aplicada —
 * e chamam `moveTo` com coordenada SVG contínua. Quem snapa, valida e grava é
 * este hook, uma vez só, para as duas.
 */
export function usePlantLayoutEditor(assets: Asset[], enabled: boolean) {
  const setAssets = useAppStore((s) => s.setAssets);

  const [draft, setDraft] = useState<Record<string, CellRect>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Célula de onde o arrasto partiu — destino inválido volta para cá. */
  const preDrag = useRef<CellRect | null>(null);

  // Ao ENTRAR no modo, todo ativo é alinhado à malha — inclusive quem nunca foi
  // movido. Sem isso a colisão seria calculada em células enquanto o banco
  // guarda coordenadas arbitrárias, e dois ativos poderiam acabar sobrepostos
  // depois do primeiro salvamento.
  useEffect(() => {
    if (!enabled) {
      setDraft({});
      setDragId(null);
      setPendingMove(null);
      setError(null);
      return;
    }
    setDraft(Object.fromEntries(assets.map((a) => [a.id, footprintCells(a)])));
    apiService.getAreas().then(setAreas).catch(() => setAreas([]));
    // `assets` de propósito fora das dependências: re-semear a cada tick do
    // realtime jogaria fora o rascunho no meio da edição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const rectOf = useCallback(
    (a: Asset): CellRect => draft[a.id] ?? footprintCells(a),
    [draft],
  );

  /** Estado de cada ativo. O(n²) sobre ~7 ativos é irrelevante. */
  const placement = useMemo(() => {
    const map = new Map<string, Placement>();
    if (!enabled) return map;

    const entries = assets.map((a) => [a.id, rectOf(a)] as const);
    for (const [id, rect] of entries) {
      if (!hallForRect(rect)) {
        map.set(id, 'outside');
        continue;
      }
      const hit = entries.some(([other, o]) => other !== id && collides(rect, o));
      map.set(id, hit ? 'collision' : 'ok');
    }
    return map;
  }, [assets, rectOf, enabled]);

  /** Ativos com a posição do rascunho aplicada — é o que as vistas desenham. */
  const displayAssets = useMemo(() => {
    if (!enabled) return assets;
    return assets.map((a) => {
      const rect = draft[a.id];
      if (!rect) return a;
      const { plantX, plantY } = rectToPlant(rect);
      const hall = hallForRect(rect);
      return { ...a, plantX, plantY, area: hall?.area ?? a.area };
    });
  }, [assets, draft, enabled]);

  const startDrag = useCallback((id: string) => {
    setDragId(id);
    setError(null);
    preDrag.current = draft[id] ?? null;
  }, [draft]);

  /** Recebe coordenada SVG contínua das duas vistas. */
  const moveTo = useCallback((id: string, svgX: number, svgY: number) => {
    const asset = assets.find((a) => a.id === id);
    if (!asset) return;
    const next = snapToCell(svgX, svgY, footprintOf(asset.type));

    setDraft((d) => {
      // Só re-renderiza quando a CÉLULA muda. A 60 fps, um setState por evento
      // de ponteiro remontaria a cena 3D inteira dezenas de vezes por segundo.
      const cur = d[id];
      if (cur && sameRect(cur, next)) return d;
      return { ...d, [id]: next };
    });
  }, [assets]);

  const endDrag = useCallback((id: string) => {
    setDragId(null);
    const asset = assets.find((a) => a.id === id);
    const rect = draft[id];
    const before = preDrag.current;
    preDrag.current = null;
    if (!asset || !rect) return;

    const to = hallForRect(rect);

    // Soltar fora de um hall (ou a cavalo entre dois) volta ao lugar: inválido
    // não pode virar estado salvável esperando o usuário reparar depois.
    if (!to) {
      if (before) setDraft((d) => ({ ...d, [id]: before }));
      return;
    }

    const from = HALLS.find((h) => h.area === asset.area) ?? null;
    if (from && to.area !== from.area) {
      // A confirmação é aqui, no drop, e não no Salvar: é neste instante que o
      // usuário tem o contexto do que acabou de fazer.
      setPendingMove({ asset, rect, from, to });
      if (before) setDraft((d) => ({ ...d, [id]: before }));
    }
  }, [assets, draft]);

  const confirmPendingMove = useCallback(() => {
    if (!pendingMove) return;
    setDraft((d) => ({ ...d, [pendingMove.asset.id]: pendingMove.rect }));
    setPendingMove(null);
  }, [pendingMove]);

  const cancelPendingMove = useCallback(() => setPendingMove(null), []);

  const isDirty = useMemo(() => {
    if (!enabled) return false;
    return assets.some((a) => {
      const rect = draft[a.id];
      if (!rect) return false;
      const { plantX, plantY } = rectToPlant(rect);
      const hall = hallForRect(rect);
      return plantX !== a.plantX || plantY !== a.plantY || (hall && hall.area !== a.area);
    });
  }, [assets, draft, enabled]);

  const hasInvalid = useMemo(
    () => Array.from(placement.values()).some((p) => p !== 'ok'),
    [placement],
  );

  /**
   * Primeira célula livre da matriz da vista "Grade" da área destino.
   *
   * A vista Grade agrupa por área e faz `.find()` por célula: se o ativo
   * entrasse numa área nova mantendo a célula antiga e ela já estivesse
   * ocupada, um dos dois sumiria da tela.
   */
  const freeGridCell = useCallback((areaName: string, movingId: string) => {
    const taken = new Set(
      assets
        .filter((a) => a.area === areaName && a.id !== movingId)
        .map((a) => `${a.x},${a.y}`),
    );
    for (let y = 1; y <= 50; y++) {
      for (let x = 1; x <= 50; x++) {
        if (!taken.has(`${x},${y}`)) return { gridX: x, gridY: y };
      }
    }
    return { gridX: 1, gridY: 1 };
  }, [assets]);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const byName = new Map(areas.map((a) => [a.name, a.id]));

      // Grava tudo que difere do banco, não só o que foi arrastado — é o que
      // normaliza de uma vez os ativos que o seed deixou fora da malha.
      const changes = assets.flatMap((a) => {
        const rect = draft[a.id];
        if (!rect || placement.get(a.id) !== 'ok') return [];

        const { plantX, plantY } = rectToPlant(rect);
        const hall = hallForRect(rect);
        if (!hall) return [];

        const areaChanged = hall.area !== a.area;
        if (!areaChanged && plantX === a.plantX && plantY === a.plantY) return [];

        const areaId = areaChanged ? byName.get(hall.area) : undefined;
        if (areaChanged && !areaId) {
          throw new Error(`A área "${hall.area}" não existe no banco.`);
        }

        const grid = areaChanged ? freeGridCell(hall.area, a.id) : {};
        return [{ asset: a, plantX, plantY, areaId, area: hall.area, ...grid }];
      });

      if (changes.length === 0) {
        setSaving(false);
        return;
      }

      const results = await Promise.allSettled(
        changes.map((c) => apiService.updateAssetLayout(c.asset.id, {
          plantX: c.plantX,
          plantY: c.plantY,
          areaId: c.areaId,
          gridX: (c as { gridX?: number }).gridX,
          gridY: (c as { gridY?: number }).gridY,
        })),
      );

      const applied = new Map<string, (typeof changes)[number]>();
      changes.forEach((c, i) => {
        if (results[i].status === 'fulfilled') applied.set(c.asset.id, c);
      });

      // Patch no store em vez de `getAssets()`: aquela chamada re-pontua a
      // anomalia de todos os ativos contra o FastAPI, e aqui só a posição mudou.
      if (applied.size > 0) {
        setAssets(assets.map((a) => {
          const c = applied.get(a.id);
          if (!c) return a;
          return {
            ...a,
            plantX: c.plantX,
            plantY: c.plantY,
            area: c.area,
            areaId: c.areaId ?? a.areaId,
            x: (c as { gridX?: number }).gridX ?? a.x,
            y: (c as { gridY?: number }).gridY ?? a.y,
          };
        }));
      }

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        const first = (failed[0] as PromiseRejectedResult).reason;
        throw new Error(
          failed.length === 1
            ? (first as Error).message
            : `${failed.length} ativos não puderam ser gravados. ${(first as Error).message}`,
        );
      }
    } catch (err) {
      setError((err as Error)?.message ?? 'Não foi possível salvar o layout.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [assets, draft, placement, areas, saving, setAssets, freeGridCell]);

  return {
    displayAssets,
    draft,
    placement,
    dragId,
    pendingMove,
    isDirty,
    hasInvalid,
    saving,
    error,
    startDrag,
    moveTo,
    endDrag,
    confirmPendingMove,
    cancelPendingMove,
    save,
  };
}

export type PlantLayoutEditor = ReturnType<typeof usePlantLayoutEditor>;
