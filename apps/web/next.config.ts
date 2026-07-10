import type { NextConfig } from "next";

/**
 * The browser talks to apps/api through this rewrite rather than calling
 * localhost:5000 directly. One origin means no cross origin cookie handling and
 * no CORS preflight on every upload, and it means the same relative path works
 * unchanged once both applications sit behind one address in production.
 */
const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Next refuses to serve dev chunks to an origin it was not started for, and
  // 127.0.0.1 counts as a different origin from localhost. Without this the
  // browser gets 403 on the scene chunk and the belt silently never renders.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // Next writes AGENTS.md and CLAUDE.md into the app on dev start.
  // This project keeps its own documentation, so that is turned off.
  agentRules: false,

  async rewrites() {
    return [
      {
        source: "/api/scrap/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },

  experimental: {
    // Uploads of belt video are large, so raise the server action ceiling.
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
