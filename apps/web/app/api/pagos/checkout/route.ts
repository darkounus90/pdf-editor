import { isPaidPlan } from "../../../../lib/plans";
import { currentUser } from "../../../../lib/server/auth";
import { createPayment } from "../../../../lib/server/billing";
import { appUrl, prices, wompiConfig } from "../../../../lib/server/config";
import { getDb } from "../../../../lib/server/db";
import { checkoutUrl } from "../../../../lib/server/wompi";

/**
 * Página a la que Wompi devuelve al cliente. El firewall de Wompi rechaza (403)
 * el checkout si la URL apunta a localhost o 127.0.0.1; en ese caso se omite y
 * Wompi muestra su propio resultado. En desarrollo se puede usar
 * http://renglon.localhost:5173 (BETTER_AUTH_URL), que sí acepta.
 */
function returnUrl(): string | undefined {
  const url = `${appUrl()}/cuenta/pago`;
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) ? undefined : url;
}

/**
 * Crea un pago pendiente y devuelve la URL del Web Checkout de Wompi, firmada
 * con el secreto de integridad. Body: { "plan": "weekly" | "pro_monthly" | "pro_yearly" }.
 */
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Se esperaba JSON." }, { status: 415 });
  }
  const user = await currentUser(req.headers);
  if (!user) return Response.json({ error: "Inicia sesión para comprar un plan." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { plan?: unknown } | null;
  if (!isPaidPlan(body?.plan)) return Response.json({ error: "Plan inválido." }, { status: 400 });

  const wompi = wompiConfig();
  if (!wompi) return Response.json({ error: "Los pagos aún no están disponibles." }, { status: 503 });

  const plan = body.plan;
  const amountInCents = prices()[plan] * 100;
  const now = new Date();
  const { reference } = await createPayment(await getDb(), { userId: user.id, plan, amountInCents }, now);
  const url = checkoutUrl(wompi, {
    reference,
    amountInCents,
    redirectUrl: returnUrl(),
    // El enlace de pago vale una hora; después hay que volver a precios.
    expirationTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  });
  return Response.json({ url, reference });
}
