import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  typedRoutes: true,
  // Types are checked by `pnpm typecheck` and `pnpm lint` (tsrs); skipping Next's own pass
  // saves 0.6-1s per build.
  typescript: { ignoreBuildErrors: true },
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@ml/db", "@ml/easyverein"],
};

export default nextConfig;
