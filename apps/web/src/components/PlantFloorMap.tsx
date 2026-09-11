import React, { useState } from 'react';
import { Asset } from '../types';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { cn } from '../lib/utils';
// Fonte única das cores de status — compartilhada com a planta 3D para que as
// duas vistas nunca discordem sobre o que é "crítico".
import { STATUS_COLORS, statusLabel } from '../utils/plantStatus';
import { useIsMobile } from '../hooks/useMediaQuery';
// Geometria dos halls e malha de células — os mesmos módulos que a cena 3D usa,
// para que as duas vistas nunca discordem sobre onde um hall começa.
import { HALLS } from './three/plantLayout';
import { CELL_SVG, cellsForHall, collides, isInsideHall, snapToCell } from './three/plantGrid';
import type { CellRect } from './three/plantGrid';
import type { Hall } from './three/plantLayout';
import type { Placement } from '../hooks/usePlantLayoutEditor';

// Sequência de inspeção: ordem recomendada por área (Hall A → Hall B → Hall C → Cobertura)
const INSPECTION_ORDER: string[] = ['MTR-001', 'MTR-002', 'BBA-001', 'CMP-001', 'EXA-001'];

interface PlantFloorMapProps {
  assets: Asset[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  /**
   * Modo de posicionamento (wizard de cadastro): o clique no mapa devolve a
   * coordenada em % em vez de selecionar um ativo. Os ativos existentes
   * continuam desenhados, como referência de onde não colidir.
   */
  /**
   * Cadastro de ativo: escolher onde a máquina vai. Acompanhado de
   * `pickFootprint`, é a escolha por célula descrita abaixo.
   */
  pickMode?: boolean;
  /**
   * Escolha por CÉLULA (cadastro de ativo). Com a pegada presente, o mapa
   * desenha a malha e um fantasma do tamanho da máquina seguindo o cursor, em
   * vez de aceitar um ponto livre — o ativo nasce alinhado, como o editor de
   * layout o manteria.
   */
  pickFootprint?: [number, number] | null;
  /** Hall da área escolhida no formulário: fora dele, a célula é recusada. */
  pickHall?: Hall | null;
  pendingCell?: CellRect | null;
  /** Pegadas já ocupadas — o cadastro não pode nascer em cima de outro ativo. */
  occupiedRects?: CellRect[];
  onPickCell?: (rect: CellRect) => void;
  /** Modo de editar layout: desenha a malha e habilita o arraste com snap. */
  editMode?: boolean;
  draftRects?: Record<string, CellRect>;
  placement?: Map<string, Placement>;
  dragId?: string | null;
  onDragStart?: (id: string) => void;
  /** Recebe coordenada SVG contínua; quem snapa é o hook do editor. */
  onDragMove?: (id: string, svgX: number, svgY: number) => void;
  onDragEnd?: (id: string) => void;
}

// Paleta estrutural do blueprint — adapta ao tema (as cores de status acima são semânticas e não mudam).
interface MapPalette {
  bg: string; grid: string; hallFill: string; hallStroke: string;
  hallLabel: string; coberturaLabel: string; pipe: string; flow: string;
  badgeFill: string; tagBg: string; selectionRing: string;
}

const DARK_PALETTE: MapPalette = {
  bg: '#0d1117', grid: '#1e293b', hallFill: '#1e293b', hallStroke: '#334155',
  hallLabel: '#64748b', coberturaLabel: '#475569', pipe: '#334155', flow: '#818cf8',
  badgeFill: '#1e1b4b', tagBg: '#0d1117', selectionRing: '#ffffff',
};

const LIGHT_PALETTE: MapPalette = {
  bg: '#f8fafc', grid: '#e2e8f0', hallFill: '#e2e8f0', hallStroke: '#cbd5e1',
  hallLabel: '#64748b', coberturaLabel: '#94a3b8', pipe: '#cbd5e1', flow: '#6366f1',
  badgeFill: '#e0e7ff', tagBg: '#ffffff', selectionRing: '#0f172a',
};

const ASSET_ICONS: Record<string, string> = {
  motor:      'M',
  pump:       'B',
  compressor: 'C',
  fan:        'E',
};

export const PlantFloorMap: React.FC<PlantFloorMapProps> = ({
  assets, selectedAssetId, onSelectAsset,
  pickMode = false,
  pickFootprint = null, pickHall = null, pendingCell = null,
  occupiedRects, onPickCell,
  editMode = false, draftRects, placement, dragId = null,
  onDragStart, onDragMove, onDragEnd,
}) => {
  const { darkMode, language } = useAppStore();
  const t = translations[language].plant;
  const common = translations[language].common;
  const p = darkMode ? DARK_PALETTE : LIGHT_PALETTE;
  // Em 375px o SVG desenha ~318px de largura para um viewBox de 1000 unidades:
  // tudo encolhe 3x. Os elementos que o operador precisa ler e tocar (círculo,
  // TAG, ícone) crescem na mesma proporção; as legendas decorativas saem do
  // SVG e viram etiquetas HTML abaixo do mapa, onde continuam legíveis.
  const isMobile = useIsMobile();
  const k = isMobile ? 2.7 : 1;
  const [tooltip, setTooltip] = useState<{ asset: Asset; x: number; y: number; boxW: number } | null>(null);
  /** Célula sob o cursor no cadastro por célula — o fantasma que segue o mouse. */
  const [hoverCell, setHoverCell] = useState<CellRect | null>(null);

  /** Escolha por célula ativa: pegada definida e hall da área resolvido. */
  const cellPicking = pickMode && pickFootprint !== null;

  /**
   * Uma célula só vale se a pegada INTEIRA couber no hall da área escolhida e
   * não encostar em ativo nenhum. É a mesma regra do editor de layout — o
   * cadastro não pode criar o que o editor recusaria.
   */
  const cellIsValid = (rect: CellRect | null): boolean => {
    if (!rect || !pickHall) return false;
    if (!isInsideHall(rect, pickHall)) return false;
    return !(occupiedRects ?? []).some((o) => collides(rect, o));
  };

  // Mapeia TAG → coordenadas SVG para desenhar o fluxo de inspeção
  const assetCoords = Object.fromEntries(
    assets.map((a) => [
      a.tag ?? '',
      { cx: ((a.plantX ?? 20) / 100) * 1000, cy: ((a.plantY ?? 50) / 100) * 562 },
    ])
  );

  // Pares consecutivos da sequência que têm coordenadas disponíveis
  const inspectionSegments = INSPECTION_ORDER.slice(0, -1)
    .map((tag, i) => ({ from: tag, to: INSPECTION_ORDER[i + 1] }))
    .filter(({ from, to }) => assetCoords[from] && assetCoords[to]);

  /**
   * Ponto do evento → coordenada do viewBox, exata sob qualquer escala.
   *
   * Proporção do getBoundingClientRect não serve aqui: ela ignora o
   * preserveAspectRatio, e o viewBox é 1000/562 = 1,7794 contra um contêiner
   * 16/9 = 1,7778 — sobra ~0,1% de letterbox, o bastante para errar a célula
   * junto às bordas.
   */
  const toViewBox = (svg: SVGSVGElement, e: React.PointerEvent): [number, number] | null => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  };

  return (
    <div className="relative w-full select-none">
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      <svg
        viewBox="0 0 1000 562"
        className="w-full h-full rounded-xl overflow-hidden"
        style={
          editMode
            ? { cursor: dragId ? 'grabbing' : 'default', touchAction: 'none' }
            : cellPicking
              ? { cursor: cellIsValid(hoverCell) ? 'pointer' : 'not-allowed', touchAction: 'none' }
              : undefined
        }
        // Os handlers de movimento ficam no <svg> raiz, não no <g> do ativo: o
        // <g> some de baixo do cursor assim que a peça pula de célula, e o
        // arrasto morreria no primeiro salto.
        onPointerMove={(e) => {
          if (cellPicking) {
            const pt = toViewBox(e.currentTarget, e);
            setHoverCell(pt ? snapToCell(pt[0], pt[1], pickFootprint!) : null);
            return;
          }
          if (!editMode || !dragId || !onDragMove) return;
          const pt = toViewBox(e.currentTarget, e);
          if (pt) onDragMove(dragId, pt[0], pt[1]);
        }}
        onPointerLeave={() => { if (cellPicking) setHoverCell(null); }}
        onPointerDown={cellPicking ? (e) => {
          if (e.button !== 0) return;
          const pt = toViewBox(e.currentTarget, e);
          if (!pt) return;
          const rect = snapToCell(pt[0], pt[1], pickFootprint!);
          // Célula inválida simplesmente não fixa: o fantasma vermelho já disse
          // por quê, e aceitar aqui criaria um ativo que o editor recusaria.
          if (cellIsValid(rect)) onPickCell?.(rect);
        } : undefined}
        onPointerUp={() => { if (editMode && dragId) onDragEnd?.(dragId); }}
        onPointerCancel={() => { if (editMode && dragId) onDragEnd?.(dragId); }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fundo da fábrica */}
        <rect width="1000" height="562" fill={p.bg} />

        {/* Grade de piso. Sai na edição: o passo dela é 50 e o da malha do
            editor é 30 — sobrepostas, não dá para saber qual linha é a que o
            ativo encaixa. Ela também atravessa os halls, que são translúcidos. */}
        {!editMode && !cellPicking && (
          <g>
            {Array.from({ length: 20 }, (_, i) => (
              <line key={`gv-${i}`} x1={i * 50} y1={0} x2={i * 50} y2={562} stroke={p.grid} strokeWidth="1" />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`gh-${i}`} x1={0} y1={i * 50} x2={1000} y2={i * 50} stroke={p.grid} strokeWidth="1" />
            ))}
          </g>
        )}

        {/* Halls — desenhados a partir de HALLS (plantLayout), a mesma fonte que
            a cena 3D e a malha do editor usam. Antes eram quatro <rect> fixos
            aqui, com um comentário lá pedindo sincronia manual. */}
        {HALLS.map((hall) => (
          <g key={hall.id}>
            <rect
              x={hall.svg.x} y={hall.svg.y} width={hall.svg.w} height={hall.svg.h} rx="8"
              fill={p.hallFill}
              // Opaco na edição: o hall passa a ser o único chão desenhado, e
              // a 0,4 a Cobertura quase desaparece contra o fundo.
              fillOpacity={editMode || cellPicking ? 1 : hall.open ? 0.4 : 0.6}
              stroke={p.hallStroke} strokeWidth="1.5"
              strokeDasharray={hall.open ? '6 3' : undefined}
            />
            {!isMobile && (
              // ACIMA do retângulo, não dentro dele. Enquanto o rótulo ficava no
              // canto interno (y + 25), um ativo posicionado ali em cima o
              // cobria — do "HALL A" sobrava o "A". Os ativos vivem dentro do
              // hall, então a faixa logo acima da parede nunca disputa espaço.
              <text
                x={hall.svg.x} y={hall.svg.y - 8}
                fill={hall.open ? p.coberturaLabel : p.hallLabel}
                fontSize="13" fontWeight="700" fontFamily="monospace" letterSpacing="2"
              >
                {hall.label}
              </text>
            )}
          </g>
        ))}

        {/* Malha de células — só as que cabem inteiras no hall */}
        {editMode && HALLS.map((hall) => {
          const r = cellsForHall(hall);
          const x0 = r.col * CELL_SVG;
          const y0 = r.row * CELL_SVG;
          return (
            <g key={`grid-${hall.id}`} style={{ pointerEvents: 'none' }} opacity={0.55}>
              {Array.from({ length: r.w + 1 }, (_, i) => (
                <line key={`v${i}`} x1={x0 + i * CELL_SVG} y1={y0}
                  x2={x0 + i * CELL_SVG} y2={y0 + r.h * CELL_SVG}
                  stroke={p.hallStroke} strokeWidth="0.7" />
              ))}
              {Array.from({ length: r.h + 1 }, (_, i) => (
                <line key={`h${i}`} x1={x0} y1={y0 + i * CELL_SVG}
                  x2={x0 + r.w * CELL_SVG} y2={y0 + i * CELL_SVG}
                  stroke={p.hallStroke} strokeWidth="0.7" />
              ))}
            </g>
          );
        })}

        {/* ─── Cadastro por célula ─── malha só do hall da área escolhida */}
        {cellPicking && pickHall && (() => {
          const r = cellsForHall(pickHall);
          const x0 = r.col * CELL_SVG;
          const y0 = r.row * CELL_SVG;
          return (
            <g style={{ pointerEvents: 'none' }}>
              {/* Escurece o resto da planta: só este hall aceita o ativo. */}
              <rect x="0" y="0" width="1000" height="562" fill={p.bg} fillOpacity="0.55" />
              <rect
                x={pickHall.svg.x} y={pickHall.svg.y}
                width={pickHall.svg.w} height={pickHall.svg.h} rx="8"
                fill={p.hallFill} stroke={p.flow} strokeWidth="2"
              />
              <g opacity={0.6}>
                {Array.from({ length: r.w + 1 }, (_, i) => (
                  <line key={`pv${i}`} x1={x0 + i * CELL_SVG} y1={y0}
                    x2={x0 + i * CELL_SVG} y2={y0 + r.h * CELL_SVG}
                    stroke={p.hallStroke} strokeWidth="0.7" />
                ))}
                {Array.from({ length: r.h + 1 }, (_, i) => (
                  <line key={`ph${i}`} x1={x0} y1={y0 + i * CELL_SVG}
                    x2={x0 + r.w * CELL_SVG} y2={y0 + i * CELL_SVG}
                    stroke={p.hallStroke} strokeWidth="0.7" />
                ))}
              </g>
            </g>
          );
        })()}

        {/* Pegadas já ocupadas — onde a máquina nova não cabe */}
        {cellPicking && (occupiedRects ?? []).map((r, i) => (
          <rect
            key={`occ-${i}`} style={{ pointerEvents: 'none' }}
            x={r.col * CELL_SVG} y={r.row * CELL_SVG}
            width={r.w * CELL_SVG} height={r.h * CELL_SVG} rx="3"
            fill={p.hallStroke} fillOpacity="0.35"
            stroke={p.hallStroke} strokeWidth="1.2"
          />
        ))}

        {/* Fantasma: a pegada do tipo escolhido seguindo o cursor, e a célula
            já fixada. Verde onde cabe, vermelho onde colide ou sai do hall. */}
        {cellPicking && [
          { rect: pendingCell, fixed: true },
          { rect: hoverCell && !(pendingCell && hoverCell.col === pendingCell.col && hoverCell.row === pendingCell.row) ? hoverCell : null, fixed: false },
        ].map(({ rect, fixed }, i) => {
          if (!rect) return null;
          const valid = cellIsValid(rect);
          const color = valid ? (fixed ? p.flow : '#10b981') : STATUS_COLORS.critical.fill;
          return (
            <rect
              key={`ghost-${i}`} style={{ pointerEvents: 'none' }}
              x={rect.col * CELL_SVG} y={rect.row * CELL_SVG}
              width={rect.w * CELL_SVG} height={rect.h * CELL_SVG} rx="3"
              fill={color} fillOpacity={fixed ? 0.3 : 0.18}
              stroke={color} strokeWidth="2"
              strokeDasharray={fixed ? undefined : '6 4'}
            />
          );
        })}

        {/* Pegada de cada ativo — um retângulo por ativo, não N células */}
        {editMode && assets.map((asset) => {
          const r = draftRects?.[asset.id];
          if (!r) return null;
          const state = placement?.get(asset.id) ?? 'ok';
          const isDragging = asset.id === dragId;
          const color = state !== 'ok'
            ? STATUS_COLORS.critical.fill
            : isDragging ? p.flow : p.hallStroke;
          return (
            <rect
              key={`fp-${asset.id}`}
              style={{ pointerEvents: 'none' }}
              x={r.col * CELL_SVG} y={r.row * CELL_SVG}
              width={r.w * CELL_SVG} height={r.h * CELL_SVG} rx="3"
              fill={color} fillOpacity={state === 'ok' ? 0.14 : 0.3}
              stroke={color} strokeWidth={isDragging ? 2 : 1.4}
              strokeDasharray={isDragging ? '6 4' : undefined}
            />
          );
        })}

        {/* Definição da ponta de seta do fluxo de inspeção */}
        <defs>
          <marker id="inspection-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={p.flow} opacity="0.9" />
          </marker>
        </defs>

        {/* Fluxo de inspeção — escondido na edição: as setas cruzam a malha
            e disputam leitura com as pegadas. */}
        {!editMode && inspectionSegments.map(({ from, to }) => {
          const f = assetCoords[from];
          const t = assetCoords[to];
          // Encurta a linha para não sobrepor os círculos (raio 20 + margem)
          const dx = t.cx - f.cx;
          const dy = t.cy - f.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const margin = 26;
          const ratio = margin / (dist || 1);
          return (
            <line
              key={`flow-${from}-${to}`}
              x1={f.cx + dx * ratio}
              y1={f.cy + dy * ratio}
              x2={t.cx - dx * ratio}
              y2={t.cy - dy * ratio}
              stroke={p.flow}
              strokeWidth="1.5"
              strokeDasharray="6 4"
              opacity="0.7"
              markerEnd="url(#inspection-arrow)"
            />
          );
        })}

        {/* Tubulações decorativas — some na edição junto com o resto do piso. */}
        {!editMode && (
          <g>
            <line x1="30" y1="295" x2="450" y2="295" stroke={p.pipe} strokeWidth="4" />
            <line x1="450" y1="295" x2="450" y2="320" stroke={p.pipe} strokeWidth="4" />
            <line x1="450" y1="295" x2="480" y2="295" stroke={p.pipe} strokeWidth="4" />
            <line x1="480" y1="295" x2="480" y2="320" stroke={p.pipe} strokeWidth="4" />
          </g>
        )}

        {/* Hotspots dos ativos */}
        {assets.map((asset) => {
          const cx = ((asset.plantX ?? 20) / 100) * 1000;
          const cy = ((asset.plantY ?? 50) / 100) * 562;
          const cfg = STATUS_COLORS[asset.status] ?? STATUS_COLORS.normal;
          const isSelected = selectedAssetId === asset.id;
          const icon = ASSET_ICONS[asset.type] ?? '?';

          return (
            <g
              key={asset.id}
              // Em pickMode os ativos são só referência visual: o clique tem de
              // atravessar até o SVG, senão soltar o marcador em cima de um
              // ativo existente selecionaria o ativo em vez de fixar a posição.
              style={
                pickMode ? { pointerEvents: 'none' }
                  : editMode ? { cursor: asset.id === dragId ? 'grabbing' : 'grab' }
                    : { cursor: 'pointer' }
              }
              onPointerDown={editMode ? (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                // Captura no <svg>: o ponteiro continua sendo entregue mesmo
                // quando sai do elemento (e da própria janela) durante o arrasto.
                e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                onDragStart?.(asset.id);
              } : undefined}
              onClick={editMode ? undefined : () => onSelectAsset(isSelected ? null : asset.id)}
              // Sem tooltip na edição: o card seguiria o cursor por cima da
              // malha justamente enquanto se escolhe a célula de destino.
              onMouseEnter={editMode ? undefined : (e) => {
                const svg = (e.target as SVGElement).closest('svg')!;
                const rect = svg.getBoundingClientRect();
                setTooltip({
                  asset,
                  x: (cx / 1000) * rect.width,
                  y: (cy / 562) * rect.height,
                  boxW: rect.width,
                });
              }}
              onMouseLeave={editMode ? undefined : () => setTooltip(null)}
            >
              {/* Anel de pulso (status crítico/warning) */}
              {(asset.status === 'critical' || asset.status === 'warning') && (
                <circle cx={cx} cy={cy} r={26 * k} fill="none" stroke={cfg.pulse} strokeWidth={2 * k} opacity="0.4">
                  <animate attributeName="r" values={`${22 * k};${30 * k};${22 * k}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Anel de seleção */}
              {isSelected && (
                <circle cx={cx} cy={cy} r={28 * k} fill="none" stroke={p.selectionRing} strokeWidth={2.5 * k} opacity="0.9" />
              )}

              {/* Círculo principal */}
              <circle
                cx={cx} cy={cy} r={20 * k}
                fill={cfg.fill} fillOpacity={isSelected ? 1 : 0.85}
                stroke={cfg.stroke} strokeWidth={(isSelected ? 2.5 : 1.5) * k}
              />

              {/* Ícone */}
              <text x={cx} y={cy + k} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={11 * k} fontWeight="800" fontFamily="monospace">{icon}</text>

              {/* Badge de ordem de inspeção */}
              {(() => {
                const order = INSPECTION_ORDER.indexOf(asset.tag ?? '');
                if (order === -1) return null;
                return (
                  <g>
                    <circle cx={cx + 14 * k} cy={cy - 14 * k} r={9 * k} fill={p.badgeFill} stroke={p.flow} strokeWidth={1.5 * k} />
                    <text x={cx + 14 * k} y={cy - 14 * k} textAnchor="middle" dominantBaseline="middle"
                      fill={p.flow} fontSize={8 * k} fontWeight="800" fontFamily="monospace">
                      {order + 1}
                    </text>
                  </g>
                );
              })()}

              {/* TAG label */}
              <rect x={cx - 22 * k} y={cy + 24 * k} width={44 * k} height={16 * k} rx={3 * k} fill={p.tagBg} fillOpacity="0.85" />
              <text x={cx} y={cy + 32 * k} textAnchor="middle" dominantBaseline="middle"
                fill={cfg.fill} fontSize={8.5 * k} fontWeight="700" fontFamily="monospace" letterSpacing={0.5 * k}>
                {asset.tag ?? asset.id.toUpperCase().substring(0, 7)}
              </text>
            </g>
          );
        })}
      </svg>
      </div>

      {/* A legenda vive FORA do SVG, em qualquer largura. Dentro dela ficava
          ancorada no rodapé do viewBox (y=530) e qualquer ativo posicionado na
          faixa de baixo da planta — posição que o editor de layout permite —
          desenhava a TAG por cima dela. Aqui embaixo não há o que colidir, e no
          celular ela deixa de encolher para ~3px junto com o resto do desenho. */}
      {!pickMode && !editMode && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {Object.entries(STATUS_COLORS).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.fill }} />
              <span className="text-[10px] font-semibold text-muted">{statusLabel(key, language)}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            {/* Seta própria: o marker `inspection-arrow` é do outro SVG. */}
            <svg width="26" height="8" viewBox="0 0 26 8" aria-hidden className="flex-shrink-0">
              <line x1="0" y1="4" x2="18" y2="4" stroke={p.flow} strokeWidth="1.5" strokeDasharray="5 3" />
              <path d="M18,1 L18,7 L25,4 z" fill={p.flow} opacity="0.9" />
            </svg>
            <span className="text-[10px] font-semibold text-muted">{t.flow_label}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full border font-mono text-[8px] font-extrabold"
              style={{ backgroundColor: p.badgeFill, borderColor: p.flow, color: p.flow }}
            >
              N
            </span>
            <span className="text-[10px] font-semibold text-muted">{t.order_label}</span>
          </span>
        </div>
      )}

      {/* Tooltip HTML */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-card border border-border rounded-xl shadow-panel px-4 py-3 w-[220px] max-w-[calc(100%-1rem)]"
          style={{
            left: Math.max(0, Math.min(tooltip.x + 16, tooltip.boxW - 228)),
            top: Math.max(tooltip.y - 80, 8),
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded font-mono',
              tooltip.asset.status === 'critical' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
              tooltip.asset.status === 'warning' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
              'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
            )}>
              {tooltip.asset.tag}
            </span>
            <span className={cn(
              'text-[9px] font-bold uppercase',
              tooltip.asset.status === 'critical' ? 'text-red-600 dark:text-red-400' :
              tooltip.asset.status === 'warning' ? 'text-amber-600 dark:text-amber-400' :
              'text-emerald-600 dark:text-emerald-400',
            )}>
              {statusLabel(tooltip.asset.status, language)}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-foreground">{tooltip.asset.name}</p>
          <p className="text-[10px] text-muted mt-0.5">{tooltip.asset.location}</p>
          {tooltip.asset.nameplate && (
            <p className="text-[9px] text-muted mt-0.5">
              {tooltip.asset.nameplate.manufacturer} {tooltip.asset.nameplate.model}
            </p>
          )}
          <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-x-4 gap-y-2">
            <div>
              <span className="text-[9px] text-muted uppercase">{common.disp}</span>
              <p className="text-[11px] font-bold text-foreground">{tooltip.asset.uptime.toFixed(1)}%</p>
            </div>
            <div>
              <span className="text-[9px] text-muted uppercase">{common.anomaly}</span>
              <p className={cn(
                'text-[11px] font-bold',
                tooltip.asset.anomalyScore > 50 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
              )}>{tooltip.asset.anomalyScore}%</p>
            </div>
            <div>
              <span className="text-[9px] text-muted uppercase">{common.sensors}</span>
              <p className="text-[11px] font-bold text-foreground">{tooltip.asset.sensors.length}</p>
            </div>
          </div>
          <p className="text-[9px] text-primary mt-2 font-medium">{t.click_select}</p>
        </div>
      )}
    </div>
  );
};
