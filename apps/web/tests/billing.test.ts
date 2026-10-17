import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bogotaDay, entitlementFrom, featuresFor, type FreeLimits } from "../lib/plans";
import { createPgliteDb, type Db } from "../lib/server/db";
import { payment, paymentEvent, subscription, user } from "../lib/server/db/schema";
import {
  applyTransaction,
  createPayment,
  getEntitlement,
  getUsage,
  handleWompiEvent,
  recordDownload,
  subscriptionsToRemind,
  usageSubject,
} from "../lib/server/billing";
import { eventChecksum, verifyEvent, type WompiEvent, type WompiTransaction } from "../lib/server/wompi";

const FREE: FreeLimits = { dailyDownloads: 3, dailyPages: 20 };
const DAY = 86_400_000;
const NOW = new Date("2026-10-16T15:00:00.000Z"); // 10:00 en Bogotá

let db: Db;
let n = 0;
async function newUser() {
  const id = `user-${++n}`;
  await db.insert(user).values({ id, name: `Usuario ${n}`, email: `u${n}@example.com` });
  return id;
}

beforeAll(async () => {
  db = await createPgliteDb();
});

describe("planes y permisos", () => {
  it("el plan gratis tiene anuncios y límites; los pagos no", () => {
    expect(featuresFor("free", FREE)).toEqual({ ads: true, dailyDownloads: 3, dailyPages: 20 });
    for (const plan of ["weekly", "pro_monthly", "pro_yearly"] as const) {
      expect(featuresFor(plan, FREE)).toEqual({ ads: false, dailyDownloads: null, dailyPages: null });
    }
    expect(featuresFor("free", { dailyDownloads: 3, dailyPages: 0 }).dailyPages).toBeNull();
  });

  it("una suscripción vencida o desconocida vuelve al plan gratis", () => {
    expect(entitlementFrom(null, NOW, FREE).plan).toBe("free");
    expect(entitlementFrom({ plan: "pro_monthly", currentPeriodEnd: new Date(NOW.getTime() - 1) }, NOW, FREE).plan).toBe("free");
    expect(entitlementFrom({ plan: "otro", currentPeriodEnd: new Date(NOW.getTime() + DAY) }, NOW, FREE).plan).toBe("free");
  });

  it("avisa cuando falta poco para vencer", () => {
    const soon = entitlementFrom({ plan: "pro_monthly", currentPeriodEnd: new Date(NOW.getTime() + 2 * DAY) }, NOW, FREE);
    expect(soon).toMatchObject({ plan: "pro_monthly", daysLeft: 2, expiringSoon: true });
    const later = entitlementFrom({ plan: "pro_monthly", currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY) }, NOW, FREE);
    expect(later.expiringSoon).toBe(false);
    const weekly = entitlementFrom({ plan: "weekly", currentPeriodEnd: new Date(NOW.getTime() + 2 * DAY) }, NOW, FREE);
    expect(weekly.expiringSoon).toBe(false);
  });

  it("el día se cuenta en hora de Colombia", () => {
    expect(bogotaDay(new Date("2026-10-17T04:59:00Z"))).toBe("2026-10-16");
    expect(bogotaDay(new Date("2026-10-17T05:00:00Z"))).toBe("2026-10-17");
  });

  it("el sujeto anónimo no expone la IP", () => {
    const s = usageSubject(null, "181.50.1.2", "sal");
    expect(s).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(s).not.toContain("181");
    expect(usageSubject(null, "181.50.1.2", "otra")).not.toBe(s);
    expect(usageSubject("abc", "181.50.1.2", "sal")).toBe("u:abc");
  });
});

describe("límites diarios", () => {
  const limits = featuresFor("free", FREE);

  it("permite hasta el límite de descargas y luego bloquea", async () => {
    const subject = "u:limite-descargas";
    for (let i = 1; i <= 3; i++) {
      const r = await recordDownload(db, subject, 1, limits, NOW);
      expect(r).toEqual({ allowed: true, usage: { downloads: i, pages: i } });
    }
    const blocked = await recordDownload(db, subject, 1, limits, NOW);
    expect(blocked).toEqual({ allowed: false, reason: "downloads", usage: { downloads: 3, pages: 3 } });
    // Un intento bloqueado no suma uso.
    expect(await getUsage(db, subject, NOW)).toEqual({ downloads: 3, pages: 3 });
  });

  it("bloquea por páginas y no cuenta el intento", async () => {
    const subject = "u:limite-paginas";
    expect((await recordDownload(db, subject, 15, limits, NOW)).allowed).toBe(true);
    const r = await recordDownload(db, subject, 6, limits, NOW);
    expect(r).toEqual({ allowed: false, reason: "pages", usage: { downloads: 1, pages: 15 } });
    expect((await recordDownload(db, subject, 5, limits, NOW)).allowed).toBe(true);
    // Un documento más largo que el límite diario se rechaza aunque no haya uso.
    expect(await recordDownload(db, "u:doc-largo", 21, limits, NOW)).toMatchObject({ allowed: false, reason: "pages" });
  });

  it("el contador se reinicia al día siguiente", async () => {
    const subject = "u:dia-siguiente";
    for (let i = 0; i < 3; i++) await recordDownload(db, subject, 1, limits, NOW);
    expect((await recordDownload(db, subject, 1, limits, NOW)).allowed).toBe(false);
    expect((await recordDownload(db, subject, 1, limits, new Date(NOW.getTime() + DAY))).allowed).toBe(true);
  });

  it("descargas simultáneas no se pasan del límite", async () => {
    const subject = "u:simultaneas";
    const results = await Promise.all(Array.from({ length: 8 }, () => recordDownload(db, subject, 1, limits, NOW)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(await getUsage(db, subject, NOW)).toEqual({ downloads: 3, pages: 3 });
  });

  it("sin límites (planes pagos) solo registra el uso", async () => {
    const subject = "u:pro";
    for (let i = 0; i < 10; i++) expect((await recordDownload(db, subject, 50, null, NOW)).allowed).toBe(true);
    expect(await getUsage(db, subject, NOW)).toEqual({ downloads: 10, pages: 500 });
  });
});

describe("pagos", () => {
  const tx = (reference: string, over: Partial<WompiTransaction> = {}): WompiTransaction => ({
    id: `tx-${reference}`,
    reference,
    status: "APPROVED",
    amount_in_cents: 1690000,
    currency: "COP",
    ...over,
  });

  it("un pago aprobado activa el plan y repetirlo no lo extiende de nuevo", async () => {
    const userId = await newUser();
    const { reference } = await createPayment(db, { userId, plan: "pro_monthly", amountInCents: 1690000 }, NOW);

    expect(await applyTransaction(db, tx(reference), NOW)).toBe("applied");
    const ent = await getEntitlement(db, userId, NOW, FREE);
    expect(ent).toMatchObject({ plan: "pro_monthly", daysLeft: 30, features: { ads: false, dailyDownloads: null } });

    // El mismo evento otra vez, o la página de retorno aplicándolo también.
    expect(await applyTransaction(db, tx(reference), new Date(NOW.getTime() + 1000))).toBe("already_applied");
    expect(await applyTransaction(db, tx(reference), new Date(NOW.getTime() + 2000))).toBe("already_applied");
    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, userId));
    expect(sub.currentPeriodEnd.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("aplicaciones simultáneas del mismo pago lo aplican una sola vez", async () => {
    const userId = await newUser();
    const { reference } = await createPayment(db, { userId, plan: "weekly", amountInCents: 790000 }, NOW);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => applyTransaction(db, tx(reference, { amount_in_cents: 790000 }), NOW)),
    );
    expect(results.filter((r) => r === "applied")).toHaveLength(1);
    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, userId));
    expect(sub.currentPeriodEnd.getTime()).toBe(NOW.getTime() + 7 * DAY);
  });

  it("un segundo pago suma su vigencia a la que queda", async () => {
    const userId = await newUser();
    const first = await createPayment(db, { userId, plan: "weekly", amountInCents: 790000 }, NOW);
    await applyTransaction(db, tx(first.reference, { amount_in_cents: 790000 }), NOW);
    const later = new Date(NOW.getTime() + 3 * DAY);
    const second = await createPayment(db, { userId, plan: "pro_yearly", amountInCents: 12900000 }, later);
    expect(await applyTransaction(db, tx(second.reference, { amount_in_cents: 12900000 }), later)).toBe("applied");
    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, userId));
    expect(sub.plan).toBe("pro_yearly");
    expect(sub.currentPeriodStart.getTime()).toBe(NOW.getTime());
    expect(sub.currentPeriodEnd.getTime()).toBe(NOW.getTime() + (7 + 365) * DAY);
  });

  it("después de vencer, el nuevo periodo empieza desde el pago", async () => {
    const userId = await newUser();
    const first = await createPayment(db, { userId, plan: "weekly", amountInCents: 790000 }, NOW);
    await applyTransaction(db, tx(first.reference, { amount_in_cents: 790000 }), NOW);
    const later = new Date(NOW.getTime() + 20 * DAY);
    expect((await getEntitlement(db, userId, later, FREE)).plan).toBe("free");
    const second = await createPayment(db, { userId, plan: "pro_monthly", amountInCents: 1690000 }, later);
    await applyTransaction(db, tx(second.reference), later);
    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, userId));
    expect(sub.currentPeriodStart.getTime()).toBe(later.getTime());
    expect(sub.currentPeriodEnd.getTime()).toBe(later.getTime() + 30 * DAY);
  });

  it("rechazados, montos alterados y referencias ajenas no activan nada", async () => {
    const userId = await newUser();
    const { reference } = await createPayment(db, { userId, plan: "pro_monthly", amountInCents: 1690000 }, NOW);
    expect(await applyTransaction(db, tx(reference, { status: "DECLINED" }), NOW)).toBe("status_updated");
    expect(await applyTransaction(db, tx(reference, { amount_in_cents: 100 }), NOW)).toBe("amount_mismatch");
    expect(await applyTransaction(db, tx(reference, { currency: "USD" }), NOW)).toBe("amount_mismatch");
    expect(await applyTransaction(db, tx("RGL-NO-EXISTE"), NOW)).toBe("unknown_reference");
    expect((await getEntitlement(db, userId, NOW, FREE)).plan).toBe("free");
    const [pay] = await db.select().from(payment).where(eq(payment.reference, reference));
    expect(pay.status).toBe("DECLINED");
    // Un reintento aprobado con la misma referencia sí activa el plan.
    expect(await applyTransaction(db, tx(reference, { id: "tx-reintento" }), NOW)).toBe("applied");
    expect((await getEntitlement(db, userId, NOW, FREE)).plan).toBe("pro_monthly");
  });
});

describe("webhook de Wompi", () => {
  const SECRET = "test_events_prueba";

  function signedEvent(transaction: WompiTransaction, timestamp = 1_790_000_000): WompiEvent {
    const event: WompiEvent = {
      event: "transaction.updated",
      data: { transaction },
      environment: "test",
      signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: "" },
      timestamp,
      sent_at: NOW.toISOString(),
    };
    event.signature.checksum = eventChecksum(event, SECRET);
    return event;
  }

  it("un evento firmado activa el plan; reenviarlo es idempotente", async () => {
    const userId = await newUser();
    const { reference } = await createPayment(db, { userId, plan: "pro_monthly", amountInCents: 1690000 }, NOW);
    const event = signedEvent({ id: "15113-1", reference, status: "APPROVED", amount_in_cents: 1690000, currency: "COP" });
    expect(verifyEvent(event, SECRET)).toBe(true);

    expect(await handleWompiEvent(db, event, NOW)).toEqual({ duplicate: false, result: "applied" });
    expect(await handleWompiEvent(db, event, NOW)).toEqual({ duplicate: true, result: "already_applied" });
    expect(await handleWompiEvent(db, structuredClone(event), NOW)).toEqual({ duplicate: true, result: "already_applied" });

    const events = await db.select().from(paymentEvent).where(eq(paymentEvent.reference, reference));
    expect(events).toHaveLength(1);
    const [sub] = await db.select().from(subscription).where(eq(subscription.userId, userId));
    expect(sub.currentPeriodEnd.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("eventos que no son de transacciones se guardan y se ignoran", async () => {
    const event: WompiEvent = {
      event: "nequi_token.updated",
      data: { token: { id: "nequi_test_1", status: "APPROVED" } },
      signature: { properties: ["token.id", "token.status"], checksum: "" },
      timestamp: 1_790_000_001,
    };
    event.signature.checksum = eventChecksum(event, SECRET);
    expect(await handleWompiEvent(db, event, NOW)).toEqual({ duplicate: false, result: "ignored" });
  });
});

describe("avisos de vencimiento", () => {
  it("lista los planes por vencer una sola vez por periodo", async () => {
    const userId = await newUser();
    const end = new Date(NOW.getTime() + 2 * DAY);
    await db.insert(subscription).values({ userId, plan: "pro_monthly", currentPeriodStart: NOW, currentPeriodEnd: end });
    const due = await subscriptionsToRemind(db, NOW, 3);
    expect(due.map((s) => s.userId)).toContain(userId);
    await db.update(subscription).set({ reminderSentFor: end }).where(eq(subscription.userId, userId));
    expect((await subscriptionsToRemind(db, NOW, 3)).map((s) => s.userId)).not.toContain(userId);
  });
});
