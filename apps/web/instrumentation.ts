/**
 * Al arrancar el servidor de Node se conecta a la base y aplica las migraciones
 * pendientes, para que un despliegue con cambios de esquema quede listo solo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
    console.warn("[db] sin DATABASE_URL: las cuentas y los pagos no funcionarán.");
    return;
  }
  const { getDb } = await import("./lib/server/db");
  try {
    await getDb();
    console.info("[db] base de datos lista");
  } catch (err) {
    // No se detiene el servidor: el editor sigue funcionando y se reintenta al primer uso.
    console.error("[db] no se pudo conectar o migrar", err);
  }
}
