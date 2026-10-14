import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo se publican como código TypeScript fuente.
  transpilePackages: ["@pdf-editor/pdf-core", "@pdf-editor/editor-ui"],
};

export default nextConfig;
