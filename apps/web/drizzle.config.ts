import { defineConfig } from "drizzle-kit";

// Solo se usa para generar migraciones (`pnpm db:generate`), que no necesita conexión.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/renglon" },
});
