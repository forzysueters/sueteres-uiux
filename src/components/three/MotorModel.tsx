import { useRef, useMemo, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

export interface TelemetryData {
  temperatura: number;
  vibracao: number;
}

interface MotorMeshProps {
  /**
   * Telemetria ao vivo. Opcional: na planta não há tick por ativo (o
   * startRealtimeUpdates só roda na página do ativo), então ali passamos
   * `glow` estático em vez de animar o emissive quadro a quadro.
   */
  telemetryRef?: MutableRefObject<TelemetryData>;
  /** Emissive fixo 0-1 quando não há telemetria. */
  glow?: number;
  /** Cor do emissive fixo. Default: vermelho de calor. */
  glowColor?: string;
  /** Enquadramento. 6 = hero da página do ativo; menor = miniatura/planta. */
  scale?: number;
  /** Balanço sutil do conjunto. Desligar quando o pai já anima. */
  idle?: boolean;
}

const MODEL_URL = '/models/motor.glb';
const DRACO_PATH = '/draco/';
const HOT = new THREE.Color('#ef4444');

// ─── Ajuste de aparência do material (calibrável) ────────────────────────────
// O Onshape exportou o azul WEG saturado e com roughness ~0 (espelhado), o que
// "estoura" sob a luz. Escurecemos o tom base e removemos o brilho espelhado.
const COLOR_DARKEN = 0.5;      // 1 = original; menor = mais escuro
const ROUGHNESS_MIN = 0.6;     // maior = menos brilho/reflexo
const METALNESS_MAX = 0.35;    // menor = menos "espelho"

// heat: 0 (frio) → 1 (quente). Aquece a partir de ~70°C, satura ~85°C;
// o limite de 80°C do requisito cai no meio da transição.
const heatFactor = (tempC: number) =>
  THREE.MathUtils.clamp((tempC - 70) / (85 - 70), 0, 1);

/**
 * Motor W22 real (Onshape → GLB + Draco). Como o modelo veio numa malha única
 * (sem peça "Mancal" nomeada), a temperatura reage como GLOW VERMELHO global:
 * a emissão de todos os materiais sobe conforme a temperatura passa de 80°C.
 */
export function MotorModel({
  telemetryRef,
  glow = 0,
  glowColor,
  scale = 6,
  idle = true,
}: MotorMeshProps) {
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const heatSmooth = useRef(0);

  // Clona a cena e os materiais (não mutar o cache do useGLTF) e coleta os
  // materiais para o binding de glow.
  const { model, materials } = useMemo(() => {
    const clone = scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material;
      const arr = Array.isArray(src) ? src : [src];
      mesh.material = arr.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        // Tira o "estourado": escurece o tom base e mata o brilho espelhado.
        c.color.multiplyScalar(COLOR_DARKEN);
        c.roughness = Math.max(c.roughness ?? 1, ROUGHNESS_MIN);
        c.metalness = Math.min(c.metalness ?? 0, METALNESS_MAX);
        c.emissive = new THREE.Color('#000000');
        c.emissiveIntensity = 0;
        mats.push(c);
        return c;
      });
      if (!Array.isArray(src)) mesh.material = (mesh.material as THREE.Material[])[0];
    });
    return { model: clone, materials: mats };
  }, [scene]);

  // Sem telemetria: aplica o emissive UMA vez em vez de reescrever todo quadro.
  useEffect(() => {
    if (telemetryRef) return;
    const color = new THREE.Color(glowColor ?? '#ef4444');
    for (const m of materials) {
      m.emissive.copy(color);
      m.emissiveIntensity = glow;
    }
  }, [telemetryRef, materials, glow, glowColor]);

  useFrame((_, delta) => {
    if (telemetryRef) {
      const dt = Math.min(delta, 0.1); // estabilidade após pausas de loop
      const target = heatFactor(telemetryRef.current.temperatura);
      heatSmooth.current = THREE.MathUtils.damp(heatSmooth.current, target, 3, dt);
      const h = heatSmooth.current;

      for (const m of materials) {
        m.emissive.copy(HOT);
        m.emissiveIntensity = h * 0.9;
      }
    }

    // Respiração sutil do conjunto para dar vida.
    if (idle && groupRef.current) {
      groupRef.current.rotation.y = Math.sin(performance.now() / 5000) * 0.12;
    }
  });

  // Modelo vem em metros (~0,5m) e fora da origem: Center recentra, scale enquadra.
  return (
    <group ref={groupRef}>
      <Center scale={scale}>
        <primitive object={model} />
      </Center>
    </group>
  );
}

useGLTF.preload(MODEL_URL, DRACO_PATH);

// ─── Fallback: motor de primitivos (usado se o .glb falhar ao carregar) ──────
export function MotorPrimitive({ telemetryRef, glow = 0, idle = true }: MotorMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shaftRef = useRef<THREE.Mesh>(null);
  const bearingMat = useRef<THREE.MeshStandardMaterial>(null);
  const heatSmooth = useRef(0);
  const steel = useMemo(() => new THREE.Color('#9aa4b2'), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const target = telemetryRef ? heatFactor(telemetryRef.current.temperatura) : glow;
    heatSmooth.current = THREE.MathUtils.damp(heatSmooth.current, target, 3, dt);
    const h = heatSmooth.current;
    if (bearingMat.current) {
      bearingMat.current.color.copy(steel).lerp(HOT, h);
      bearingMat.current.emissive.copy(HOT);
      bearingMat.current.emissiveIntensity = h * 0.9;
    }
    if (shaftRef.current) shaftRef.current.rotation.x += dt * 1.2;
    if (idle && groupRef.current) {
      groupRef.current.rotation.y = Math.sin(performance.now() / 4000) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[3.2, 0.35, 1.8]} />
        <meshStandardMaterial color="#2a2f3a" metalness={0.4} roughness={0.7} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, -0.55, 0]}>
          <boxGeometry args={[0.5, 0.6, 1.4]} />
          <meshStandardMaterial color="#20242e" metalness={0.3} roughness={0.8} />
        </mesh>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.95, 0.95, 2.4, 32]} />
        <meshStandardMaterial color="#6b7686" metalness={0.75} roughness={0.35} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[-1 + i * 0.34, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.02, 1.02, 0.06, 32]} />
          <meshStandardMaterial color="#565f6d" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.8]} />
        <meshStandardMaterial color="#3a4150" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[-1.28, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.8, 0.95, 0.25, 32]} />
        <meshStandardMaterial color="#5a6472" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[1.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.85, 0.85, 0.3, 32]} />
        <meshStandardMaterial color="#5a6472" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh name="Mancal" position={[1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.4, 32]} />
        <meshStandardMaterial ref={bearingMat} color="#9aa4b2" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={shaftRef} position={[2.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 1.2, 24]} />
        <meshStandardMaterial color="#c3cad4" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}
