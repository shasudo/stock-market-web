import type { NextConfig } from "next";

// The Java backend is the only API. Old-app calls to /api/* are rewritten to
// the versioned Java paths; the browser never touches Java directly (CORS).
const API_ORIGIN =
  process.env.API_ORIGIN ?? "https://129-225-78-203.nip.io";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
