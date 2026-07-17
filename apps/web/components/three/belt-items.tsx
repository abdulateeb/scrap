"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh } from "three";
import { Color, Object3D } from "three";

import { MATERIAL_KEYS } from "@/lib/materials";
import { BELT_LENGTH, BELT_SPEED, BELT_WIDTH } from "@/components/three/belt-surface";

/**
 * The waste riding the belt.
 *
 * Three primitives stand in for the three ways waste actually presents itself
 * on a line: boxes for board and cartons, cylinders for bottles and cans, and a
 * low polygon lump for everything crushed or unidentifiable. Each instance
 * carries the colour of the material category it represents, so the belt is
 * already speaking the vocabulary the rest of the interface uses.
 */

const PER_SHAPE = 34;

// Read the material colours once, from the same tokens the interface uses.
const PALETTE = [
  "#4f9ee4", // plastic
  "#d8c37a", // paper
  "#c08a4a", // cardboard
  "#9aa7b5", // metal
  "#5ad0c0", // glass
  "#7bbf58", // organic
  "#c471c4", // textiles
  "#ff8a5c", // ewaste
  "#7a827a", // other
];

interface Seed {
  x: number;
  z: number;
  scale: number;
  spin: number;
  tilt: number;
  colour: number;
}

function makeSeeds(count: number, salt: number): Seed[] {
  // A fixed pseudo random sequence keeps the layout identical between renders,
  // so the scene never pops on a hot reload.
  let value = salt * 9301 + 49297;
  const next = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };

  return Array.from({ length: count }, () => ({
    x: (next() - 0.5) * (BELT_WIDTH - 0.7),
    z: next() * BELT_LENGTH - BELT_LENGTH / 2,
    scale: 0.2 + next() * 0.26,
    spin: (next() - 0.5) * 0.9,
    tilt: next() * Math.PI,
    colour: Math.floor(next() * MATERIAL_KEYS.length),
  }));
}

function Shape({
  seeds,
  running,
  children,
}: {
  seeds: Seed[];
  running: boolean;
  children: React.ReactNode;
}) {
  const mesh = React.useRef<InstancedMesh>(null);
  const dummy = React.useMemo(() => new Object3D(), []);
  const colour = React.useMemo(() => new Color(), []);
  const travelled = React.useRef(0);

  const write = React.useCallback(() => {
    const instanced = mesh.current;
    if (!instanced) return;

    seeds.forEach((seed, index) => {
      const z =
        ((seed.z + travelled.current + BELT_LENGTH * 1.5) % BELT_LENGTH) -
        BELT_LENGTH / 2;
      dummy.position.set(seed.x, 0.11 + seed.scale * 0.42, z);
      dummy.rotation.set(seed.tilt, seed.tilt + travelled.current * seed.spin, 0);
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  }, [dummy, seeds]);

  React.useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    seeds.forEach((seed, index) => {
      colour.set(PALETTE[seed.colour % PALETTE.length]);
      instanced.setColorAt(index, colour);
    });
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    write();
  }, [colour, seeds, write]);

  useFrame((_, delta) => {
    if (!running) return;
    travelled.current += delta * BELT_SPEED;
    write();
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, seeds.length]}
      frustumCulled={false}
      castShadow
    >
      {children}
      <meshStandardMaterial roughness={0.62} metalness={0.18} />
    </instancedMesh>
  );
}

export function BeltItems({ running }: { running: boolean }) {
  const boxes = React.useMemo(() => makeSeeds(PER_SHAPE, 3), []);
  const cylinders = React.useMemo(() => makeSeeds(PER_SHAPE, 11), []);
  const lumps = React.useMemo(() => makeSeeds(PER_SHAPE, 29), []);

  return (
    <group>
      <Shape seeds={boxes} running={running}>
        <boxGeometry args={[1, 0.72, 1.15]} />
      </Shape>
      <Shape seeds={cylinders} running={running}>
        <cylinderGeometry args={[0.42, 0.42, 1.25, 14]} />
      </Shape>
      <Shape seeds={lumps} running={running}>
        <icosahedronGeometry args={[0.62, 0]} />
      </Shape>
    </group>
  );
}
