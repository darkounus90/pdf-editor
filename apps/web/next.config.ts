import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo se publican como código TypeScript fuente.
  transpilePackages: ["@pdf-editor/pdf-core", "@pdf-editor/editor-ui"],
  // Se cargan desde node_modules en el servidor: PGlite trae su propio WASM.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // La imagen Docker usa la salida autónoma; en Windows se omite porque pnpm
  // y los enlaces simbólicos de "standalone" no siempre se llevan bien.
  ...(process.env.NEXT_OUTPUT === "standalone" && {
    output: "standalone",
    outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  }),
};

export default nextConfig;
