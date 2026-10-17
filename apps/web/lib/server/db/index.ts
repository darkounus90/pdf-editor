/**
 * Conexión a la base de datos.
 *
 * - Con DATABASE_URL (producción, o un Postgres local): node-postgres.
 * - Sin DATABASE_URL y fuera de producción: PGlite (Postgres compilado a WASM)
 *   guardado en apps/web/.data/pglite, para desarrollar sin Docker.
 *
 * En ambos casos las migraciones de apps/web/drizzle se aplican una vez, la
 * primera vez que se pide la conexión.
 */
import { join } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { schema } from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const migrationsFolder = () => process.env.MIGRATIONS_DIR || join(process.cwd(), "drizzle");

/** PGlite con las migraciones aplicadas. Sin `dataDir` vive solo en memoria (pruebas). */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return db as unknown as Db;
}

async function createPostgresDb(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX) || 10 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return db as unknown as Db;
}

// Se guarda en globalThis para que la recarga en caliente de `next dev` no abra
// una segunda conexión (PGlite no admite dos instancias sobre la misma carpeta).
const globalDb = globalThis as unknown as { __renglonDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalDb.__renglonDb) {
    const url = process.env.DATABASE_URL?.trim();
    if (url) globalDb.__renglonDb = createPostgresDb(url);
    else if (process.env.NODE_ENV === "production") {
      return Promise.reject(new Error("Falta DATABASE_URL: las cuentas y los pagos necesitan Postgres."));
    } else globalDb.__renglonDb = createPgliteDb(process.env.PGLITE_DIR || join(process.cwd(), ".data", "pglite"));
    // Si falla (p. ej. la base aún no arranca), el próximo intento vuelve a conectar.
    globalDb.__renglonDb.catch(() => {
      globalDb.__renglonDb = undefined;
    });
  }
  return globalDb.__renglonDb;
}

/** Solo para pruebas: usa esta base en lugar de la configurada. */
export function setDbForTests(db: Db | undefined) {
  globalDb.__renglonDb = db ? Promise.resolve(db) : undefined;
}
