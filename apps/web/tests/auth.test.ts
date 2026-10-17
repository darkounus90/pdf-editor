import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createAuth } from "../lib/server/auth";
import { createPgliteDb, type Db } from "../lib/server/db";
import { account, user } from "../lib/server/db/schema";

// Comprueba que el esquema de Drizzle es el que espera Better Auth.
let db: Db;
let auth: ReturnType<typeof createAuth>;

beforeAll(async () => {
  db = await createPgliteDb();
  auth = createAuth(db);
});

describe("cuentas con correo y contraseña", () => {
  it("registra, inicia sesión y lee la sesión", async () => {
    const signUp = await auth.api.signUpEmail({ body: { name: "Ana", email: "ana@example.com", password: "clave-segura-1" } });
    expect(signUp.user.email).toBe("ana@example.com");

    const [row] = await db.select().from(user).where(eq(user.email, "ana@example.com"));
    expect(row.name).toBe("Ana");
    const [acc] = await db.select().from(account).where(eq(account.userId, row.id));
    expect(acc.providerId).toBe("credential");
    expect(acc.password).not.toContain("clave-segura-1");

    const res = await auth.api.signInEmail({ body: { email: "ana@example.com", password: "clave-segura-1" }, asResponse: true });
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    expect(cookie).toContain("renglon.session_token");

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.id).toBe(row.id);
  });

  it("rechaza una contraseña incorrecta y correos repetidos", async () => {
    const bad = await auth.api.signInEmail({ body: { email: "ana@example.com", password: "otra-clave-99" }, asResponse: true });
    expect(bad.status).toBe(401);
    const dup = await auth.api.signUpEmail({ body: { name: "Ana 2", email: "ana@example.com", password: "clave-segura-2" }, asResponse: true });
    expect(dup.ok).toBe(false);
  });
});
