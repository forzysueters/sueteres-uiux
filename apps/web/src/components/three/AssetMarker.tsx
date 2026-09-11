import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from '../../types';
import { statusConfig, statusUrgency } from '../../utils/plantStatus';
import { plantToWorld, hallForArea } from './plantLayout';
import { worldToSvg } from './plantGrid';
import { useFloorPointer } from './useFloorPointer';
import { MachineGeometry } from './MachineGeometry';
import { cn } from '../../lib/utils';

/**
 * Um equipamento na planta 3D.
 *
 * Quem carrega o status em repouso é o ANEL no piso: colorido sempre, pulsante
 * quando há o que reportar. A câmera é alta o bastante para que os anéis nunca
 * fiquem ocultos, o que mantém a triagem possível sem poluir a cena.
 * A seta é só reforço de apontamento no hover/seleção.
 */

interface AssetMarkerProps {
  asset: Asset;
  isSelected: boolean;
  /** Ativo sob o ponteiro, resolvido pela cena — `null` quando não há nenhum. */
  hoveredId: string | null;
  /** Ativo para onde a câmera foi apontada pela régua de triagem. */
  focusedId: string | null;
  /**
   * Handlers do editor de layout. Quando presente, SUBSTITUI o clique de
   * navegação da hitbox — clicar sem mover não pode abrir a página do ativo no
   * meio de uma edição.
   */
  drag?: {
    startDrag: (id: string) => void;
    moveTo: (id: string, svgX: number, svgY: number) => void;
    endDrag: (id: string) => void;
  } | null;
  onSelect: (id: string) => void;
  onHover: (asset: Asset | null) => void;
}

/** Alturas fixas: independem do porte da máquina para as etiquetas alinharem. */
const LABEL_Y = 2.9;
const ARROW_Y = 3.75;

/** Folga visual entre a borda do anel e a parede do hall. */
const WALL_GAP = 0.05;

/** Seta que aponta o equipamento, com flutuação sutil. */
function PointerArrow({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = ARROW_Y + Math.sin(performance.now() / 320) * 0.13;
  });

  return (
    <group ref={ref} position={[0, ARROW_Y, 0]}>
      {/* coneGeometry aponta para +Y; girar π em X faz apontar para baixo */}
      <mesh rotation={[Math.PI, Math.PI / 4, 0]}>
        <coneGeometry args={[0.32, 0.62, 4]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Halo — dá presença sem depender de post-processing */}
      <mesh rotation={[Math.PI, Math.PI / 4, 0]} scale={1.45}>
        <coneGeometry args={[0.32, 0.62, 4]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function AssetMarker({ asset, isSelected, hoveredId, focusedId, drag = null, onSelect, onHover }: AssetMarkerProps) {
  const [x, z] = plantToWorld(asset.plantX, asset.plantY);
  const cfg = statusConfig(asset.status);
  const urgency = statusUrgency(asset.status);
  const hovered = hoveredId === asset.id;

  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);

  /**
   * Recorta o anel/disco/seleção nas paredes do hall do ativo, em vez de
   * encolhê-los: encolher deixava o TAMANHO do indicador variar com a posição
   * (um ativo no meio do hall parecia "mais crítico" que um colado à parede só
   * por estar mais longe da borda), o que é pior que o problema original. A
   * malha do editor garante a CÉLULA inteira dentro do hall, mas não folga
   * nenhuma para o anel — bem maior que a célula (motor 2x2 = 0,83 de meia-
   * pegada contra 1,32 de raio do anel) — daí ele pintar além da laje quando o
   * ativo está na borda. Planos de recorte cortam só o pedaço que sairia,
   * mantendo o mesmo raio nominal para todos os ativos.
   */
  const clippingPlanes = useMemo(() => {
    const hall = hallForArea(asset.area);
    if (!hall) return undefined;
    const [hx, hz] = hall.center;
    const [hw, hd] = hall.size;
    const xMin = hx - hw / 2 + WALL_GAP;
    const xMax = hx + hw / 2 - WALL_GAP;
    const zMin = hz - hd / 2 + WALL_GAP;
    const zMax = hz + hd / 2 - WALL_GAP;
    return [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -xMin),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), xMax),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMin),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), zMax),
    ];
  }, [asset.area]);

  useFrame(() => {
    // Só o que precisa de atenção pulsa. Normal fica estático de propósito:
    // se tudo pulsasse, nada chamaria atenção.
    if (urgency === 0) return;
    const t = performance.now() / 1000;
    const wave = (Math.sin(t * (asset.status === 'critical' ? 3.2 : 2.0)) + 1) / 2;

    if (ringRef.current && ringMat.current) {
      ringRef.current.scale.setScalar(1 + wave * 0.35 * urgency);
      ringMat.current.opacity = 0.75 * (1 - wave * 0.55);
    }
  });

  const stopAnd = (fn: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    fn();
  };

  const highlighted = hovered || isSelected;

  // Uma seta por vez, e ela aponta para onde a CÂMERA está: o ponteiro manda
  // enquanto está sobre um ativo; sem ponteiro, vale o foco da régua de
  // triagem. Deliberadamente não segue `isSelected` — a seleção é global e
  // sobrevive à ida e volta da página do ativo, o que deixava uma seta acesa
  // na planta sem que ninguém tivesse pedido por ela.
  const showArrow = hoveredId ? hovered : focusedId === asset.id;

  // ─── Arrasto (modo de editar layout) ──────────────────────────────────────
  // `makeDefault` no OrbitControls da cena publica os controles aqui.
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const toFloor = useFloorPointer();
  /** Distância entre o centro da máquina e o ponto agarrado, em world. */
  const grab = useRef<{ dx: number; dz: number } | null>(null);

  // Rede de segurança: se o marcador desmontar com o ponteiro em cima (troca de
  // vista, salvamento, hot-reload), os controles ficariam desligados para
  // sempre e a câmera travaria sem explicação.
  useEffect(() => () => {
    if (controls) controls.enabled = true;
    document.body.style.cursor = 'auto';
  }, [controls]);

  const finishDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current || !drag) return;
    e.stopPropagation();
    grab.current = null;
    try {
      (e.target as Element)?.releasePointerCapture?.(e.pointerId);
    } catch {
      // O ponteiro pode já ter sido liberado pelo navegador; não é erro.
    }
    if (controls) controls.enabled = true;
    drag.endDrag(asset.id);
  };

  const dragHandlers = drag ? {
    // Os controles são desligados no HOVER, não no pointerdown. OrbitControls e
    // R3F escutam o MESMO canvas, e qual deles roda primeiro é detalhe interno
    // das duas bibliotecas. Desligando antes, o evento de orbitar nunca chega a
    // nascer — não há corrida para vencer.
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (controls) controls.enabled = false;
      onHover(asset);
      document.body.style.cursor = grab.current ? 'grabbing' : 'grab';
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      // Não religa no meio do arrasto: o cursor sai de cima da máquina o tempo
      // todo enquanto ela é arrastada.
      if (!grab.current && controls) controls.enabled = true;
      if (!grab.current) {
        onHover(null);
        document.body.style.cursor = 'auto';
      }
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      if (controls) controls.enabled = false;

      const p = toFloor(e);
      // Offset de agarre: sem ele a máquina salta para debaixo do cursor no
      // primeiro pixel de movimento, deslocando-a sem o usuário ter pedido.
      grab.current = p ? { dx: x - p[0], dz: z - p[1] } : { dx: 0, dz: 0 };
      document.body.style.cursor = 'grabbing';
      drag.startDrag(asset.id);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!grab.current) return;
      e.stopPropagation();
      const p = toFloor(e);
      if (!p) return;
      const [sx, sy] = worldToSvg(p[0] + grab.current.dx, p[1] + grab.current.dz);
      drag.moveTo(asset.id, sx, sy);
    },
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag,
  } : null;

  return (
    <group position={[x, 0, z]}>
      {/* Anel de status no piso — o indicador em repouso */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} renderOrder={1}>
        <ringGeometry args={[1.15, 1.32, 48]} />
        <meshBasicMaterial
          ref={ringMat}
          color={cfg.fill}
          transparent
          opacity={urgency > 0 ? 0.75 : 0.45}
          depthWrite={false}
          side={THREE.DoubleSide}
          clippingPlanes={clippingPlanes}
        />
      </mesh>

      {/* Disco de contato — ancora a máquina no piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[1.15, 40]} />
        <meshBasicMaterial
          color={cfg.fill}
          transparent
          opacity={0.09}
          depthWrite={false}
          clippingPlanes={clippingPlanes}
        />
      </mesh>

      {/* Anel de seleção / hover */}
      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={3}>
          <ringGeometry args={[1.42, isSelected ? 1.56 : 1.5, 48]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={isSelected ? 0.9 : 0.45}
            depthWrite={false}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      )}

      <MachineGeometry
        type={asset.type}
        urgency={urgency}
        running={asset.status !== 'offline'}
      />

      {showArrow && <PointerArrow color={cfg.fill} />}

      {/* Hitbox: alvo de clique generoso, independente da silhueta da máquina */}
      <mesh
        position={[0, 1.1, 0]}
        visible={false}
        {...(dragHandlers ?? {
          onClick: stopAnd(() => onSelect(asset.id)),
          onPointerOver: stopAnd(() => {
            onHover(asset);
            document.body.style.cursor = 'pointer';
          }),
          onPointerOut: stopAnd(() => {
            onHover(null);
            document.body.style.cursor = 'auto';
          }),
        })}
      >
        <cylinderGeometry args={[1.3, 1.3, 2.6, 12]} />
      </mesh>

      {/* Etiqueta de TAG — cores respeitam o tema (`dark:`): no claro, o piso é
          claro (LIGHT_FLOOR), então uma etiqueta quase preta ficaria quebrada.
          `distanceFactor` mais alto + padding menor reduzem a área de colisão
          entre etiquetas de ativos próximos (ex.: Hall A com 3 ativos juntos)
          sem mudar posições/dados — uma colisão residual em ângulos muito
          fechados ainda é possível e exigiria um sistema de anti-colisão de
          rótulos, fora do escopo desta rodada. */}
      <Html position={[0, LABEL_Y, 0]} center distanceFactor={27} zIndexRange={[20, 0]}>
        <div
          className={cn(
            'pointer-events-none select-none whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider backdrop-blur-sm transition-colors',
            asset.status === 'critical'
              ? 'border-red-400/70 bg-red-50/90 text-red-700 dark:border-red-500/60 dark:bg-red-950/80 dark:text-red-300'
              : asset.status === 'warning'
                ? 'border-amber-400/70 bg-amber-50/90 text-amber-700 dark:border-amber-500/60 dark:bg-amber-950/80 dark:text-amber-300'
                : 'border-slate-300/80 bg-white/90 text-slate-700 dark:border-slate-600/60 dark:bg-slate-950/75 dark:text-slate-300',
            highlighted && 'border-slate-900/60 text-slate-900 dark:border-white/70 dark:text-white',
          )}
        >
          {asset.tag}
        </div>
      </Html>
    </group>
  );
}
