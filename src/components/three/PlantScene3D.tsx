import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from '../../types';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';
import { statusConfig, statusLabel } from '../../utils/plantStatus';
import { cn } from '../../lib/utils';
import { AssetMarker } from './AssetMarker';
import { PlantFloor } from './PlantFloor';
import {
  CAMERA_HOME, CAMERA_TARGET, CAMERA_FOV, plantToWorld, frameScope, orbitLimits,
  DARK_FLOOR, LIGHT_FLOOR, Hall, ViewBounds,
} from './plantLayout';

export interface CameraFocus {
  /** 'scope' reenquadra o escopo atual; 'asset' aproxima de um equipamento. */
  kind: 'scope' | 'asset';
  assetId: string | null;
  /** Muda a cada pedido para re-disparar a animação, mesmo repetindo o alvo. */
  nonce: number;
}

interface PlantScene3DProps {
  assets: Asset[];
  halls: Hall[];
  bounds: ViewBounds;
  isolated: boolean;
  selectedAssetId: string | null;
  onSelectAsset: (id: string | null) => void;
  onIsolateHall: (area: string) => void;
  onExitIsolation: () => void;
  focus: CameraFocus;
}

/**
 * Move a câmera até um ativo ou enquadra o escopo atual.
 *
 * Reenquadra sozinho quando `bounds` muda — é isso que faz a câmera voar até o
 * hall ao trocar o filtro. A animação para ao chegar perto e é cancelada assim
 * que o usuário toca no orbit, senão brigaria com o arrasto do mouse.
 */
function CameraRig({
  focusAsset,
  bounds,
  nonce,
  controlsRef,
}: {
  focusAsset: Asset | null;
  bounds: ViewBounds;
  nonce: number;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera, size } = useThree();
  const animating = useRef(false);
  const wantPos = useRef(new THREE.Vector3(...CAMERA_HOME));
  const wantTarget = useRef(new THREE.Vector3(...CAMERA_TARGET));
  const aspect = size.width / Math.max(size.height, 1);

  useEffect(() => {
    if (focusAsset) {
      const [x, z] = plantToWorld(focusAsset.plantX, focusAsset.plantY);
      wantTarget.current.set(x, 1.1, z);
      wantPos.current.set(x + 5.5, 5.5, z + 7.5);
    } else {
      const { position, target } = frameScope(bounds, aspect, CAMERA_FOV);
      wantTarget.current.set(...target);
      wantPos.current.set(...position);
    }
    animating.current = true;
  }, [focusAsset, bounds, aspect, nonce]);

  // Qualquer interação do usuário assume o controle.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const cancel = () => {
      animating.current = false;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controlsRef]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const k = 1 - Math.exp(-4 * Math.min(delta, 0.1));
    camera.position.lerp(wantPos.current, k);
    controls.target.lerp(wantTarget.current, k);
    controls.update();

    if (camera.position.distanceTo(wantPos.current) < 0.06) {
      animating.current = false;
    }
  });

  return null;
}

/** Distância em px acima da qual um pointerup conta como arrasto, não clique. */
const DRAG_SLOP = 5;

export function PlantScene3D({
  assets,
  halls,
  bounds,
  isolated,
  selectedAssetId,
  onSelectAsset,
  onIsolateHall,
  onExitIsolation,
  focus,
}: PlantScene3DProps) {
  const { darkMode, language } = useAppStore();
  const t = translations[language].plant;
  const common = translations[language].common;
  const palette = darkMode ? DARK_FLOOR : LIGHT_FLOOR;

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<any>(null);
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  const [dpr, setDpr] = useState(1.5);
  const [hovered, setHovered] = useState<Asset | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const focusAsset = useMemo(
    () => assets.find((a) => a.id === focus.assetId) ?? null,
    [assets, focus.assetId],
  );

  const limits = useMemo(() => {
    const { distance } = frameScope(bounds, 16 / 9, CAMERA_FOV);
    return orbitLimits(distance);
  }, [bounds]);

  // ─── Guarda de arrasto ───────────────────────────────────────────────────
  // Sem isso, orbitar a câmera e soltar o botão sobre uma máquina conta como
  // clique e navega para a página do ativo. Vale para todos os alvos da cena.
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  const guard = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    if (dragged.current) return;
    fn(...args);
  };

  // Pausa o loop fora da viewport (mesmo padrão do MotorViewer).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pausa quando a aba fica oculta.
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // O cursor é alterado pelos markers; garante reset ao desmontar.
  useEffect(() => () => {
    document.body.style.cursor = 'auto';
  }, []);

  const active = inView && visible;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl"
      // `dragged` só é zerado no pointerdown seguinte, nunca no pointerup: o
      // onClick das meshes dispara durante o pointerup e precisa ler o valor.
      onPointerDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY };
        dragged.current = false;
      }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const d = downAt.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_SLOP) {
          dragged.current = true;
        }
      }}
    >
      <Canvas
        frameloop={active ? 'always' : 'never'}
        dpr={[1, dpr]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: CAMERA_HOME, fov: CAMERA_FOV }}
        onPointerMissed={guard(() => onSelectAsset(null))}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} />
        <AdaptiveDpr pixelated />

        <color attach="background" args={[palette.floor]} />
        {/* Névoa só para dissolver a borda distante do piso. `near` PRECISA
            ficar além da distância da câmera (~30) — mais perto que isso e a
            cena inteira some na cor do fundo. */}
        <fog attach="fog" args={[palette.floor, 32, 62]} />

        <ambientLight intensity={darkMode ? 0.8 : 1.0} />
        <directionalLight position={[12, 18, 10]} intensity={darkMode ? 1.15 : 1.3} />
        <directionalLight position={[-14, 8, -10]} intensity={0.3} color="#7dd3fc" />

        <PlantFloor
          palette={palette}
          halls={halls}
          bounds={bounds}
          isolated={isolated}
          onIsolateHall={guard(onIsolateHall)}
          onExitIsolation={guard(onExitIsolation)}
        />

        {assets.map((asset) => (
          <AssetMarker
            key={asset.id}
            asset={asset}
            isSelected={selectedAssetId === asset.id}
            onSelect={guard(onSelectAsset)}
            onHover={setHovered}
          />
        ))}

        <CameraRig
          focusAsset={focusAsset}
          bounds={bounds}
          nonce={focus.nonce}
          controlsRef={controlsRef}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={limits.min}
          maxDistance={limits.max}
          // Trava a vista alta: rasante demais e a planta deixa de ler como planta.
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.6}
          target={CAMERA_TARGET}
        />
      </Canvas>

      {/* Tooltip de hover — HTML, fora do canvas */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 min-w-[210px] rounded-xl border border-border bg-card px-4 py-3 shadow-panel"
          style={{
            left: Math.min(pointer.x + 18, (containerRef.current?.clientWidth ?? 800) - 230),
            top: Math.max(pointer.y - 70, 8),
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
              style={{
                color: statusConfig(hovered.status).fill,
                backgroundColor: `${statusConfig(hovered.status).fill}22`,
              }}
            >
              {hovered.tag}
            </span>
            <span
              className="text-[9px] font-bold uppercase"
              style={{ color: statusConfig(hovered.status).fill }}
            >
              {statusLabel(hovered.status, language)}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-foreground">{hovered.name}</p>
          <p className="mt-0.5 text-[10px] text-muted">{hovered.location}</p>
          <div className="mt-2 flex gap-4 border-t border-border pt-2">
            <div>
              <span className="text-[9px] uppercase text-muted">{common.disp}</span>
              <p className="text-[11px] font-bold text-foreground">{hovered.uptime.toFixed(1)}%</p>
            </div>
            <div>
              <span className="text-[9px] uppercase text-muted">{common.anomaly}</span>
              <p
                className={cn(
                  'text-[11px] font-bold',
                  hovered.anomalyScore > 50
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {hovered.anomalyScore}%
              </p>
            </div>
          </div>
          <p className="mt-2 text-[9px] font-medium text-primary">{t.click_inspect}</p>
        </div>
      )}
    </div>
  );
}

export default PlantScene3D;
