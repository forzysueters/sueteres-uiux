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
  /**
   * Limites de temperatura do ativo (sensorLimits.ts). O glow começa no `warn`
   * e satura no `crit`, para acender exatamente quando o gauge acusa atenção.
   */
  tempLimits?: { warn: number; crit: number };
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

// ─── Foco térmico (calibrável) ───────────────────────────────────────────────
// Em que extremo do eixo-árvore fica o mancal do lado acionado. Se o calor
// aparecer na ponta errada do motor, inverta para -1.
const HOTSPOT_END: 1 | -1 = 1;
// Raio do foco, como fração da diagonal do modelo. Maior = calor mais espalhado.
const HEAT_RADIUS_FRACTION = 0.55;
// Quanto do calor é condução geral pela carcaça (o resto é o foco no mancal).
// Um motor com mancal quente aquece por inteiro, só que bem menos que o ponto.
const HEAT_AMBIENT_SHARE = 0.18;
// Concentração do foco: >1 aperta o núcleo quente, deixando a queda mais nítida.
const HEAT_FALLOFF_POWER = 1.6;

/**
 * heat: 0 (frio) → 1 (no limite crítico).
 *
 * Ancorado nos MESMOS limites que definem o status do sensor (sensorLimits.ts):
 * o modelo só começa a esquentar quando a temperatura entra em atenção, e satura
 * no crítico. Antes a rampa era 70→85 °C fixa, então o motor já brilhava com o
 * gauge marcando "Normal".
 */
const heatFactor = (tempC: number, limits: { warn: number; crit: number }) =>
  THREE.MathUtils.clamp((tempC - limits.warn) / (limits.crit - limits.warn), 0, 1);

const DEFAULT_TEMP_LIMITS = { warn: 75, crit: 90 };

/** Uniforms do gradiente térmico, um conjunto por material clonado. */
interface HeatUniforms {
  uHotspot: { value: THREE.Vector3 };
  uHeat: { value: number };
  uRadius: { value: number };
  uHotColor: { value: THREE.Color };
}

/**
 * Injeta o gradiente térmico num MeshStandardMaterial.
 *
 * O GLB veio numa malha única (1 nó, 1 mesh, 1 material — sem peça "Mancal"
 * nomeada), então não dá para pintar uma peça separada. Em vez disso o emissive
 * é calculado POR FRAGMENTO, pela distância até o ponto do mancal em espaço de
 * objeto: o calor nasce ali e decai pela carcaça, como condução de verdade.
 */
function injectHeatGradient(mat: THREE.MeshStandardMaterial, u: HeatUniforms) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeatPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeatPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHeatPos;
        uniform vec3 uHotspot;
        uniform float uHeat;
        uniform float uRadius;
        uniform vec3 uHotColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float heatDist = distance(vHeatPos, uHotspot);
        float heatFocus = pow(1.0 - smoothstep(0.0, uRadius, heatDist), ${HEAT_FALLOFF_POWER.toFixed(1)});
        totalEmissiveRadiance += uHotColor * uHeat *
          (${HEAT_AMBIENT_SHARE.toFixed(2)} + ${(1 - HEAT_AMBIENT_SHARE).toFixed(2)} * heatFocus);`,
      );
  };
}

/** Ponto do mancal: extremo do eixo mais longo (o eixo-árvore), no centro dos outros dois. */
function bearingHotspot(bbox: THREE.Box3): THREE.Vector3 {
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  const hotspot = center.clone();
  hotspot[axis] = HOTSPOT_END > 0 ? bbox.max[axis] : bbox.min[axis];
  return hotspot;
}

/**
 * Motor W22 real (Onshape → GLB + Draco). A temperatura vira um GRADIENTE
 * térmico com foco no mancal do lado acionado (ver injectHeatGradient), em vez
 * do glow vermelho uniforme que o modelo tinha antes.
 */
export function MotorModel({
  telemetryRef,
  glow = 0,
  glowColor,
  scale = 6,
  idle = true,
  tempLimits,
}: MotorMeshProps) {
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const heatSmooth = useRef(0);

  // Clona a cena e os materiais (não mutar o cache do useGLTF) e injeta o
  // gradiente térmico, guardando os uniforms para dirigir a intensidade.
  const { model, uniforms } = useMemo(() => {
    const clone = scene.clone(true);
    const uni: HeatUniforms[] = [];

    // Bounding box da GEOMETRIA — mesmo espaço do atributo `position` que o
    // shader lê. Box3.setFromObject daria world-space, deslocado pelo nó.
    const bbox = new THREE.Box3();
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) bbox.union(mesh.geometry.boundingBox);
    });
    const hotspot = bearingHotspot(bbox);
    const radius = bbox.getSize(new THREE.Vector3()).length() * HEAT_RADIUS_FRACTION;

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
        // O emissive do material fica zerado: quem acende é o shader injetado,
        // somando em totalEmissiveRadiance por fragmento.
        c.emissive = new THREE.Color('#000000');
        c.emissiveIntensity = 1;
        const u: HeatUniforms = {
          uHotspot: { value: hotspot },
          uHeat: { value: 0 },
          uRadius: { value: radius },
          uHotColor: { value: HOT.clone() },
        };
        injectHeatGradient(c, u);
        uni.push(u);
        return c;
      });
      if (!Array.isArray(src)) mesh.material = (mesh.material as THREE.Material[])[0];
    });
    return { model: clone, uniforms: uni };
  }, [scene]);

  // Sem telemetria (planta): intensidade fixa, aplicada uma vez.
  useEffect(() => {
    if (telemetryRef) return;
    const color = new THREE.Color(glowColor ?? '#ef4444');
    for (const u of uniforms) {
      u.uHotColor.value.copy(color);
      u.uHeat.value = glow;
    }
  }, [telemetryRef, uniforms, glow, glowColor]);

  useFrame((_, delta) => {
    if (telemetryRef) {
      const dt = Math.min(delta, 0.1); // estabilidade após pausas de loop
      const target = heatFactor(telemetryRef.current.temperatura, tempLimits ?? DEFAULT_TEMP_LIMITS);
      heatSmooth.current = THREE.MathUtils.damp(heatSmooth.current, target, 3, dt);
      for (const u of uniforms) u.uHeat.value = heatSmooth.current;
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
export function MotorPrimitive({ telemetryRef, glow = 0, idle = true, tempLimits }: MotorMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shaftRef = useRef<THREE.Mesh>(null);
  const bearingMat = useRef<THREE.MeshStandardMaterial>(null);
  const heatSmooth = useRef(0);
  const steel = useMemo(() => new THREE.Color('#9aa4b2'), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const target = telemetryRef
      ? heatFactor(telemetryRef.current.temperatura, tempLimits ?? DEFAULT_TEMP_LIMITS)
      : glow;
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
