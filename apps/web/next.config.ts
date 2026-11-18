import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  typedRoutes: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@ml/db", "@ml/easyverein"],
};

export default nextConfig;
