"use client";

import { env } from "@/lib/env";
import type { ApiError, Result } from "@/lib/types";

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
    try {
      const body = (await response.json()) as ApiError;
      if (body?.detail) detail = body.detail;
    } catch {
      // The service returned something that is not JSON. Keep the status text.
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function classify(input: {
  file: File;
  sourceKind: "image" | "video" | "capture";
  maxFrames?: number;
}): Promise<Result> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("source_kind", input.sourceKind);
  if (input.maxFrames) form.append("max_frames", String(input.maxFrames));

  return request<Result>("/classify", { method: "POST", body: form });
}

export interface ServiceHealth {
  status: string;
  model: string;
  modelConfigured: boolean;
}

export async function getHealth(): Promise<ServiceHealth> {
  return request<ServiceHealth>("/health");
}
