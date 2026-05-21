// Bundle sizes as of 2026-05-21: Next.js 16 Turbopack build does not emit per-chunk
// First Load JS in CLI output; run with ANALYZE or inspect .next for route bundles.
// Production build: all routes compile clean; no chunk >400kb flagged in static analysis.
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three", "postprocessing"],
  serverExternalPackages: ["chokidar"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
