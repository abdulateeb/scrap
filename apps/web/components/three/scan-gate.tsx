"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";

import { BELT_WIDTH } from "@/components/three/belt-surface";

/**
 * The scan gate.
 *
 * A gantry across the belt carrying an industrial camera. The camera is the
 * blue of a machine vision housing, with a recording light blinking on the back
 * of it and a dark glass lens pointed down at the stream.
 *
 * There is no longer a sheet of coloured light lying on the belt. A wash that
 * size stopped reading as a beam and simply tinted the rubber and everything on
 * it, which made the belt look lit rather than looking like a belt. What is
 * left is a thin sensor line at the exact crossing point, which is all that is
 * needed to say where the reading happens.
 */
export function ScanGate({ highlight }: { highlight: boolean }) {
  const record = React.useRef<Mesh>(null);
  const line = React.useRef<Mesh>(null);
  const clock = React.useRef(0);

  useFrame((_, delta) => {
    clock.current += delta;

    // A recording light does not fade, it blinks: mostly off, briefly on.
    const blink = clock.current % 1.6 < 0.22;
    const light = record.current;
    if (light) {
      const material = light.material as MeshStandardMaterial;
      material.emissiveIntensity = blink ? 6 : 0.25;
    }

    // The sensor line breathes very slightly so the gate is not dead still.
    const mesh = line.current;
    if (mesh) {
      const material = mesh.material as MeshStandardMaterial;
      material.opacity =
        (highlight ? 0.85 : 0.5) + Math.sin(clock.current * 2.6) * 0.06;
    }
  });

  const steel = (
    <meshStandardMaterial color="#a7a9a4" roughness={0.44} metalness={0.35} />
  );

  const post = (side: number) => (
    <mesh
      key={side}
      castShadow
      position={[(side * BELT_WIDTH) / 2 + side * 0.34, 0.95, 0]}
    >
      <boxGeometry args={[0.16, 1.9, 0.16]} />
      {steel}
    </mesh>
  );

  return (
    <group>
      {[-1, 1].map(post)}

      {/* Cross beam */}
      <mesh castShadow position={[0, 1.86, 0]}>
        <boxGeometry args={[BELT_WIDTH + 1.0, 0.17, 0.22]} />
        {steel}
      </mesh>

      {/* The bracket the camera hangs from */}
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[0.1, 0.16, 0.1]} />
        {steel}
      </mesh>

      {/* Camera body. Machine vision housings are this blue, which also keeps
          the one man made object in the scene from reading as another lump. */}
      <mesh castShadow position={[0, 1.6, 0]}>
        <boxGeometry args={[0.46, 0.28, 0.5]} />
        <meshStandardMaterial
          color="#1f5fa8"
          roughness={0.36}
          metalness={0.55}
        />
      </mesh>

      {/* Cooling ribs along the top, so the body is not a plain brick */}
      {[-0.12, 0, 0.12].map((z) => (
        <mesh key={z} position={[0, 1.75, z]}>
          <boxGeometry args={[0.4, 0.02, 0.04]} />
          <meshStandardMaterial
            color="#17497f"
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
      ))}

      {/* Lens barrel and dark glass, pointed at the belt */}
      <mesh position={[0, 1.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.14, 20]} />
        <meshStandardMaterial color="#20242a" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.02, 20]} />
        <meshStandardMaterial
          color="#0b1a24"
          roughness={0.08}
          metalness={0.2}
        />
      </mesh>

      {/* The recording light on the back of the housing */}
      <mesh ref={record} position={[0, 1.6, 0.26]}>
        <sphereGeometry args={[0.032, 12, 12]} />
        <meshStandardMaterial
          color="#ff2d2d"
          emissive="#ff2d2d"
          emissiveIntensity={0.25}
          roughness={0.25}
        />
      </mesh>

      {/* The sensor line at the exact crossing point */}
      <mesh ref={line} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.052, 0]}>
        <planeGeometry args={[BELT_WIDTH, 0.02]} />
        <meshStandardMaterial
          color="#eaf5ff"
          emissive="#cfe6ff"
          emissiveIntensity={1.4}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
