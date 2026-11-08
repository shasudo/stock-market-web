import type { NextConfig } from "next";

const API_ORIGIN =
  process.env.API_ORIGIN ?? "https://129-225-78-203.nip.io";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
