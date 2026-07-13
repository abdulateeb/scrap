/**
 * Environment access for the web application.
 *
 * There is no authentication and no database, so the only thing the browser
 * needs to know is where to reach the classification service.
 */

export const env = {
  /**
   * Base path the browser uses to reach apps/api. Requests go through the
   * rewrite declared in next.config.ts, so there is a single origin in the
   * browser and no cross origin handling.
   */
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE_PATH ?? "/api/scrap",
} as const;
