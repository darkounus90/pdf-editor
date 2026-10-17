/**
 * Planes, uso diario y pagos sobre la base de datos. Las funciones reciben la
 * conexión como parámetro para poder probarlas con PGlite.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { bogotaDay, entitlementFrom, PLANS, type Entitlement, type FreeLimits, type PaidPlanId } from "../plans";
import type { Db } from "./db";
import { dailyUsage, payment, paymentEvent, subscription } from "./db/schema";
import type { WompiEvent, WompiTransaction } from "./wompi";

// ---------- Plan vigente ----------

export async function getEntitlement(db: Db, userId: string | null, now: Date, free: FreeLimits): Promise<Entitlement> {
  if (!userId) return entitlementFrom(null, now, free);
  const [sub] = await db.select().from(subscription).where(eq(subscription.userId, userId)).limit(1);
  return entitlementFrom(sub, now, free);
}

// ---------- Uso diario ----------

/** Sujeto al que se le cuenta el uso: el usuario o, sin sesión, un hash de su IP. */
export function usageSubject(userId: string | null, ip: string, salt: string): string {
  if (userId) return `u:${userId}`;
  return `ip:${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)}`;
}

export interface Usage {
  downloads: number;
  pages: number;
}

export async function getUsage(db: Db, subject: string, now: Date): Promise<Usage> {
  const [row] = await db
    .select({ downloads: dailyUsage.downloads, pages: dailyUsage.pages })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.subject, subject), eq(dailyUsage.day, bogotaDay(now))))
    .limit(1);
  return row ?? { downloads: 0, pages: 0 };
}

export type DownloadResult =
  | { allowed: true; usage: Usage }
  | { allowed: false; reason: "downloads" | "pages"; usage: Usage };

/**
 * Registra una descarga de `pages` páginas si cabe en los límites del día.
 * La comprobación y el incremento van en una sola sentencia, así dos descargas
 * simultáneas no pueden pasarse del límite. `limits` null = sin límites (planes pagos).
 */
export async function recordDownload(
  db: Db,
  subject: string,
  pages: number,
  limits: { dailyDownloads: number | null; dailyPages: number | null } | null,
  now: Date,
): Promise<DownloadResult> {
  const day = bogotaDay(now);
  const maxDownloads = limits?.dailyDownloads ?? null;
  const maxPages = limits?.dailyPages ?? null;

  // Una sola descarga ya excede el límite: no hace falta tocar la base.
  if ((maxDownloads !== null && maxDownloads < 1) || (maxPages !== null && pages > maxPages)) {
    const usage = await getUsage(db, subject, now);
    return { allowed: false, reason: maxDownloads !== null && maxDownloads < 1 ? "downloads" : "pages", usage };
  }

  const conditions = [];
  if (maxDownloads !== null) conditions.push(sql`${dailyUsage.downloads} + 1 <= ${maxDownloads}`);
  if (maxPages !== null) conditions.push(sql`${dailyUsage.pages} + ${pages} <= ${maxPages}`);

  const rows = await db
    .insert(dailyUsage)
    .values({ subject, day, downloads: 1, pages })
    .onConflictDoUpdate({
      target: [dailyUsage.subject, dailyUsage.day],
      set: {
        downloads: sql`${dailyUsage.downloads} + 1`,
        pages: sql`${dailyUsage.pages} + ${pages}`,
        updatedAt: now,
      },
      ...(conditions.length ? { setWhere: and(...conditions) } : {}),
    })
    .returning({ downloads: dailyUsage.downloads, pages: dailyUsage.pages });

  if (rows[0]) return { allowed: true, usage: rows[0] };
  const usage = await getUsage(db, subject, now);
  const reason = maxDownloads !== null && usage.downloads + 1 > maxDownloads ? "downloads" : "pages";
  return { allowed: false, reason, usage };
}

// ---------- Pagos ----------

export function newReference(now: Date): string {
  return `RGL-${now.getTime().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function createPayment(
  db: Db,
  input: { userId: string; plan: PaidPlanId; amountInCents: number; currency?: string },
  now: Date,
): Promise<{ reference: string }> {
  const reference = newReference(now);
  await db.insert(payment).values({
    reference,
    userId: input.userId,
    plan: input.plan,
    amountInCents: input.amountInCents,
    currency: input.currency ?? "COP",
    status: "PENDING",
  });
  return { reference };
}

export type ApplyResult =
  | "applied" // pago aprobado: el plan se activó o extendió
  | "already_applied" // evento repetido de un pago ya aplicado
  | "status_updated" // pendiente, rechazado, anulado o con error
  | "unknown_reference"
  | "amount_mismatch"
  | "no_user";

/**
 * Aplica el estado de una transacción de Wompi a su pago. Es idempotente: el
 * plan solo se extiende la primera vez que el pago pasa a APPROVED, sin importar
 * cuántas veces llegue el evento (o si también lo aplica la página de retorno).
 */
export async function applyTransaction(db: Db, tx: WompiTransaction, now: Date): Promise<ApplyResult> {
  const [pay] = await db.select().from(payment).where(eq(payment.reference, tx.reference)).limit(1);
  if (!pay) return "unknown_reference";
  if (Number(tx.amount_in_cents) !== pay.amountInCents || tx.currency !== pay.currency) return "amount_mismatch";
  if (pay.appliedAt) return "already_applied";

  if (tx.status !== "APPROVED") {
    await db
      .update(payment)
      .set({ status: String(tx.status), wompiTransactionId: tx.id })
      .where(and(eq(payment.reference, pay.reference), isNull(payment.appliedAt)));
    return "status_updated";
  }
  if (!pay.userId) return "no_user";
  const userId = pay.userId;

  return db.transaction(async (trx) => {
    // Marca el pago como aplicado solo si nadie lo hizo antes (carrera entre el
    // webhook y la página de retorno, o eventos duplicados en paralelo).
    const claimed = await trx
      .update(payment)
      .set({ status: "APPROVED", wompiTransactionId: tx.id, appliedAt: now })
      .where(and(eq(payment.reference, pay.reference), isNull(payment.appliedAt)))
      .returning({ reference: payment.reference });
    if (!claimed.length) return "already_applied" as const;

    const days = PLANS[pay.plan as PaidPlanId]?.durationDays;
    if (!days) throw new Error(`Plan desconocido en el pago ${pay.reference}: ${pay.plan}`);
    const nowIso = now.toISOString();
    await trx
      .insert(subscription)
      .values({
        userId,
        plan: pay.plan,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + days * 86_400_000),
      })
      .onConflictDoUpdate({
        target: subscription.userId,
        set: {
          plan: pay.plan,
          // Si el plan sigue vigente, el tiempo comprado se suma al que queda.
          currentPeriodStart: sql`case when ${subscription.currentPeriodEnd} > ${nowIso}::timestamptz then ${subscription.currentPeriodStart} else ${nowIso}::timestamptz end`,
          currentPeriodEnd: sql`greatest(${subscription.currentPeriodEnd}, ${nowIso}::timestamptz) + make_interval(days => ${days}::int)`,
          reminderSentFor: null,
          updatedAt: now,
        },
      });
    return "applied" as const;
  });
}

/**
 * Procesa un evento de Wompi ya verificado. Guarda el evento (deduplicado por
 * checksum) y, si es de una transacción, aplica su estado al pago.
 */
export async function handleWompiEvent(
  db: Db,
  event: WompiEvent,
  now: Date,
): Promise<{ duplicate: boolean; result: ApplyResult | "ignored" }> {
  const tx = event.data?.transaction;
  const inserted = await db
    .insert(paymentEvent)
    .values({
      checksum: event.signature.checksum.toLowerCase(),
      event: event.event,
      reference: tx?.reference ?? null,
      transactionId: tx?.id ?? null,
      status: tx ? String(tx.status) : null,
      payload: event,
    })
    .onConflictDoNothing()
    .returning({ checksum: paymentEvent.checksum });
  const duplicate = inserted.length === 0;
  if (event.event !== "transaction.updated" || !tx?.reference) return { duplicate, result: "ignored" };
  // Aun si el evento es repetido se vuelve a aplicar: applyTransaction es idempotente
  // y así se recupera un intento anterior que falló a mitad de camino.
  return { duplicate, result: await applyTransaction(db, tx, now) };
}

// ---------- Avisos de vencimiento ----------

/** Planes pagos que vencen dentro de `withinDays` y a los que aún no se les avisó. */
export async function subscriptionsToRemind(db: Db, now: Date, withinDays: number) {
  return db
    .select()
    .from(subscription)
    .where(
      and(
        gt(subscription.currentPeriodEnd, now),
        lte(subscription.currentPeriodEnd, new Date(now.getTime() + withinDays * 86_400_000)),
        sql`${subscription.reminderSentFor} is distinct from ${subscription.currentPeriodEnd}`,
      ),
    );
}

export async function markReminded(db: Db, userId: string, periodEnd: Date) {
  await db.update(subscription).set({ reminderSentFor: periodEnd }).where(eq(subscription.userId, userId));
}
