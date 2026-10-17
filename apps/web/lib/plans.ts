/**
 * Planes de Renglón y lo que habilita cada uno. Este módulo no lee la base de
 * datos ni variables secretas: lo usan tanto el servidor como el navegador.
 */

export type PlanId = "free" | "weekly" | "pro_monthly" | "pro_yearly";
export type PaidPlanId = Exclude<PlanId, "free">;

export const PAID_PLANS: readonly PaidPlanId[] = ["weekly", "pro_monthly", "pro_yearly"];

export interface PlanInfo {
  id: PlanId;
  name: string;
  /** Días de vigencia que suma cada pago. */
  durationDays: number;
  /** Días antes del vencimiento en que se avisa para renovar. */
  reminderDays: number;
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: { id: "free", name: "Gratis", durationDays: 0, reminderDays: 0 },
  weekly: { id: "weekly", name: "Pase semanal", durationDays: 7, reminderDays: 1 },
  pro_monthly: { id: "pro_monthly", name: "Pro mensual", durationDays: 30, reminderDays: 3 },
  pro_yearly: { id: "pro_yearly", name: "Pro anual", durationDays: 365, reminderDays: 7 },
};

export const isPaidPlan = (v: unknown): v is PaidPlanId => typeof v === "string" && (PAID_PLANS as readonly string[]).includes(v);

/** Funciones habilitadas. `null` en un límite significa «sin límite». */
export interface Features {
  ads: boolean;
  dailyDownloads: number | null;
  dailyPages: number | null;
}

export interface FreeLimits {
  dailyDownloads: number;
  /** 0 = sin límite de páginas. */
  dailyPages: number;
}

export function featuresFor(plan: PlanId, free: FreeLimits): Features {
  if (plan !== "free") return { ads: false, dailyDownloads: null, dailyPages: null };
  return { ads: true, dailyDownloads: free.dailyDownloads, dailyPages: free.dailyPages > 0 ? free.dailyPages : null };
}

export interface SubscriptionLike {
  plan: string;
  currentPeriodEnd: Date;
}

export interface Entitlement {
  plan: PlanId;
  planName: string;
  /** Fin de la vigencia del plan pago (null en el plan gratis). */
  expiresAt: Date | null;
  daysLeft: number | null;
  /** true cuando falta poco para vencer y conviene mostrar el aviso de renovación. */
  expiringSoon: boolean;
  features: Features;
}

const DAY = 24 * 60 * 60 * 1000;

/** Plan vigente a partir de la fila de suscripción (o de su ausencia). */
export function entitlementFrom(sub: SubscriptionLike | null | undefined, now: Date, free: FreeLimits): Entitlement {
  if (!sub || !isPaidPlan(sub.plan) || sub.currentPeriodEnd.getTime() <= now.getTime()) {
    return { plan: "free", planName: PLANS.free.name, expiresAt: null, daysLeft: null, expiringSoon: false, features: featuresFor("free", free) };
  }
  const info = PLANS[sub.plan];
  const msLeft = sub.currentPeriodEnd.getTime() - now.getTime();
  return {
    plan: sub.plan,
    planName: info.name,
    expiresAt: sub.currentPeriodEnd,
    daysLeft: Math.ceil(msLeft / DAY),
    expiringSoon: msLeft <= info.reminderDays * DAY,
    features: featuresFor(sub.plan, free),
  };
}

/** Día calendario en Colombia (UTC−5, sin horario de verano), formato AAAA-MM-DD. */
export function bogotaDay(now: Date): string {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Pesos colombianos sin decimales: 19900 → «$19.900». */
export function formatCop(pesos: number): string {
  return `$${Math.round(pesos).toLocaleString("es-CO")}`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
}
