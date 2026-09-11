import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Asset } from '../../types';
import { HALLS } from './plantLayout';
import type { Hall } from './plantLayout';
import { CELL_WORLD, cellsForHall, rectToWorld } from './plantGrid';
import type { CellRect } from './plantGrid';
import type { Placement } from '../../hooks/usePlantLayoutEditor';

/**
 * Sobreposições do modo de editar layout.
 *
 * Alturas escolhidas para não brigar com o que a cena já empilha no piso
 * (piso 0 · grade 0.004 · laje do hall 0.008 · disco do ativo 0.015 · anel de
 * status 0.03 · anel de seleção 0.05). Todas com `depthWrite: false` e
 * `renderOrder` crescente — subir mais faria a pegada flutuar visivelmente sob
 * a máquina em vez de parecer pintada no chão.
 */
const Y_GRID = 0.014;
const Y_FOOTPRINT = 0.022;
const Y_DRAGGED = 0.026;

/** Malha de um hall, recortada às células que cabem inteiras. */
const HallGrid: React.FC<{ hall: Hall; color: string }> = ({ hall, color }) => {
  const geometry = useMemo(() => {
    const r = cellsForHall(hall);
    const { x0, z0, w, d } = rectToWorld(r);
    const pts: number[] = [];

    for (let c = 0; c <= r.w; c++) {
      const x = x0 + c * CELL_WORLD;
      pts.push(x, 0, z0, x, 0, z0 + d);
    }
    for (let l = 0; l <= r.h; l++) {
      const z = z0 + l * CELL_WORLD;
      pts.push(x0, 0, z, x0 + w, 0, z);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [hall]);

  // Geometria própria vive na GPU: sem descartar, vaza a cada entrada e saída
  // do modo de edição.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} position={[0, Y_GRID, 0]} renderOrder={1}>
      <lineBasicMaterial color={color} transparent opacity={0.42} depthWrite={false} />
    </lineSegments>
  );
};

/** Pegada de um ativo, pintada no piso. */
const Footprint: React.FC<{
  rect: CellRect;
  color: string;
  opacity: number;
  y: number;
  renderOrder: number;
}> = ({ rect, color, opacity, y, renderOrder }) => {
  const { cx, cz, w, d } = rectToWorld(rect);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, y, cz]} renderOrder={renderOrder}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
};

interface EditOverlayProps {
  assets: Asset[];
  draft: Record<string, CellRect>;
  placement: Map<string, Placement>;
  dragId: string | null;
  gridColor: string;
  okColor: string;
  activeColor: string;
  invalidColor: string;
}

export const EditOverlay: React.FC<EditOverlayProps> = ({
  assets, draft, placement, dragId,
  gridColor, okColor, activeColor, invalidColor,
}) => (
  <>
    {HALLS.map((hall) => (
      <HallGrid key={hall.id} hall={hall} color={gridColor} />
    ))}

    {assets.map((asset) => {
      const rect = draft[asset.id];
      if (!rect) return null;

      const state = placement.get(asset.id) ?? 'ok';
      const dragging = asset.id === dragId;
      const color = state !== 'ok' ? invalidColor : dragging ? activeColor : okColor;

      return (
        <Footprint
          key={asset.id}
          rect={rect}
          color={color}
          opacity={state !== 'ok' ? 0.42 : dragging ? 0.38 : 0.2}
          y={dragging ? Y_DRAGGED : Y_FOOTPRINT}
          renderOrder={dragging ? 3 : 2}
        />
      );
    })}
  </>
);
