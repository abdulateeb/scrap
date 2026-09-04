"use client";

import { env } from "@/lib/env";
import type { ApiError, Result } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

/**
 * Browser side client for apps/api.
 *
 * Open access, so there is no token on any request. Calls go to a same origin
 * path that next.config.ts rewrites to the Python service.
 */

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiBasePath}${path}`, init);

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    if (response.status === 413) {
      // A body this large is refused at the platform edge, so this response
      // comes from the platform and not from apps/api. There is no JSON to
      // read, and the default status text explains nothing.
      detail = `The file is larger than ${formatBytes(env.maxUploadBytes)}.`;
    }
    try {
      const body = (await response.json()) as ApiError;
      if (body?.detail) detail = body.detail;
    } catch {
      // The service returned something that is not JSON. Keep the message above.
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function classify(
  input: {
    file: File;
    sourceKind: "image" | "video" | "capture";
    maxFrames?: number;
    /**
     * Tile the frame into a grid and classify each tile as well as the whole.
     * Finds more small items at the cost of five model calls instead of one.
     * Left unset the service decides: on for an upload, off for a live capture.
     */
    thorough?: boolean;
  },
  init: { signal?: AbortSignal } = {},
): Promise<Result> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("source_kind", input.sourceKind);
  if (input.maxFrames) form.append("max_frames", String(input.maxFrames));
  if (input.thorough !== undefined) {
    form.append("thorough", String(input.thorough));
  }

  return request<Result>("/classify", {
    method: "POST",
    body: form,
    signal: init.signal,
  });
}

export interface ServiceHealth {
  status: string;
  model: string;
  modelConfigured: boolean;
}

export async function getHealth(): Promise<ServiceHealth> {
  return request<ServiceHealth>("/health");
}
