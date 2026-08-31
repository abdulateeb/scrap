"use client";

import * as React from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerspectiveCamera } from "@react-three/drei";

import { BeltItems } from "@/components/three/belt-items";
import { BeltSurface } from "@/components/three/belt-surface";
import { ScanGate } from "@/components/three/scan-gate";

/**
 * The conveyor.
 *
 * The camera looks down at the belt from above and slightly behind, which is
 * where a real camera would be mounted over a sorting line. Waste rides towards
 * the viewer, crosses a scan gate, and is framed as it passes.
 *
 * Nothing is loaded over the network. Every shape is a primitive and every
 * colour comes from the material tokens, so the scene is deterministic and
 * costs one shader compile.
 */
export default function BeltScene({
  running,
  highlight,
}: {
  running: boolean;
  highlight: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <PerspectiveCamera makeDefault position={[0, 1.25, 2.45]} fov={60} />

      {/* A bright hall: strong neutral fill so the belt reads as brown rubber
          rather than taking on a colour cast, plus a green key held close to
          the gate so the scan still reads as the machine's own light.

          The green light is deliberately weak and short range. When it was
          strong it spilled down the whole belt and turned the rubber and the
          waste green, which made the scan gate stop looking like a gate. */}
      <ambientLight intensity={1.15} color="#ffffff" />
      <directionalLight position={[3, 8, 4]} intensity={2.8} color="#fff6ec" />
      <directionalLight position={[-5, 4, -2]} intensity={0.8} color="#e6e6e6" />
      <pointLight
        position={[0, 1.35, 0]}
        intensity={highlight ? 11 : 5}
        distance={3.4}
        decay={2}
        color="#5fee00"
      />

      <group position={[0, -0.22, 0]}>
        <BeltSurface running={running} />
        <BeltItems running={running} />
        <ScanGate highlight={highlight} />
      </group>

      <fog attach="fog" args={["#e8ece5", 14, 26]} />
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
