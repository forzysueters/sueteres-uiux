import React, { useState } from 'react';
import { Asset } from '../types';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';
import { cn } from '../lib/utils';
// Fonte única das cores de status — compartilhada com a planta 3D para que as
// duas vistas nunca discordem sobre o que é "crítico".
import { STATUS_COLORS, statusLabel } from '../utils/plantStatus';
import { useIsMobile } from '../hooks/useMediaQuery';

// Sequência de inspeção: ordem recomendada por área (Hall A → Hall B → Hall C → Cobertura)
const INSPECTION_ORDER: string[] = ['MTR-001', 'MTR-002', 'BBA-001', 'CMP-001', 'EXA-001'];

interface PlantFloorMapProps {
  assets: Asset[];
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
}

// Paleta estrutural do blueprint — adapta ao tema (as cores de status acima são semânticas e não mudam).
interface MapPalette {
  bg: string; grid: string; hallFill: string; hallStroke: string;
  hallLabel: string; coberturaLabel: string; pipe: string; flow: string;
  badgeFill: string; tagBg: string; legendText: string; selectionRing: string;
}

const DARK_PALETTE: MapPalette = {
  bg: '#0d1117', grid: '#1e293b', hallFill: '#1e293b', hallStroke: '#334155',
  hallLabel: '#64748b', coberturaLabel: '#475569', pipe: '#334155', flow: '#818cf8',
  badgeFill: '#1e1b4b', tagBg: '#0d1117', legendText: '#94a3b8', selectionRing: '#ffffff',
};

const LIGHT_PALETTE: MapPalette = {
  bg: '#f8fafc', grid: '#e2e8f0', hallFill: '#e2e8f0', hallStroke: '#cbd5e1',
  hallLabel: '#64748b', coberturaLabel: '#94a3b8', pipe: '#cbd5e1', flow: '#6366f1',
  badgeFill: '#e0e7ff', tagBg: '#ffffff', legendText: '#475569', selectionRing: '#0f172a',
};

const ASSET_ICONS: Record<string, string> = {
  motor:      'M',
  pump:       'B',
  compressor: 'C',
  fan:        'E',
};

export const PlantFloorMap: React.FC<PlantFloorMapProps> = ({ assets, selectedAssetId, onSelectAsset }) => {
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

  return (
    <div className="relative w-full select-none">
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      <svg
        viewBox="0 0 1000 562"
        className="w-full h-full rounded-xl overflow-hidden"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fundo da fábrica */}
        <rect width="1000" height="562" fill={p.bg} />

        {/* Grade de piso */}
        {Array.from({ length: 20 }, (_, i) => (
          <line key={`gv-${i}`} x1={i * 50} y1={0} x2={i * 50} y2={562} stroke={p.grid} strokeWidth="1" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`gh-${i}`} x1={0} y1={i * 50} x2={1000} y2={i * 50} stroke={p.grid} strokeWidth="1" />
        ))}

        {/* HALL A */}
        <rect x="30" y="30" width="420" height="260" rx="8" fill={p.hallFill} fillOpacity="0.6" stroke={p.hallStroke} strokeWidth="1.5" />
        {!isMobile && <text x="50" y="55" fill={p.hallLabel} fontSize="13" fontWeight="700" fontFamily="monospace" letterSpacing="2">HALL A</text>}

        {/* HALL B */}
        <rect x="30" y="320" width="420" height="210" rx="8" fill={p.hallFill} fillOpacity="0.6" stroke={p.hallStroke} strokeWidth="1.5" />
        {!isMobile && <text x="50" y="345" fill={p.hallLabel} fontSize="13" fontWeight="700" fontFamily="monospace" letterSpacing="2">HALL B</text>}

        {/* HALL C */}
        <rect x="480" y="320" width="490" height="210" rx="8" fill={p.hallFill} fillOpacity="0.6" stroke={p.hallStroke} strokeWidth="1.5" />
        {!isMobile && <text x="500" y="345" fill={p.hallLabel} fontSize="13" fontWeight="700" fontFamily="monospace" letterSpacing="2">HALL C</text>}

        {/* Área técnica / cobertura */}
        <rect x="480" y="30" width="490" height="260" rx="8" fill={p.hallFill} fillOpacity="0.4" stroke={p.hallStroke} strokeWidth="1.5" strokeDasharray="6 3" />
        {!isMobile && <text x="500" y="55" fill={p.coberturaLabel} fontSize="13" fontWeight="700" fontFamily="monospace" letterSpacing="2">COBERTURA / ÁREA TÉCNICA</text>}

        {/* Definição da ponta de seta do fluxo de inspeção */}
        <defs>
          <marker id="inspection-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={p.flow} opacity="0.9" />
          </marker>
        </defs>

        {/* Fluxo de inspeção — linhas tracejadas entre ativos */}
        {inspectionSegments.map(({ from, to }) => {
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

        {/* Tubulações decorativas */}
        <line x1="30" y1="295" x2="450" y2="295" stroke={p.pipe} strokeWidth="4" />
        <line x1="450" y1="295" x2="450" y2="320" stroke={p.pipe} strokeWidth="4" />
        <line x1="450" y1="295" x2="480" y2="295" stroke={p.pipe} strokeWidth="4" />
        <line x1="480" y1="295" x2="480" y2="320" stroke={p.pipe} strokeWidth="4" />

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
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectAsset(isSelected ? null : asset.id)}
              onMouseEnter={(e) => {
                const svg = (e.target as SVGElement).closest('svg')!;
                const rect = svg.getBoundingClientRect();
                setTooltip({
                  asset,
                  x: (cx / 1000) * rect.width,
                  y: (cy / 562) * rect.height,
                  boxW: rect.width,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
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

        {/* Legenda — status dos ativos */}
        {!isMobile && Object.entries(STATUS_COLORS).map(([key, cfg], i) => (
          <g key={key} transform={`translate(${30 + i * 110}, 535)`}>
            <circle cx={8} cy={8} r={6} fill={cfg.fill} fillOpacity="0.85" />
            <text x={18} y={12} fill={p.legendText} fontSize="10" fontFamily="sans-serif">{cfg.label}</text>
          </g>
        ))}

        {/* Legenda — fluxo de inspeção */}
        <g transform="translate(510, 530)" style={{ display: isMobile ? 'none' : undefined }}>
          <line x1={0} y1={8} x2={22} y2={8} stroke={p.flow} strokeWidth="1.5" strokeDasharray="5 3" markerEnd="url(#inspection-arrow)" />
          <text x={28} y={12} fill={p.legendText} fontSize="10" fontFamily="sans-serif">{t.flow_label}</text>
          <circle cx={140} cy={8} r={7} fill={p.badgeFill} stroke={p.flow} strokeWidth="1.5" />
          <text x={140} y={12} textAnchor="middle" dominantBaseline="middle" fill={p.flow} fontSize="7" fontWeight="800" fontFamily="monospace">N</text>
          <text x={152} y={12} fill={p.legendText} fontSize="10" fontFamily="sans-serif">{t.order_label}</text>
        </g>
      </svg>
      </div>

      {/* No celular as legendas saem do SVG (ficariam com ~3px) e viram
          etiquetas HTML logo abaixo do mapa. */}
      {isMobile && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {Object.entries(STATUS_COLORS).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.fill }} />
              <span className="text-[10px] font-semibold text-muted">{statusLabel(key, language)}</span>
            </span>
          ))}
          <span className="text-[10px] font-semibold text-muted">· {t.flow_label}</span>
          <span className="text-[10px] font-semibold text-muted">· {t.order_label}</span>
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
