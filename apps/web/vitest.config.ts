import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Cada archivo levanta su propio Postgres en memoria (PGlite) y aplica las migraciones.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
