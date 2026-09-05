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
      // Percentage closer filtering by name, because the default soft variant
      // is deprecated in this version of three and warns on every mount.
      shadows="percentage"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <PerspectiveCamera makeDefault position={[0, 1.25, 2.45]} fov={60} />

      {/* Plain hall lighting, all of it neutral.

          There used to be a green lamp over the gate and a sheet of green light
          lying on the deck. Between them they tinted the rubber and every item
          on it, so the belt read as a lit surface rather than as a belt. The
          scan now shows itself through the camera and a thin sensor line, and
          the light is left to do nothing but light.

          One directional light casts, because shadows under the items are what
          actually sits them on the belt. The rest only fill. */}
      <ambientLight intensity={0.85} color="#ffffff" />
      <directionalLight
        castShadow
        position={[3.5, 7, 4]}
        intensity={2.6}
        color="#fff4e8"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0012}
      />
      <directionalLight position={[-5, 4, -2]} intensity={0.7} color="#dfe6ec" />
      {/* The camera's own working light, white and held tight to the gate. */}
      <pointLight
        position={[0, 1.2, 0]}
        intensity={highlight ? 6 : 2.6}
        distance={2.6}
        decay={2}
        color="#eaf3ff"
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
