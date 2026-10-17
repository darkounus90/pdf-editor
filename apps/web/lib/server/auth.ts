/**
 * Cuentas de usuario con Better Auth sobre la base de datos de Renglón.
 *
 * - Correo y contraseña: siempre.
 * - Enlace mágico y recuperar contraseña: cuando hay correo (SMTP_URL), o en desarrollo.
 * - Google: cuando hay GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { headers } from "next/headers";
import { appUrl } from "./config";
import { getDb, type Db } from "./db";
import { schema } from "./db/schema";
import { actionMail, emailEnabled, sendMail } from "./email";

export interface AuthMethods {
  magicLink: boolean;
  passwordReset: boolean;
  google: boolean;
}

export function authMethods(): AuthMethods {
  const mail = emailEnabled() || process.env.NODE_ENV !== "production";
  return {
    magicLink: mail,
    passwordReset: mail,
    google: !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
  };
}

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("Falta BETTER_AUTH_SECRET.");
  return "renglon-desarrollo-no-usar-en-produccion-0123456789";
}

export function createAuth(db: Db) {
  const methods = authMethods();
  return betterAuth({
    appName: "Renglón",
    baseURL: appUrl(),
    secret: authSecret(),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: methods.passwordReset
        ? async ({ user, url }) => {
            await sendMail(
              actionMail(
                user.email,
                "Restablece tu contraseña de Renglón",
                "Recibimos una solicitud para cambiar la contraseña de tu cuenta de Renglón.",
                "Elegir una contraseña nueva",
                url,
                "El enlace vence en una hora. Si no lo pediste, ignora este correo: tu contraseña sigue igual.",
              ),
            );
          }
        : undefined,
    },
    socialProviders: methods.google
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
            prompt: "select_account",
          },
        }
      : undefined,
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    user: { deleteUser: { enabled: true } },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: { cookiePrefix: "renglon" },
    plugins: [
      ...(methods.magicLink
        ? [
            magicLink({
              expiresIn: 15 * 60,
              storeToken: "hashed",
              sendMagicLink: async ({ email, url }) => {
                await sendMail(
                  actionMail(
                    email,
                    "Tu enlace para entrar a Renglón",
                    "Usa este enlace para entrar a tu cuenta de Renglón. Si aún no tienes cuenta, se crea al abrirlo.",
                    "Entrar a Renglón",
                    url,
                    "El enlace vence en 15 minutos y solo sirve una vez. Si no lo pediste, ignora este correo.",
                  ),
                );
              },
            }),
          ]
        : []),
      // Debe ir de último: deja que las acciones del servidor fijen cookies.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalAuth = globalThis as unknown as { __renglonAuth?: Promise<Auth> };

/** Instancia de Better Auth (se crea al primer uso, después de conectar la base). */
export function getAuth(): Promise<Auth> {
  if (!globalAuth.__renglonAuth) {
    globalAuth.__renglonAuth = getDb().then(createAuth);
    globalAuth.__renglonAuth.catch(() => {
      globalAuth.__renglonAuth = undefined;
    });
  }
  return globalAuth.__renglonAuth;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/** Usuario de la petición actual (componentes de servidor y rutas), o null. */
export async function currentUser(requestHeaders?: Headers): Promise<SessionUser | null> {
  // headers() va primero: marca la página como dinámica antes de tocar la base.
  const h = requestHeaders ?? (await headers());
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image };
}
