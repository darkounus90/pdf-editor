/**
 * Plan, límites y uso de quien hace la petición (con o sin sesión).
 */
import type { Entitlement, FreeLimits } from "../plans";
import { currentUser, type SessionUser } from "./auth";
import { getEntitlement, getUsage, usageSubject, type Usage } from "./billing";
import { freeLimits } from "./config";
import { getDb } from "./db";

/**
 * IP del visitante. Caddy reemplaza X-Forwarded-For por la IP real del cliente
 * (no confía en el valor que manda el navegador), así que el primer valor es fiable.
 */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
}

export interface RequestAccount {
  user: SessionUser | null;
  entitlement: Entitlement;
  subject: string;
  free: FreeLimits;
}

export async function requestAccount(h: Headers, now = new Date()): Promise<RequestAccount> {
  const db = await getDb();
  const user = await currentUser(h);
  const free = freeLimits();
  const entitlement = await getEntitlement(db, user?.id ?? null, now, free);
  const salt = process.env.BETTER_AUTH_SECRET || "renglon";
  return { user, entitlement, subject: usageSubject(user?.id ?? null, clientIp(h), salt), free };
}

/** Respuesta del endpoint de funciones habilitadas (también la usa la interfaz). */
export interface FeaturesResponse {
  user: { name: string; email: string } | null;
  plan: Entitlement["plan"];
  planName: string;
  expiresAt: string | null;
  daysLeft: number | null;
  expiringSoon: boolean;
  features: Entitlement["features"];
  usage?: Usage;
}

export async function featuresResponse(h: Headers, withUsage: boolean): Promise<FeaturesResponse> {
  const now = new Date();
  const { user, entitlement, subject } = await requestAccount(h, now);
  return {
    user: user ? { name: user.name, email: user.email } : null,
    plan: entitlement.plan,
    planName: entitlement.planName,
    expiresAt: entitlement.expiresAt?.toISOString() ?? null,
    daysLeft: entitlement.daysLeft,
    expiringSoon: entitlement.expiringSoon,
    features: entitlement.features,
    ...(withUsage && { usage: await getUsage(await getDb(), subject, now) }),
  };
}
