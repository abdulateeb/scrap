import type { MaterialKey } from "@/lib/materials";

/** Mirrors apps/api/app/models.py. Keep the two in step. */

export type SourceKind = "image" | "video" | "capture";

export interface Detection {
  material: MaterialKey;
  confidence: number;
  /** Normalised to 0 to 1, origin at the top left of the frame. */
  box: { x: number; y: number; width: number; height: number } | null;
  note: string | null;
}

export interface Frame {
  index: number;
  /** Position inside the source video, in seconds. Null for still images. */
  timestampSeconds: number | null;
  /** The frame itself, as a data URL. Nothing is stored on the server. */
  image: string;
  status: "done" | "failed";
  detections: Detection[];
  error: string | null;
}

export interface CompositionShare {
  material: MaterialKey;
  count: number;
  share: number;
  meanConfidence: number;
}

export interface Composition {
  totalDetections: number;
  framesUsed: number;
  framesExcluded: number;
  shares: CompositionShare[];
}

export interface Result {
  sourceKind: SourceKind;
  sourceName: string;
  model: string;
  frameCount: number;
  detectionCount: number;
  durationMs: number;
  error: string | null;
  frames: Frame[];
  composition: Composition | null;
}

export interface ApiError {
  detail: string;
}
