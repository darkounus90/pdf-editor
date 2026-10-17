/**
 * Configuración del servidor que se lee en tiempo de ejecución (deploy/.env en
 * el VPS). Nada de este archivo debe llegar al navegador.
 */
import { PAID_PLANS, type FreeLimits, type PaidPlanId } from "../plans";

const int = (name: string, fallback: number) => {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** URL pública del sitio (sin barra final). */
export const appUrl = () => (process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "");

export const freeLimits = (): FreeLimits => ({
  dailyDownloads: int("FREE_DAILY_DOWNLOADS", 3),
  dailyPages: int("FREE_DAILY_PAGES", 60),
});

const DEFAULT_PRICES: Record<PaidPlanId, number> = { weekly: 7900, pro_monthly: 16900, pro_yearly: 129000 };
const PRICE_ENV: Record<PaidPlanId, string> = {
  weekly: "PRICE_WEEKLY_COP",
  pro_monthly: "PRICE_PRO_MONTHLY_COP",
  pro_yearly: "PRICE_PRO_YEARLY_COP",
};

/** Precios en pesos colombianos (enteros, sin centavos). */
export function prices(): Record<PaidPlanId, number> {
  return Object.fromEntries(PAID_PLANS.map((p) => [p, int(PRICE_ENV[p], DEFAULT_PRICES[p])])) as Record<PaidPlanId, number>;
}

export interface WompiConfig {
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
  apiUrl: string;
  sandbox: boolean;
}

/** Llaves de Wompi; null si faltan (los botones de compra quedan desactivados). */
export function wompiConfig(): WompiConfig | null {
  const publicKey = process.env.WOMPI_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.WOMPI_PRIVATE_KEY?.trim() ?? "";
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET?.trim() ?? "";
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET?.trim() ?? "";
  if (!publicKey || !integritySecret || !eventsSecret) return null;
  const sandbox = publicKey.startsWith("pub_test_");
  return {
    publicKey,
    privateKey,
    integritySecret,
    eventsSecret,
    sandbox,
    apiUrl: process.env.WOMPI_API_URL?.trim() || (sandbox ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1"),
  };
}
