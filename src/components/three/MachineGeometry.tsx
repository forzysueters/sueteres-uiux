import { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MotorModel, MotorPrimitive } from './MotorModel';
import { ModelErrorBoundary } from './ModelErrorBoundary';

/**
 * Volumes dos equipamentos da planta.
 *
 * Os motores usam o motor.glb real (já em cache pelo useGLTF da página do
 * ativo). Bomba, compressor e exaustor são proceduriais: o objetivo é leitura
 * de silhueta a 15 unidades de distância, não fidelidade de catálogo.
 */

interface MachineProps {
  /** Cor do status — vira a faixa de acento da máquina. */
  accent: string;
  /** 0-1: quanto o equipamento está "gritando". Dirige o emissive da faixa. */
  urgency: number;
  /** Máquinas param de girar quando offline. */
  running: boolean;
}

// Claros o bastante para a silhueta ler contra o piso escuro a ~26 unidades
// de distância — em tons mais escuros as máquinas viram manchas.
const BODY = '#4d5768';
const BODY_DARK = '#333c4b';
const METAL = '#8d97ab';
const SKID = '#232a36';

function useMachineMaterials(accent: string, urgency: number) {
  return useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: BODY, metalness: 0.35, roughness: 0.65 }),
      dark: new THREE.MeshStandardMaterial({ color: BODY_DARK, metalness: 0.3, roughness: 0.75 }),
      metal: new THREE.MeshStandardMaterial({ color: METAL, metalness: 0.7, roughness: 0.35 }),
      skid: new THREE.MeshStandardMaterial({ color: SKID, metalness: 0.2, roughness: 0.9 }),
      accent: new THREE.MeshStandardMaterial({
        color: accent,
        emissive: new THREE.Color(accent),
        // A faixa acende só quando há o que reportar — normal fica discreto.
        emissiveIntensity: 0.25 + urgency * 0.9,
        metalness: 0.1,
        roughness: 0.5,
      }),
    }),
    [accent, urgency],
  );
}

/** Base comum: skid retangular sob a máquina. */
function Skid({ material, w, d }: { material: THREE.Material; w: number; d: number }) {
  return (
    <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, 0.12, d]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ─── Bomba centrífuga ────────────────────────────────────────────────────────
function Pump({ accent, urgency, running }: MachineProps) {
  const m = useMachineMaterials(accent, urgency);
  const shaft = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (running && shaft.current) shaft.current.rotation.z += Math.min(delta, 0.1) * 4;
  });

  return (
    <group>
      <Skid material={m.skid} w={2.4} d={1.1} />

      {/* Voluta (carcaça em espiral, aproximada por cilindro chanfrado) */}
      <mesh position={[-0.6, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.42, 24]} />
        <primitive object={m.body} attach="material" />
      </mesh>

      {/* Flange de sucção */}
      <mesh position={[-1.05, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.18, 16]} />
        <primitive object={m.metal} attach="material" />
      </mesh>

      {/* Recalque vertical */}
      <mesh position={[-0.6, 1.18, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.55, 16]} />
        <primitive object={m.metal} attach="material" />
      </mesh>

      {/* Acoplamento + eixo */}
      <mesh ref={shaft} position={[-0.05, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.5, 12]} />
        <primitive object={m.metal} attach="material" />
      </mesh>

      {/* Motor de acionamento */}
      <mesh position={[0.62, 0.58, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 1.0, 20]} />
        <primitive object={m.dark} attach="material" />
      </mesh>

      {/* Faixa de status */}
      <mesh position={[0.62, 0.58, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.375, 0.375, 0.14, 20]} />
        <primitive object={m.accent} attach="material" />
      </mesh>

      {/* Pés */}
      {[-0.6, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.36, 0.5]} />
          <primitive object={m.dark} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ─── Compressor de ar (tanque horizontal sobre skid) ─────────────────────────
function Compressor({ accent, urgency, running }: MachineProps) {
  const m = useMachineMaterials(accent, urgency);
  const flywheel = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (running && flywheel.current) flywheel.current.rotation.x += Math.min(delta, 0.1) * 3;
  });

  return (
    <group>
      <Skid material={m.skid} w={3.0} d={1.4} />

      {/* Reservatório */}
      <mesh position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.56, 0.56, 2.5, 28]} />
        <primitive object={m.body} attach="material" />
      </mesh>
      {/* Tampos abaulados */}
      {[-1.25, 1.25].map((x) => (
        <mesh key={x} position={[x, 0.72, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <sphereGeometry args={[0.56, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <primitive object={m.body} attach="material" />
        </mesh>
      ))}

      {/* Cinta de status no costado */}
      <mesh position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.575, 0.575, 0.18, 28]} />
        <primitive object={m.accent} attach="material" />
      </mesh>

      {/* Bloco compressor + volante */}
      <mesh position={[0.1, 1.42, 0]} castShadow>
        <boxGeometry args={[1.0, 0.55, 0.7]} />
        <primitive object={m.dark} attach="material" />
      </mesh>
      <mesh ref={flywheel} position={[-0.5, 1.42, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.34, 0.34, 0.1, 20]} />
        <primitive object={m.metal} attach="material" />
      </mesh>

      {/* Cilindros */}
      {[-0.1, 0.35].map((x) => (
        <mesh key={x} position={[x, 1.82, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.17, 0.42, 14]} />
          <primitive object={m.metal} attach="material" />
        </mesh>
      ))}

      {/* Tubulação de saída */}
      <mesh position={[1.15, 1.25, 0]} rotation={[0, 0, Math.PI / 8]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.1, 12]} />
        <primitive object={m.metal} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Exaustor axial ──────────────────────────────────────────────────────────
function Fan({ accent, urgency, running }: MachineProps) {
  const m = useMachineMaterials(accent, urgency);
  const blades = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (running && blades.current) blades.current.rotation.z += Math.min(delta, 0.1) * 6;
  });

  return (
    <group>
      <Skid material={m.skid} w={1.6} d={1.6} />

      {/* Colunas de suporte */}
      {[
        [-0.55, -0.55],
        [0.55, -0.55],
        [-0.55, 0.55],
        [0.55, 0.55],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.55, z]} castShadow>
          <boxGeometry args={[0.11, 0.95, 0.11]} />
          <primitive object={m.skid} attach="material" />
        </mesh>
      ))}

      {/* Carcaça tubular */}
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.78, 0.78, 0.72, 28, 1, true]} />
        <meshStandardMaterial color={BODY} metalness={0.4} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Aro de status */}
      <mesh position={[0, 1.35, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.78, 0.055, 10, 32]} />
        <primitive object={m.accent} attach="material" />
      </mesh>

      {/* Hélice */}
      <group ref={blades} position={[0, 1.35, 0]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.16, 0.28, 14]} />
          <primitive object={m.metal} attach="material" />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh
            key={i}
            rotation={[0, 0.35, (i * Math.PI * 2) / 6]}
            position={[
              Math.cos((i * Math.PI * 2) / 6) * 0.38,
              Math.sin((i * Math.PI * 2) / 6) * 0.38,
              0,
            ]}
            castShadow
          >
            <boxGeometry args={[0.62, 0.2, 0.05]} />
            <primitive object={m.metal} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── Motor: o GLB real ───────────────────────────────────────────────────────
/** Escala do motor.glb dentro da planta (o hero da página do ativo usa 6). */
const PLANT_MOTOR_SCALE = 3.4;

function Motor({ urgency }: MachineProps) {
  return (
    <group position={[0, 0.95, 0]}>
      <Suspense fallback={null}>
        <ModelErrorBoundary
          fallback={
            <group scale={0.42}>
              <MotorPrimitive glow={urgency} idle={false} />
            </group>
          }
        >
          {/* Sem emissivo: qualquer tinta de status lava o azul WEG do GLB e
              faz dois motores idênticos parecerem equipamentos diferentes.
              Quem comunica status aqui é o anel no piso. */}
          <MotorModel scale={PLANT_MOTOR_SCALE} idle={false} />
        </ModelErrorBoundary>
      </Suspense>
    </group>
  );
}

const MACHINES: Record<string, React.FC<MachineProps>> = {
  motor: Motor,
  pump: Pump,
  compressor: Compressor,
  fan: Fan,
};

export function MachineGeometry({ type, ...props }: MachineProps & { type: string }) {
  const Machine = MACHINES[type] ?? Pump;
  return <Machine {...props} />;
}
