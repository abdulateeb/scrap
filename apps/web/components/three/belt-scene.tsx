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

      {/* A bright hall: strong fill so the belt sits on a light page without
          reading as a hole, plus a green key at the gate so the scan still
          reads as the machine's own light. */}
      <ambientLight intensity={1.05} color="#ffffff" />
      <directionalLight position={[3, 8, 4]} intensity={2.6} color="#ffffff" />
      <directionalLight position={[-5, 4, -2]} intensity={0.7} color="#dfe6df" />
      <pointLight
        position={[0, 1.6, 0]}
        intensity={highlight ? 30 : 14}
        distance={9}
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
