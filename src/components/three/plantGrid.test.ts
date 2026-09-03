import { describe, it, expect } from 'vitest';
import { HALLS } from './plantLayout';
import {
  CELL_SVG, cellsForHall, collides, contains, footprintCells, footprintOf,
  hallForRect, plantToSvg, rectToPlant, snapToCell, worldToPlant, worldToSvg,
} from './plantGrid';
import { plantToWorld } from './plantLayout';
import type { Asset } from '../../types';

/**
 * Invariantes da malha de layout.
 *
 * A malha é a única parte do editor que dá para provar sem navegador: se o
 * round-trip célula → banco → célula não for identidade, um ativo "anda"
 * sozinho a cada salvamento, e isso não apareceria em nenhum teste de UI.
 */

const asset = (
  tag: string, type: Asset['type'], area: string, plantX: number, plantY: number,
): Asset => ({
  id: `id-${tag}`,
  tag,
  name: tag,
  type,
  area,
  areaId: `area-${area}`,
  location: '',
  status: 'normal',
  uptime: 100,
  sensors: [],
  lastMaintenance: '',
  nextMaintenance: '',
  x: 1,
  y: 1,
  plantX,
  plantY,
  anomalyScore: 0,
  thermalResidual: null,
});

/** Os 7 ativos que já existem: 5 do seed.sql e 2 da migração 0014. */
const EXISTING: Asset[] = [
  asset('MTR-001', 'motor', 'Hall A', 20, 25),
  asset('MTR-002', 'motor', 'Hall A', 36, 25),
  asset('LAB-S1', 'motor', 'Hall A', 22, 45),
  asset('LAB-S2', 'motor', 'Hall A', 38, 45),
  asset('BBA-001', 'pump', 'Hall B', 20, 65),
  asset('CMP-001', 'compressor', 'Hall C', 70, 65),
  asset('EXA-001', 'fan', 'Cobertura', 55, 20),
];

describe('células dos halls', () => {
  it('cobre só as células que cabem inteiras', () => {
    const byId = Object.fromEntries(HALLS.map((h) => [h.id, cellsForHall(h)]));

    expect(byId['hall-a']).toEqual({ col: 1, row: 1, w: 14, h: 8 });
    expect(byId['hall-b']).toEqual({ col: 1, row: 11, w: 14, h: 6 });
    expect(byId['hall-c']).toEqual({ col: 16, row: 11, w: 16, h: 6 });
    expect(byId['cobertura']).toEqual({ col: 16, row: 1, w: 16, h: 8 });
  });

  it('nenhuma célula de hall escapa do retângulo do hall no SVG', () => {
    for (const hall of HALLS) {
      const r = cellsForHall(hall);
      expect(r.col * CELL_SVG).toBeGreaterThanOrEqual(hall.svg.x);
      expect(r.row * CELL_SVG).toBeGreaterThanOrEqual(hall.svg.y);
      expect((r.col + r.w) * CELL_SVG).toBeLessThanOrEqual(hall.svg.x + hall.svg.w);
      expect((r.row + r.h) * CELL_SVG).toBeLessThanOrEqual(hall.svg.y + hall.svg.h);
    }
  });

  it('os halls não compartilham célula', () => {
    const rects = HALLS.map(cellsForHall);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(collides(rects[i], rects[j])).toBe(false);
      }
    }
  });
});

describe('round-trip célula → banco → célula', () => {
  // `plant_x` é numeric(5,2): o centro gravado não é exato. Se o arredondamento
  // não absorvesse a diferença, um ativo mudaria de célula a cada salvamento.
  it('é identidade para toda célula de todo hall, em toda pegada', () => {
    const sizes: [number, number][] = [[2, 2], [3, 2], [4, 2]];

    for (const hall of HALLS) {
      const area = cellsForHall(hall);
      for (const fp of sizes) {
        for (let col = area.col; col + fp[0] <= area.col + area.w; col++) {
          for (let row = area.row; row + fp[1] <= area.row + area.h; row++) {
            const rect = { col, row, w: fp[0], h: fp[1] };
            const { plantX, plantY } = rectToPlant(rect);
            const back = snapToCell(...plantToSvg(plantX, plantY), fp);
            expect(back).toEqual(rect);
          }
        }
      }
    }
  });

  it('a posição gravada respeita a constraint 0-100 do banco', () => {
    for (const hall of HALLS) {
      const r = cellsForHall(hall);
      for (const corner of [
        { col: r.col, row: r.row, w: 2, h: 2 },
        { col: r.col + r.w - 2, row: r.row + r.h - 2, w: 2, h: 2 },
      ]) {
        const { plantX, plantY } = rectToPlant(corner);
        expect(plantX).toBeGreaterThanOrEqual(0);
        expect(plantX).toBeLessThanOrEqual(100);
        expect(plantY).toBeGreaterThanOrEqual(0);
        expect(plantY).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('ativos existentes', () => {
  // Rede de segurança do alinhamento: ligar a malha não pode bagunçar o que já
  // está posicionado no banco hoje.
  it('todos caem dentro do hall da própria área', () => {
    for (const a of EXISTING) {
      const hall = hallForRect(footprintCells(a));
      expect(hall, `${a.tag} ficou fora de qualquer hall`).not.toBeNull();
      expect(hall!.area, `${a.tag} mudou de hall ao alinhar`).toBe(a.area);
    }
  });

  it('nenhum colide com outro depois do alinhamento', () => {
    const rects = EXISTING.map((a) => ({ tag: a.tag, rect: footprintCells(a) }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(
          collides(rects[i].rect, rects[j].rect),
          `${rects[i].tag} colide com ${rects[j].tag}`,
        ).toBe(false);
      }
    }
  });

  it('o alinhamento move menos de meia célula', () => {
    for (const a of EXISTING) {
      const { plantX, plantY } = rectToPlant(footprintCells(a));
      const [x0, y0] = plantToSvg(a.plantX, a.plantY);
      const [x1, y1] = plantToSvg(plantX, plantY);
      expect(Math.abs(x1 - x0), `${a.tag} em X`).toBeLessThanOrEqual(CELL_SVG / 2);
      expect(Math.abs(y1 - y0), `${a.tag} em Y`).toBeLessThanOrEqual(CELL_SVG / 2);
    }
  });
});

describe('colisão e contenção', () => {
  const base = { col: 5, row: 5, w: 2, h: 2 };

  it('encostar não é colidir', () => {
    expect(collides(base, { col: 7, row: 5, w: 2, h: 2 })).toBe(false);
    expect(collides(base, { col: 5, row: 7, w: 2, h: 2 })).toBe(false);
  });

  it('sobrepor uma célula é colidir, e é simétrico', () => {
    const over = { col: 6, row: 6, w: 2, h: 2 };
    expect(collides(base, over)).toBe(true);
    expect(collides(over, base)).toBe(true);
  });

  it('pegada maior que o vão não cabe', () => {
    // Um compressor 4x2 não entra num vão de 3 células.
    expect(contains({ col: 0, row: 0, w: 3, h: 4 }, { col: 0, row: 0, w: 4, h: 2 })).toBe(false);
  });

  it('pegada a cavalo entre dois halls não pertence a nenhum', () => {
    // Hall A termina na coluna 15; Cobertura começa na 16.
    expect(hallForRect({ col: 14, row: 3, w: 4, h: 2 })).toBeNull();
  });
});

describe('inversos das conversões', () => {
  it('worldToSvg desfaz svgToWorld', () => {
    for (const [x, y] of [[30, 30], [500, 281], [970, 530]] as [number, number][]) {
      const [wx, wz] = worldToSvg(...(plantToWorld(...(([
        (x / 1000) * 100, (y / 562) * 100,
      ]) as [number, number]))));
      expect(wx).toBeCloseTo(x, 6);
      expect(wz).toBeCloseTo(y, 6);
    }
  });

  it('worldToPlant desfaz plantToWorld', () => {
    for (const [px, py] of [[20, 25], [55, 20], [70, 65]] as [number, number][]) {
      const [bx, by] = worldToPlant(...plantToWorld(px, py));
      expect(bx).toBeCloseTo(px, 6);
      expect(by).toBeCloseTo(py, 6);
    }
  });
});

describe('pegadas', () => {
  it('cada tipo tem o tamanho previsto', () => {
    expect(footprintOf('motor')).toEqual([2, 2]);
    expect(footprintOf('pump')).toEqual([3, 2]);
    expect(footprintOf('compressor')).toEqual([4, 2]);
    expect(footprintOf('fan')).toEqual([2, 2]);
  });

  it('pegada ímpar pousa no meio da célula, par na interseção', () => {
    // Bomba 3x2 centrada em (150, 90) → colunas 4-6, linhas 2-3.
    expect(snapToCell(150, 90, [3, 2])).toEqual({ col: 4, row: 2, w: 3, h: 2 });
    // Motor 2x2 centrado no mesmo ponto → colunas 4-5.
    expect(snapToCell(150, 90, [2, 2])).toEqual({ col: 4, row: 2, w: 2, h: 2 });
  });
});
