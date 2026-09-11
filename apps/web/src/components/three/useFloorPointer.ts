import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

/** Piso da planta: plano horizontal em Y=0, normal apontando para cima. */
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * Onde o cursor cruza o piso, em world (X, Z).
 *
 * Duas armadilhas que este hook existe para evitar:
 *
 * 1. **Não usar `e.point`.** Ele é a interseção com a HITBOX do ativo, que está
 *    a ~1,1 de altura. Com a câmera inclinada (e ela sempre está — o polar fica
 *    travado entre PI/6 e PI/2.6), arrastar por esse ponto levaria a máquina
 *    para um lugar visivelmente diferente do que está sob o cursor no chão.
 *
 * 2. **Raycaster próprio, não o do estado do R3F.** Aquele é compartilhado com
 *    o sistema de eventos; sobrescrevê-lo no meio de um handler corromperia os
 *    handlers seguintes do mesmo evento.
 *
 * O plano é infinito, mas a câmera nunca fica rasante, então a interseção
 * sempre existe na prática — o `null` cobre só o caso degenerado.
 */
export function useFloorPointer() {
  const camera = useThree((s) => s.camera);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  return (e: ThreeEvent<PointerEvent>): [number, number] | null => {
    raycaster.setFromCamera(e.pointer, camera);
    return raycaster.ray.intersectPlane(FLOOR_PLANE, hit) ? [hit.x, hit.z] : null;
  };
}
