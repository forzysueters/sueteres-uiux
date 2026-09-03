/**
 * Malha de células da planta — o modelo por trás do editor de layout.
 *
 * TS puro de propósito: o `PlantNavigation` importa este módulo e não pode
 * arrastar `three` para o bundle inicial (mesma razão do `plantLayout.ts`).
 *
 * A posição continua sendo gravada como `plant_x`/`plant_y` em % — a célula é
 * uma disciplina de alinhamento aplicada na entrada e na saída, não um novo
 * sistema de coordenadas no banco.
 */
import type { Asset } from '../../types';
import {
  HALLS, SVG_W, SVG_D, UNITS_PER_WORLD, FLOOR_W, FLOOR_D, svgToWorld,
} from './plantLayout';
import type { Hall } from './plantLayout';

/** Lado da célula. 30 unidades SVG = 0,833 world — dá motor 2x2. */
export const CELL_SVG = 30;
export const CELL_WORLD = CELL_SVG / UNITS_PER_WORLD;

/** Retângulo em CÉLULAS: `col`/`row` é o canto mínimo, `w`/`h` o tamanho. */
export interface CellRect {
  col: number;
  row: number;
  w: number;
  h: number;
}

/**
 * Pegada por tipo, em células.
 *
 * Derivada dos volumes que `MachineGeometry` já desenha (world): bomba 2,4x1,1
 * cabe em 2,50x1,67; compressor 3,0x1,4 em 3,33x1,67; exaustor 1,6 em 1,67. O
 * motor (GLB, ~1,7) estoura a célula em ~2%, invisível na prática.
 *
 * É constante no código porque a variação real dentro de um tipo é menor que a
 * própria célula — um footprint por ativo custaria uma migration para nada.
 */
export const FOOTPRINT: Record<Asset['type'], [number, number]> = {
  motor: [2, 2],
  pump: [3, 2],
  compressor: [4, 2],
  fan: [2, 2],
};

export const footprintOf = (type: Asset['type']): [number, number] =>
  FOOTPRINT[type] ?? [2, 2];

// ─── Conversões ─────────────────────────────────────────────────────────────
// `plantLayout` só tinha o caminho de ida (svgToWorld, plantToWorld). Arrastar
// exige a volta: o ponteiro chega em world (3D) ou em viewBox (2D) e precisa
// virar célula.

export function worldToSvg(x: number, z: number): [number, number] {
  return [(x + FLOOR_W / 2) * UNITS_PER_WORLD, (z + FLOOR_D / 2) * UNITS_PER_WORLD];
}

export const svgToPlant = (x: number, y: number): [number, number] =>
  [(x / SVG_W) * 100, (y / SVG_D) * 100];

export const plantToSvg = (px: number, py: number): [number, number] =>
  [(px / 100) * SVG_W, (py / 100) * SVG_D];

export function worldToPlant(x: number, z: number): [number, number] {
  const [sx, sy] = worldToSvg(x, z);
  return svgToPlant(sx, sy);
}

// ─── Snap ───────────────────────────────────────────────────────────────────

/**
 * Centro desejado (SVG) → retângulo de células.
 *
 * Arredonda o CANTO, não o centro. A paridade da pegada cai fora sozinha: com
 * largura par o centro pousa numa interseção da malha, com largura ímpar no
 * meio de uma célula. Snapar o centro a múltiplos de CELL_SVG — o reflexo
 * óbvio — desalinharia a bomba 3x2 em meia célula no eixo X.
 */
export function snapToCell(svgX: number, svgY: number, fp: [number, number]): CellRect {
  const [w, h] = fp;
  return {
    col: Math.round(svgX / CELL_SVG - w / 2),
    row: Math.round(svgY / CELL_SVG - h / 2),
    w,
    h,
  };
}

export const rectCenterSvg = (r: CellRect): [number, number] =>
  [(r.col + r.w / 2) * CELL_SVG, (r.row + r.h / 2) * CELL_SVG];

/** Canto mínimo, tamanho e centro em world — o que os overlays 3D consomem. */
export function rectToWorld(r: CellRect) {
  const [x0, z0] = svgToWorld(r.col * CELL_SVG, r.row * CELL_SVG);
  const w = r.w * CELL_WORLD;
  const d = r.h * CELL_WORLD;
  return { x0, z0, w, d, cx: x0 + w / 2, cz: z0 + d / 2 };
}

/**
 * Célula → o que vai para o banco.
 *
 * `plant_x` é `numeric(5,2)`, então o valor gravado não reproduz o centro
 * exato (150 → 26.69 → 149,998). Por isso a leitura sempre volta por
 * `snapToCell`, cujo arredondamento absorve o erro — 0,03 unidade SVG contra
 * uma tolerância de meia célula (15). Nunca compare `plantX` por igualdade.
 */
const round2 = (n: number) => parseFloat(n.toFixed(2));

export function rectToPlant(r: CellRect): { plantX: number; plantY: number } {
  const [x, y] = rectCenterSvg(r);
  const [px, py] = svgToPlant(x, y);
  return { plantX: round2(px), plantY: round2(py) };
}

/** Onde um ativo está hoje, em células. */
export const footprintCells = (asset: Asset): CellRect => {
  const [sx, sy] = plantToSvg(asset.plantX, asset.plantY);
  return snapToCell(sx, sy, footprintOf(asset.type));
};

// ─── Halls ──────────────────────────────────────────────────────────────────

const HALL_CELLS = new Map<string, CellRect>();

/**
 * Células de um hall — só as que cabem INTEIRAS.
 *
 * As bordas dos halls não são múltiplas de 30 (o hall B começa em y=320), então
 * sobra uma faixa morta de até 20 unidades SVG. Ela é desenhada como piso
 * comum, nunca como célula: melhor perder meia célula na borda do que oferecer
 * uma posição onde a máquina atravessaria a parede.
 */
export function cellsForHall(hall: Hall): CellRect {
  const cached = HALL_CELLS.get(hall.id);
  if (cached) return cached;

  const { x, y, w, h } = hall.svg;
  const col = Math.ceil(x / CELL_SVG);
  const row = Math.ceil(y / CELL_SVG);
  const rect: CellRect = {
    col,
    row,
    w: Math.floor((x + w) / CELL_SVG) - col,
    h: Math.floor((y + h) / CELL_SVG) - row,
  };
  HALL_CELLS.set(hall.id, rect);
  return rect;
}

export const contains = (outer: CellRect, inner: CellRect): boolean =>
  inner.col >= outer.col
  && inner.row >= outer.row
  && inner.col + inner.w <= outer.col + outer.w
  && inner.row + inner.h <= outer.row + outer.h;

export const isInsideHall = (r: CellRect, hall: Hall): boolean =>
  contains(cellsForHall(hall), r);

/** Hall que contém a pegada INTEIRA. `null` = fora, ou a cavalo entre dois. */
export const hallForRect = (r: CellRect): Hall | null =>
  HALLS.find((h) => isInsideHall(r, h)) ?? null;

/** Sobreposição de retângulos (AABB). Encostar não é colidir. */
export const collides = (a: CellRect, b: CellRect): boolean =>
  a.col < b.col + b.w
  && b.col < a.col + a.w
  && a.row < b.row + b.h
  && b.row < a.row + a.h;

export const sameRect = (a: CellRect, b: CellRect): boolean =>
  a.col === b.col && a.row === b.row && a.w === b.w && a.h === b.h;
