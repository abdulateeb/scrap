"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { MeshBasicMaterial } from "three";

import { BELT_WIDTH } from "@/components/three/belt-surface";

/**
 * The scan gate.
 *
 * A gantry across the belt with a camera housing on it and a plane of green
 * light underneath. This is the one place in the scene that is allowed to be
 * bright, because it is the thing the whole product is about: the moment an
 * item passes under a camera and gets named.
 */
export function ScanGate({ highlight }: { highlight: boolean }) {
  const beam = React.useRef<Mesh>(null);
  const pulse = React.useRef(0);

  useFrame((_, delta) => {
    const mesh = beam.current;
    if (!mesh) return;

    pulse.current += delta;
    const material = mesh.material as MeshBasicMaterial;
    // Additive green reads weaker on a light deck, so the beam sits higher
    // than it would on a dark page.
    const base = highlight ? 0.8 : 0.5;
    material.opacity = base + Math.sin(pulse.current * 2.4) * 0.07;
  });

  const post = (side: number) => (
    <mesh key={side} position={[(side * BELT_WIDTH) / 2 + side * 0.34, 0.95, 0]}>
      <boxGeometry args={[0.16, 1.9, 0.16]} />
      <meshStandardMaterial color="#9aa298" roughness={0.36} metalness={0.82} />
    </mesh>
  );

  return (
    <group>
      {[-1, 1].map(post)}

      {/* Cross beam */}
      <mesh position={[0, 1.86, 0]}>
        <boxGeometry args={[BELT_WIDTH + 1.0, 0.17, 0.22]} />
        <meshStandardMaterial color="#9aa298" roughness={0.36} metalness={0.82} />
      </mesh>

      {/* Camera housing, pointed down at the belt */}
      <mesh position={[0, 1.64, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.42]} />
        <meshStandardMaterial color="#3d443a" roughness={0.45} metalness={0.65} />
      </mesh>
      <mesh position={[0, 1.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.13, 0.12, 18]} />
        <meshStandardMaterial
          color="#5fee00"
          emissive="#5fee00"
          emissiveIntensity={highlight ? 2.6 : 1.1}
          roughness={0.2}
        />
      </mesh>

      {/* The light the camera casts on the belt */}
      <mesh ref={beam} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <planeGeometry args={[BELT_WIDTH, 0.9]} />
        <meshBasicMaterial color="#5fee00" transparent opacity={0.42} />
      </mesh>

      {/* A tight line at the exact gate, so the crossing moment reads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[BELT_WIDTH, 0.035]} />
        <meshBasicMaterial color="#3fbe00" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}
