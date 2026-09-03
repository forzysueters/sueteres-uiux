import { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Hall, WALL_HEIGHT, FloorPalette, ViewBounds } from './plantLayout';

/**
 * Piso, grade e halls da planta.
 *
 * Este módulo exporta SOMENTE componentes — as paletas vivem em plantLayout.ts.
 * Misturar constantes com componentes quebra o Fast Refresh e faz o <Canvas>
 * remontar a cada edição, derrubando o contexto WebGL.
 */

function HallVolume({
  hall,
  palette,
  onIsolate,
}: {
  hall: Hall;
  palette: FloorPalette;
  /** Ausente quando o hall já está isolado — não há para onde entrar. */
  onIsolate?: (area: string) => void;
}) {
  const [cx, cz] = hall.center;
  const [w, d] = hall.size;
  const t = 0.09; // espessura da parede

  return (
    <group position={[cx, 0, cz]}>
      {/* Laje do hall — levemente elevada para separar do piso geral.
          Também é o alvo de clique que isola este hall. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.008, 0]}
        receiveShadow
        onClick={
          onIsolate
            ? (e) => {
                e.stopPropagation();
                onIsolate(hall.area);
              }
            : undefined
        }
        onPointerOver={
          onIsolate
            ? (e) => {
                e.stopPropagation();
                document.body.style.cursor = 'zoom-in';
              }
            : undefined
        }
        onPointerOut={
          onIsolate
            ? (e) => {
                e.stopPropagation();
                document.body.style.cursor = 'auto';
              }
            : undefined
        }
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={palette.hallPad}
          roughness={0.95}
          metalness={0}
          transparent
          opacity={hall.open ? 0.45 : 0.9}
        />
      </mesh>

      {/* Paredes-guia baixas. Altura pequena de propósito: precisam delimitar
          a área sem esconder equipamento nenhum da câmera. */}
      {!hall.open && (
        <>
          {[
            { pos: [0, WALL_HEIGHT / 2, -d / 2] as const, size: [w, WALL_HEIGHT, t] as const },
            { pos: [0, WALL_HEIGHT / 2, d / 2] as const, size: [w, WALL_HEIGHT, t] as const },
            { pos: [-w / 2, WALL_HEIGHT / 2, 0] as const, size: [t, WALL_HEIGHT, d] as const },
            { pos: [w / 2, WALL_HEIGHT / 2, 0] as const, size: [t, WALL_HEIGHT, d] as const },
          ].map((wall, i) => (
            <mesh key={i} position={wall.pos as unknown as [number, number, number]} castShadow>
              <boxGeometry args={wall.size as unknown as [number, number, number]} />
              <meshStandardMaterial
                color={palette.wall}
                roughness={0.8}
                metalness={0.1}
                transparent
                opacity={0.75}
              />
            </mesh>
          ))}
        </>
      )}

      {/* Área técnica: perímetro tracejado em vez de parede */}
      {hall.open && (
        <lineSegments position={[0, 0.05, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(w, 0.001, d)]} />
          <lineBasicMaterial color={palette.wall} transparent opacity={0.6} />
        </lineSegments>
      )}

      {/* Rótulo do hall, ancorado no canto superior-esquerdo da laje */}
      {/* Rótulo do hall é contexto, não informação primária: distanceFactor
          menor que o das TAGs para ficar visivelmente subordinado. */}
      <Html
        position={[-w / 2 + 0.15, 0.02, -d / 2 + 0.15]}
        distanceFactor={23}
        zIndexRange={[5, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="whitespace-nowrap select-none font-mono text-[10px] font-bold tracking-[0.2em]"
          style={{ color: hall.open ? palette.labelOpen : palette.label }}
        >
          {hall.label}
        </div>
      </Html>
    </group>
  );
}

/** Folga do piso/grade em volta do escopo desenhado. */
const FLOOR_MARGIN_X = 1.14;
const FLOOR_MARGIN_Z = 1.16;
/** Alvo de tamanho de célula da grade, em unidades de mundo. */
const GRID_CELL = 2;

export function PlantFloor({
  palette,
  halls,
  bounds,
  isolated,
  onIsolateHall,
  onExitIsolation,
}: {
  palette: FloorPalette;
  halls: Hall[];
  bounds: ViewBounds;
  isolated: boolean;
  /** Ausentes no modo de editar layout: a laje deixa de ser clicável. */
  onIsolateHall?: (area: string) => void;
  onExitIsolation?: () => void;
}) {
  const [cx, cz] = bounds.center;
  const floorW = bounds.size[0] * FLOOR_MARGIN_X;
  const floorD = bounds.size[1] * FLOOR_MARGIN_Z;

  // O GridHelper é sempre quadrado, mas os escopos são retangulares. Geramos
  // no eixo maior e achatamos em Z — sem isso sobra um avental morto de piso
  // na frente que domina o quadro.
  const grid = useMemo(() => {
    const divisions = Math.max(4, Math.round(floorW / GRID_CELL));
    const g = new THREE.GridHelper(floorW, divisions, palette.gridCenter, palette.grid);
    const mat = g.material as THREE.Material;
    mat.transparent = true;
    mat.opacity = 0.55;
    return g;
  }, [floorW, palette.grid, palette.gridCenter]);

  // GridHelper aloca GPU própria; sem descartar, cada troca de escopo vaza.
  useEffect(() => () => {
    grid.geometry.dispose();
    (grid.material as THREE.Material).dispose();
  }, [grid]);

  return (
    <group>
      {/* Piso base. Com um hall isolado, é o alvo de "clicar fora para sair" —
          a contrapartida de clicar na laje para entrar. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, 0, cz]}
        receiveShadow
        onClick={
          isolated && onExitIsolation
            ? (e) => {
                e.stopPropagation();
                onExitIsolation();
              }
            : undefined
        }
        onPointerOver={
          isolated
            ? (e) => {
                e.stopPropagation();
                document.body.style.cursor = 'zoom-out';
              }
            : undefined
        }
        onPointerOut={
          isolated
            ? (e) => {
                e.stopPropagation();
                document.body.style.cursor = 'auto';
              }
            : undefined
        }
      >
        <planeGeometry args={[floorW, floorD]} />
        <meshStandardMaterial color={palette.floor} roughness={1} metalness={0} />
      </mesh>

      <primitive
        object={grid}
        position={[cx, 0.004, cz]}
        scale={[1, 1, floorD / floorW]}
      />

      {halls.map((hall) => (
        <HallVolume
          key={hall.id}
          hall={hall}
          palette={palette}
          onIsolate={isolated ? undefined : onIsolateHall}
        />
      ))}
    </group>
  );
}
