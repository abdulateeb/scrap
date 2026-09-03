/**
 * Environment access for the web application.
 *
 * There is no authentication and no database, so the only thing the browser
 * needs to know is where to reach the classification service.
 */

/**
 * Largest upload the platform will carry. Vercel refuses a request body over
 * 100 MB at the edge, before it ever reaches apps/api, so a browser side check
 * that allows more than this cannot be honoured: the request would be rejected
 * with a bare 413 that the service never sees and never gets to explain.
 */
const PLATFORM_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function readMaxUploadBytes(): number {
  const raw = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES);
  // Anything unset, unparseable or nonsensical falls back to the platform cap
  // rather than silently letting an oversized file through.
  if (!Number.isFinite(raw) || raw <= 0) return PLATFORM_MAX_UPLOAD_BYTES;
  return Math.min(raw, PLATFORM_MAX_UPLOAD_BYTES);
}

export const env = {
  /**
   * Base path the browser uses to reach apps/api. Requests go through the
   * rewrite declared in next.config.ts, so there is a single origin in the
   * browser and no cross origin handling.
   */
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE_PATH ?? "/api/scrap",

  /**
   * The file size the upload control refuses at. Lower it for a deployment
   * that wants a tighter limit; it can never be raised above the platform cap,
   * because the platform would reject the request anyway.
   */
  maxUploadBytes: readMaxUploadBytes(),
} as const;
