/**
 * Geometria da planta em world-space.
 *
 * As dimensões derivam do viewBox do PlantFloorMap (1000x562) para que a vista
 * 3D e o mapa SVG concordem: um ativo dentro do HALL A no SVG cai dentro do
 * HALL A aqui. Mexeu num hall lá? Mexa aqui também.
 */

export const SVG_W = 1000;
export const SVG_D = 562;

/**
 * Escala de conversão: N unidades de SVG = 1 unidade de mundo.
 * Calibrado contra o tamanho das máquinas (~2,5 unidades): com o piso largo
 * demais os equipamentos viram pontinhos e a triagem morre.
 */
const UNITS_PER_WORLD = 36;

export const FLOOR_W = SVG_W / UNITS_PER_WORLD; // ~27.8
export const FLOOR_D = SVG_D / UNITS_PER_WORLD; // ~15.6

/** Coordenada do viewBox SVG → world (X, Z), com origem no centro do piso. */
export function svgToWorld(x: number, y: number): [number, number] {
  return [x / UNITS_PER_WORLD - FLOOR_W / 2, y / UNITS_PER_WORLD - FLOOR_D / 2];
}

/** plantX/plantY (0-100, como no mock) → world (X, Z). */
export function plantToWorld(plantX = 20, plantY = 50): [number, number] {
  return svgToWorld((plantX / 100) * SVG_W, (plantY / 100) * SVG_D);
}

export interface Hall {
  id: string;
  label: string;
  /**
   * Casa exatamente com `asset.area` do mock (services/api.ts).
   * É o que liga o filtro da toolbar ao hall desenhado na cena — sem isso,
   * `'Cobertura'` nunca acharia `'COBERTURA / ÁREA TÉCNICA'`.
   */
  area: string;
  /** Centro em world-space. */
  center: [number, number];
  /** Largura (X) e profundidade (Z) em world-space. */
  size: [number, number];
  /** Área técnica é aberta — sem paredes, piso mais discreto. */
  open?: boolean;
}

/** Retângulo do SVG (x, y, w, h) → Hall. */
function hall(
  id: string, label: string, area: string,
  x: number, y: number, w: number, h: number, open = false,
): Hall {
  return {
    id,
    label,
    area,
    center: svgToWorld(x + w / 2, y + h / 2),
    size: [w / UNITS_PER_WORLD, h / UNITS_PER_WORLD],
    open,
  };
}

/** Espelha os <rect> hardcoded de PlantFloorMap.tsx (L85-98). */
export const HALLS: Hall[] = [
  hall('hall-a', 'HALL A', 'Hall A', 30, 30, 420, 260),
  hall('hall-b', 'HALL B', 'Hall B', 30, 320, 420, 210),
  hall('hall-c', 'HALL C', 'Hall C', 480, 320, 490, 210),
  hall('cobertura', 'COBERTURA / ÁREA TÉCNICA', 'Cobertura', 480, 30, 490, 260, true),
];

/**
 * Hall correspondente ao filtro de área, ou `null` para a planta inteira.
 * Área desconhecida cai em `null` de propósito: melhor mostrar a planta toda
 * do que renderizar uma cena vazia.
 */
export function hallForArea(area: string): Hall | null {
  if (!area || area === 'all') return null;
  return HALLS.find((h) => h.area === area) ?? null;
}

/** Altura das paredes-guia dos halls (baixas de propósito: não podem ocluir). */
export const WALL_HEIGHT = 0.55;

/**
 * Paleta estrutural da cena.
 *
 * Mora aqui, e não junto do componente PlantFloor, porque o React Fast Refresh
 * invalida o módulo inteiro quando ele mistura componentes com outros exports —
 * e invalidar o módulo remonta o <Canvas> e derruba o contexto WebGL.
 *
 * Nada de âmbar: `--primary` e `--warning` são o mesmo #f59e0b no index.css, e
 * âmbar decorativo na estrutura faria o alerta âmbar deixar de ler como alerta.
 */
export interface FloorPalette {
  floor: string;
  grid: string;
  gridCenter: string;
  hallPad: string;
  wall: string;
  label: string;
  labelOpen: string;
}

export const DARK_FLOOR: FloorPalette = {
  floor: '#0b0e14',
  grid: '#1c2433',
  gridCenter: '#28324a',
  hallPad: '#141b27',
  wall: '#2a3446',
  label: '#64748b',
  labelOpen: '#475569',
};

export const LIGHT_FLOOR: FloorPalette = {
  floor: '#eef1f6',
  grid: '#d3dae5',
  gridCenter: '#b9c3d3',
  hallPad: '#e2e8f0',
  wall: '#c3ccdb',
  label: '#64748b',
  labelOpen: '#94a3b8',
};

/**
 * Direção da câmera — três-quartos alto. Como o alvo padrão é a origem, este
 * vetor também É a direção; enquadramentos de outros escopos reusam a direção
 * normalizada dele para o ângulo não mudar ao trocar de hall.
 */
export const CAMERA_HOME: [number, number, number] = [12.5, 13, 18];
export const CAMERA_TARGET: [number, number, number] = [0, 0, 0];
export const CAMERA_FOV = 42;

// ─── Escopos de visualização ────────────────────────────────────────────────

export type Vec3 = [number, number, number];

/** Retângulo do piso que a câmera precisa enquadrar. */
export interface ViewBounds {
  center: [number, number];
  size: [number, number];
  /**
   * Câmera calibrada à mão. Quando presente, dispensa o cálculo geométrico —
   * usado na vista geral, onde o cálculo enquadra os cantos vazios do piso e
   * desperdiça ~30% de tela em relação ao enquadramento aprovado.
   */
  camera?: Vec3;
}

/** A planta inteira. */
export const PLANT_BOUNDS: ViewBounds = {
  center: [0, 0],
  size: [FLOOR_W, FLOOR_D],
  camera: CAMERA_HOME,
};

export function hallBounds(hall: Hall): ViewBounds {
  return { center: hall.center, size: hall.size };
}

/** Altura de conteúdo considerada no enquadramento (máquina mais alta ~2,2). */
const CONTENT_HEIGHT = 2.4;
/** Folga em volta do escopo enquadrado. */
const FRAME_PADDING = 1.08;

// Vetores em tupla, não THREE.Vector3: este módulo é importado pelo
// PlantNavigation, e importar `three` aqui traria a biblioteca inteira para o
// bundle inicial, anulando o lazy-loading da cena.
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Posição de câmera que enquadra `bounds` mantendo o ângulo três-quartos.
 *
 * Projeta os 8 cantos da caixa no espaço da câmera e resolve a distância
 * mínima que mantém todos dentro do frustum, nos dois eixos. Uma esfera
 * envolvente seria mais simples, mas afasta demais em retângulos alongados —
 * e todos os halls são alongados.
 */
function frameBounds(
  bounds: ViewBounds,
  aspect: number,
  fovDeg: number = CAMERA_FOV,
): { position: Vec3; target: Vec3; distance: number } {
  const [cx, cz] = bounds.center;
  const [w, d] = bounds.size;
  const center: Vec3 = [cx, 0, cz];

  const dir = unit(CAMERA_HOME);       // do alvo para a câmera
  const forward = mul(dir, -1);        // para onde a câmera olha
  const right = unit(cross(forward, [0, 1, 0]));
  const up = unit(cross(right, forward));

  const vTan = Math.tan((fovDeg * Math.PI) / 360);
  const hTan = vTan * aspect;

  let distance = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const y of [0, CONTENT_HEIGHT]) {
        const v = sub([cx + (sx * w) / 2, y, cz + (sz * d) / 2], center);
        const px = dot(v, right);
        const py = dot(v, up);
        const pz = dot(v, forward);
        // canto visível quando |px| <= (distance + pz) * hTan
        distance = Math.max(distance, Math.abs(px) / hTan - pz, Math.abs(py) / vTan - pz);
      }
    }
  }

  distance *= FRAME_PADDING;
  return { position: add(center, mul(dir, distance)), target: center, distance };
}

/** Enquadramento de um escopo: câmera calibrada quando existe, senão cálculo. */
export function frameScope(
  bounds: ViewBounds,
  aspect: number,
  fovDeg: number = CAMERA_FOV,
): { position: Vec3; target: Vec3; distance: number } {
  if (bounds.camera) {
    const target: Vec3 = [bounds.center[0], 0, bounds.center[1]];
    return {
      position: bounds.camera,
      target,
      distance: Math.hypot(...sub(bounds.camera, target)),
    };
  }
  return frameBounds(bounds, aspect, fovDeg);
}

/**
 * Limites de órbita proporcionais ao escopo. Sem isso, dentro de um hall o
 * maxDistance da planta inteira deixa o usuário afastar até perder o hall.
 */
export function orbitLimits(distance: number): { min: number; max: number } {
  return { min: Math.max(2.5, distance * 0.32), max: distance * 1.7 };
}
