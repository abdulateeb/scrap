"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import type { InstancedMesh, Sprite, Texture } from "three";
import { Object3D } from "three";

import {
  BELT_LENGTH,
  BELT_SPEED,
  BELT_WIDTH,
} from "@/components/three/belt-surface";
import {
  MATERIAL_COLOURS,
  cardboardTexture,
  filmTexture,
  glassTexture,
  labelTexture,
  metalTexture,
  organicTexture,
  paperTexture,
  plasticTexture,
} from "@/components/three/textures";

/**
 * The waste riding the belt.
 *
 * Each kind of waste is its own instanced mesh with its own painted surface and
 * its own proportions, because that is what makes a stream read as a stream: a
 * carton is a wide flat box of corrugated board, a bottle is a tall ribbed
 * cylinder, a can is short and metallic, a sheet of paper is almost flat. One
 * shape in nine colours never looked like refuse.
 *
 * A few items also carry a label, the way the classifier would name them. The
 * label rides the item down the belt and only shows near the gate, which is
 * where the naming happens.
 */

/** Height of a floating label in belt units. Width follows the text. */
const LABEL_HEIGHT = 0.26;

interface Kind {
  material: keyof typeof MATERIAL_COLOURS;
  /** What the classifier would call it. */
  names: string[];
  count: number;
  /** Box dimensions or cylinder proportions, in belt units. */
  size: [number, number, number];
  shape: "box" | "cylinder" | "lump";
  texture: () => Texture;
  roughness: number;
  metalness: number;
  /** Sits flat on the belt rather than tumbling, like board and paper do. */
  flat?: boolean;
}

const KINDS: Kind[] = [
  {
    material: "cardboard",
    names: ["cardboard box", "flattened carton", "corrugated sheet"],
    count: 22,
    size: [0.62, 0.3, 0.78],
    shape: "box",
    texture: cardboardTexture,
    roughness: 0.94,
    metalness: 0.0,
    flat: true,
  },
  {
    material: "paper",
    names: ["newspaper", "office paper", "magazine"],
    count: 22,
    size: [0.5, 0.055, 0.66],
    shape: "box",
    texture: paperTexture,
    roughness: 0.92,
    metalness: 0.0,
    flat: true,
  },
  {
    material: "plastic",
    names: ["PET bottle", "drinks bottle", "plastic container"],
    count: 26,
    size: [0.15, 0.62, 0.15],
    shape: "cylinder",
    texture: plasticTexture,
    roughness: 0.28,
    metalness: 0.02,
  },
  {
    material: "metal",
    names: ["drinks can", "steel tin", "aluminium can"],
    count: 22,
    size: [0.14, 0.36, 0.14],
    shape: "cylinder",
    texture: metalTexture,
    roughness: 0.32,
    metalness: 0.72,
  },
  {
    material: "glass",
    names: ["glass bottle", "jar"],
    count: 16,
    size: [0.13, 0.5, 0.13],
    shape: "cylinder",
    texture: glassTexture,
    roughness: 0.12,
    metalness: 0.0,
  },
  {
    material: "organic",
    names: ["food waste", "garden waste"],
    count: 18,
    size: [0.3, 0.3, 0.3],
    shape: "lump",
    texture: organicTexture,
    roughness: 0.96,
    metalness: 0.0,
  },
  {
    material: "textiles",
    names: ["plastic film", "carrier bag", "fabric offcut"],
    count: 18,
    size: [0.54, 0.1, 0.5],
    shape: "lump",
    texture: filmTexture,
    roughness: 0.66,
    metalness: 0.0,
    flat: true,
  },
];

interface Seed {
  x: number;
  z: number;
  scale: number;
  spin: number;
  tilt: number;
  yaw: number;
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
    x: (next() - 0.5) * (BELT_WIDTH - 0.8),
    z: next() * BELT_LENGTH - BELT_LENGTH / 2,
    // Real refuse varies in size but nothing on a sorting line is as wide as
    // the belt. Keeping the top of the range under one holds that true.
    scale: 0.45 + next() * 0.5,
    spin: (next() - 0.5) * 0.5,
    tilt: next() * Math.PI * 2,
    yaw: next() * Math.PI * 2,
  }));
}

/** A fixed run of pseudo random numbers, drawn once and then only read. */
function draws(salt: number, count: number): number[] {
  let value = salt * 9301 + 49297;
  return Array.from({ length: count }, () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  });
}

/** Where an item is at this moment, given how far the belt has travelled. */
function positionAt(seed: Seed, travelled: number): number {
  return (
    ((seed.z + travelled + BELT_LENGTH * 1.5) % BELT_LENGTH) - BELT_LENGTH / 2
  );
}

function Group({
  kind,
  seeds,
  running,
  travelled,
}: {
  kind: Kind;
  seeds: Seed[];
  running: boolean;
  travelled: React.RefObject<number>;
}) {
  const mesh = React.useRef<InstancedMesh>(null);
  const dummy = React.useMemo(() => new Object3D(), []);
  const texture = React.useMemo(() => kind.texture(), [kind]);

  React.useEffect(() => () => texture.dispose(), [texture]);

  const write = React.useCallback(() => {
    const instanced = mesh.current;
    if (!instanced) return;

    const lift = kind.flat ? kind.size[1] * 0.5 : kind.size[1] * 0.5;

    seeds.forEach((seed, index) => {
      const z = positionAt(seed, travelled.current);
      dummy.position.set(seed.x, 0.07 + lift * seed.scale, z);

      if (kind.flat) {
        // Board and paper lie down and only turn on the spot. Anything else
        // rolls, which is what a bottle or a can does on a moving belt.
        dummy.rotation.set(0, seed.yaw + travelled.current * seed.spin * 0.2, 0);
      } else if (kind.shape === "cylinder") {
        dummy.rotation.set(
          Math.PI / 2,
          seed.yaw,
          travelled.current * seed.spin * 1.6,
        );
      } else {
        dummy.rotation.set(
          seed.tilt + travelled.current * seed.spin * 0.4,
          seed.yaw,
          seed.tilt * 0.5,
        );
      }

      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  }, [dummy, kind, seeds, travelled]);

  React.useEffect(write, [write]);
  useFrame(() => {
    if (!running) return;
    write();
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, seeds.length]}
      frustumCulled={false}
      castShadow
      receiveShadow
    >
      {kind.shape === "box" ? (
        <boxGeometry args={kind.size} />
      ) : kind.shape === "cylinder" ? (
        <cylinderGeometry
          args={[kind.size[0], kind.size[0] * 0.92, kind.size[1], 14]}
        />
      ) : (
        <dodecahedronGeometry args={[kind.size[0], 0]} />
      )}
      <meshStandardMaterial
        map={texture}
        roughness={kind.roughness}
        metalness={kind.metalness}
      />
    </instancedMesh>
  );
}

/**
 * The classifier's own labels, floating over items as they reach the gate.
 *
 * A fixed pool of sprites is reused rather than one per item, so the cost does
 * not grow with the stream. Each sprite is pinned to one chosen item and fades
 * in as that item comes into the gate and out again once it has passed.
 */
function Labels({
  picks,
  travelled,
}: {
  picks: { seed: Seed; label: string; percent: number; colour: string }[];
  travelled: React.RefObject<number>;
}) {
  const sprites = React.useRef<(Sprite | null)[]>([]);

  const chips = React.useMemo(
    () => picks.map((p) => labelTexture(p.label, p.percent, p.colour)),
    [picks],
  );

  React.useEffect(
    () => () => chips.forEach((chip) => chip.texture.dispose()),
    [chips],
  );

  useFrame(() => {
    picks.forEach((pick, index) => {
      const sprite = sprites.current[index];
      if (!sprite) return;

      const z = positionAt(pick.seed, travelled.current);
      sprite.position.set(pick.seed.x, 0.62, z);

      // Only readable near the gate. Away from it the label would just be
      // clutter over a part of the belt nothing is looking at.
      const distance = Math.abs(z);
      const visible = distance < 2.6;
      sprite.visible = visible;
      if (visible) {
        const material = sprite.material;
        material.opacity = Math.min(1, (2.6 - distance) / 0.9);
      }
    });
  });

  return (
    <group>
      {picks.map((pick, index) => (
        <sprite
          key={`${pick.label}-${index}`}
          ref={(node) => {
            sprites.current[index] = node;
          }}
          scale={[LABEL_HEIGHT * chips[index].aspect, LABEL_HEIGHT, 1]}
        >
          <spriteMaterial
            map={chips[index].texture}
            transparent
            depthWrite={false}
            opacity={0}
          />
        </sprite>
      ))}
    </group>
  );
}

export function BeltItems({ running }: { running: boolean }) {
  const travelled = React.useRef(0);

  const groups = React.useMemo(
    () =>
      KINDS.map((kind, index) => ({
        kind,
        seeds: makeSeeds(kind.count, 3 + index * 17),
      })),
    [],
  );

  // One labelled item per kind, taken from that kind's own seeds so the label
  // sits on something that really is that material.
  const picks = React.useMemo(() => {
    const roll = draws(5, groups.length * 3);
    return groups.map(({ kind, seeds }, index) => ({
      seed: seeds[Math.floor(roll[index * 3] * seeds.length)],
      label: kind.names[Math.floor(roll[index * 3 + 1] * kind.names.length)],
      percent: 82 + Math.floor(roll[index * 3 + 2] * 17),
      colour: MATERIAL_COLOURS[kind.material],
    }));
  }, [groups]);

  useFrame((_, delta) => {
    if (running) travelled.current += delta * BELT_SPEED;
  });

  return (
    <group>
      {groups.map(({ kind, seeds }) => (
        <Group
          key={kind.material}
          kind={kind}
          seeds={seeds}
          running={running}
          travelled={travelled}
        />
      ))}
      <Labels picks={picks} travelled={travelled} />
    </group>
  );
}
