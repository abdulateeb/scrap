"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh, Group } from "three";
import { Object3D } from "three";

export const BELT_LENGTH = 22;
export const BELT_WIDTH = 4.2;
export const BELT_SPEED = 2.4;

const SLAT_COUNT = 60;
const SLAT_GAP = BELT_LENGTH / SLAT_COUNT;

/**
 * The belt itself: a dark rubber deck with cleats running across it.
 *
 * The cleats are one instanced mesh advanced by modulo, which is what sells the
 * motion. Scrolling a texture would be cheaper still, but real slats catch the
 * light at the scan gate and that is the moment the whole scene is built around.
 */
export function BeltSurface({ running }: { running: boolean }) {
  const slats = React.useRef<InstancedMesh>(null);
  const rails = React.useRef<Group>(null);
  const dummy = React.useMemo(() => new Object3D(), []);
  const offset = React.useRef(0);

  // Lay the slats out once, then only the offset changes per frame.
  React.useEffect(() => {
    const mesh = slats.current;
    if (!mesh) return;
    for (let i = 0; i < SLAT_COUNT; i += 1) {
      dummy.position.set(0, 0.035, -BELT_LENGTH / 2 + i * SLAT_GAP);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, delta) => {
    const mesh = slats.current;
    if (!mesh || !running) return;

    offset.current = (offset.current + delta * BELT_SPEED) % SLAT_GAP;

    for (let i = 0; i < SLAT_COUNT; i += 1) {
      const z =
        ((-BELT_LENGTH / 2 + i * SLAT_GAP + offset.current + BELT_LENGTH / 2) %
          BELT_LENGTH) -
        BELT_LENGTH / 2;
      dummy.position.set(0, 0.035, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={rails}>
      {/* Deck */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[BELT_WIDTH, BELT_LENGTH]} />
        <meshStandardMaterial color="#2a2f2b" roughness={0.92} metalness={0.06} />
      </mesh>

      {/* Cleats */}
      <instancedMesh
        ref={slats}
        args={[undefined, undefined, SLAT_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[BELT_WIDTH, 0.055, 0.1]} />
        <meshStandardMaterial color="#3b423d" roughness={0.68} metalness={0.3} />
      </instancedMesh>

      {/* Side rails, brushed steel so the green gate light has something to
          catch on the way past. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * BELT_WIDTH) / 2 + side * 0.16, 0.14, 0]}
        >
          <boxGeometry args={[0.3, 0.34, BELT_LENGTH]} />
          <meshStandardMaterial
            color="#8f978d"
            roughness={0.3}
            metalness={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}
