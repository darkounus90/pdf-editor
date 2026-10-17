/**
 * Integración con Wompi (Colombia): firma de integridad del Web Checkout,
 * verificación de eventos y consulta de transacciones.
 *
 * Referencias (docs.wompi.co):
 * - Web Checkout: GET https://checkout.wompi.co/p/ con public-key, currency,
 *   amount-in-cents, reference, signature:integrity y redirect-url. Al volver,
 *   Wompi agrega `?id=<transacción>` a redirect-url.
 * - Firma de integridad: SHA256 hex de «referencia + monto en centavos + moneda
 *   [+ fecha de expiración] + secreto de integridad».
 * - Eventos: SHA256 de los valores de `signature.properties` (rutas dentro de
 *   `data`) concatenados, más `timestamp`, más el secreto de eventos; se compara
 *   con `signature.checksum` (también llega en el encabezado X-Event-Checksum).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { WompiConfig } from "./config";

export const CHECKOUT_URL = "https://checkout.wompi.co/p/";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export function integritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  integritySecret: string,
  expirationTime?: string,
): string {
  return sha256(`${reference}${amountInCents}${currency}${expirationTime ?? ""}${integritySecret}`);
}

export interface CheckoutParams {
  reference: string;
  amountInCents: number;
  currency?: string;
  redirectUrl?: string;
  expirationTime?: string;
}

/** URL del Web Checkout de Wompi con la firma de integridad. */
export function checkoutUrl(config: Pick<WompiConfig, "publicKey" | "integritySecret">, p: CheckoutParams): string {
  const currency = p.currency ?? "COP";
  const params = new URLSearchParams({
    "public-key": config.publicKey,
    currency,
    "amount-in-cents": String(p.amountInCents),
    reference: p.reference,
    "signature:integrity": integritySignature(p.reference, p.amountInCents, currency, config.integritySecret, p.expirationTime),
  });
  if (p.redirectUrl) params.set("redirect-url", p.redirectUrl);
  if (p.expirationTime) params.set("expiration-time", p.expirationTime);
  return `${CHECKOUT_URL}?${params}`;
}

// ---------- Eventos ----------

export type WompiStatus = "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";

export interface WompiTransaction {
  id: string;
  reference: string;
  status: WompiStatus | string;
  amount_in_cents: number;
  currency: string;
  customer_email?: string;
  payment_method_type?: string;
  [key: string]: unknown;
}

export interface WompiEvent {
  event: string;
  data: { transaction?: WompiTransaction; [key: string]: unknown };
  environment?: string;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at?: string;
}

/** Lee una ruta como «transaction.amount_in_cents» dentro de `data`. */
function readPath(data: unknown, path: string): unknown {
  let cur: unknown = data;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function eventChecksum(event: Pick<WompiEvent, "data" | "signature" | "timestamp">, eventsSecret: string): string {
  const values = event.signature.properties.map((p) => {
    const v = readPath(event.data, p);
    return v === undefined || v === null ? "" : String(v);
  });
  return sha256(`${values.join("")}${event.timestamp}${eventsSecret}`);
}

/** true si el evento lo firmó Wompi con este secreto. No lanza excepciones. */
export function verifyEvent(event: unknown, eventsSecret: string, headerChecksum?: string | null): event is WompiEvent {
  if (!event || typeof event !== "object" || !eventsSecret) return false;
  const e = event as Partial<WompiEvent>;
  const props = e.signature?.properties;
  const received = (e.signature?.checksum || headerChecksum || "").toLowerCase();
  if (!Array.isArray(props) || !props.length || !props.every((p) => typeof p === "string")) return false;
  if (typeof e.timestamp !== "number" && typeof e.timestamp !== "string") return false;
  if (!/^[0-9a-f]{64}$/.test(received)) return false;
  const expected = eventChecksum(e as WompiEvent, eventsSecret);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

// ---------- API ----------

/** Consulta una transacción en la API de Wompi (desde el servidor). */
export async function fetchTransaction(config: WompiConfig, id: string): Promise<WompiTransaction | null> {
  if (!/^[\w-]{1,80}$/.test(id)) return null;
  const res = await fetch(`${config.apiUrl}/transactions/${encodeURIComponent(id)}`, {
    headers: config.privateKey ? { Authorization: `Bearer ${config.privateKey}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: WompiTransaction };
  return body.data ?? null;
}
