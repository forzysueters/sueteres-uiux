import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from '../../types';
import { statusConfig, statusUrgency } from '../../utils/plantStatus';
import { plantToWorld } from './plantLayout';
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
  onSelect: (id: string) => void;
  onHover: (asset: Asset | null) => void;
}

/** Alturas fixas: independem do porte da máquina para as etiquetas alinharem. */
const LABEL_Y = 2.9;
const ARROW_Y = 3.75;

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

export function AssetMarker({ asset, isSelected, onSelect, onHover }: AssetMarkerProps) {
  const [x, z] = plantToWorld(asset.plantX, asset.plantY);
  const cfg = statusConfig(asset.status);
  const urgency = statusUrgency(asset.status);
  const [hovered, setHovered] = useState(false);

  const ringRef = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);

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
        />
      </mesh>

      {/* Disco de contato — ancora a máquina no piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[1.15, 40]} />
        <meshBasicMaterial color={cfg.fill} transparent opacity={0.09} depthWrite={false} />
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
          />
        </mesh>
      )}

      <MachineGeometry
        type={asset.type}
        accent={cfg.fill}
        urgency={urgency}
        running={asset.status !== 'offline'}
      />

      {highlighted && <PointerArrow color={cfg.fill} />}

      {/* Hitbox: alvo de clique generoso, independente da silhueta da máquina */}
      <mesh
        position={[0, 1.1, 0]}
        visible={false}
        onClick={stopAnd(() => onSelect(asset.id))}
        onPointerOver={stopAnd(() => {
          setHovered(true);
          onHover(asset);
          document.body.style.cursor = 'pointer';
        })}
        onPointerOut={stopAnd(() => {
          setHovered(false);
          onHover(null);
          document.body.style.cursor = 'auto';
        })}
      >
        <cylinderGeometry args={[1.3, 1.3, 2.6, 12]} />
      </mesh>

      {/* Etiqueta de TAG */}
      <Html position={[0, LABEL_Y, 0]} center distanceFactor={22} zIndexRange={[20, 0]}>
        <div
          className={cn(
            'pointer-events-none select-none whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[11px] font-bold tracking-wider backdrop-blur-sm transition-colors',
            asset.status === 'critical'
              ? 'border-red-500/60 bg-red-950/80 text-red-300'
              : asset.status === 'warning'
                ? 'border-amber-500/60 bg-amber-950/80 text-amber-300'
                : 'border-slate-600/60 bg-slate-950/75 text-slate-300',
            highlighted && 'border-white/70 text-white',
          )}
        >
          {asset.tag}
        </div>
      </Html>
    </group>
  );
}
