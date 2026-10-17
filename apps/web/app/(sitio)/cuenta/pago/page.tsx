import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { formatDate, PLANS, type PlanId } from "../../../../lib/plans";
import { currentUser } from "../../../../lib/server/auth";
import { applyTransaction, getEntitlement } from "../../../../lib/server/billing";
import { freeLimits, wompiConfig } from "../../../../lib/server/config";
import { getDb } from "../../../../lib/server/db";
import { payment } from "../../../../lib/server/db/schema";
import { fetchTransaction } from "../../../../lib/server/wompi";

export const metadata: Metadata = { title: "Resultado del pago", robots: { index: false } };

/**
 * Wompi redirige aquí con ?id=<transacción>. El estado se consulta en la API de
 * Wompi desde el servidor (no se confía en la URL) y se aplica igual que el
 * webhook, de forma idempotente, por si el evento aún no ha llegado.
 */
export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(`/cuenta/pago${id ? `?id=${id}` : ""}`)}`);
  if (!id) redirect("/cuenta");

  const wompi = wompiConfig();
  const tx = wompi ? await fetchTransaction(wompi, id).catch(() => null) : null;
  const db = await getDb();
  const [pay] = tx ? await db.select().from(payment).where(eq(payment.reference, tx.reference)).limit(1) : [];
  const own = !!pay && pay.userId === user.id;
  if (tx && own) await applyTransaction(db, tx, new Date());
  const ent = await getEntitlement(db, user.id, new Date(), freeLimits());
  const planName = pay ? (PLANS[pay.plan as PlanId]?.name ?? pay.plan) : "plan";

  let title: string;
  let body: string;
  let tone: "ok" | "wait" | "error";
  if (!tx || !own) {
    tone = "error";
    title = "No encontramos ese pago";
    body = "Si Wompi te cobró, el plan se activará en unos minutos, cuando recibamos la confirmación. Si no aparece, escríbenos.";
  } else if (tx.status === "APPROVED") {
    tone = "ok";
    title = `¡Listo! Tu ${planName} está activo`;
    body = ent.expiresAt
      ? `Ya puedes descargar sin límites y sin anuncios hasta el ${formatDate(ent.expiresAt)}.`
      : "Ya puedes descargar sin límites y sin anuncios.";
  } else if (tx.status === "PENDING") {
    tone = "wait";
    title = "Tu pago está en proceso";
    body = "Wompi aún no confirma el pago (suele pasar con PSE o Nequi). Activaremos el plan apenas llegue la confirmación.";
  } else {
    tone = "error";
    title = "El pago no se completó";
    body = "Wompi rechazó o anuló la transacción. Puedes intentarlo de nuevo con otro medio de pago.";
  }

  return (
    <main className="auth-page">
      <div className={`auth-card result ${tone}`}>
        <h1>{title}</h1>
        <p className="auth-sub">{body}</p>
        {tx && own && (
          <p className="muted small">
            Referencia {tx.reference} · Transacción {tx.id}
          </p>
        )}
        <div className="row-actions">
          {tone === "ok" && (
            <a className="btn primary lg" href="/editar-pdf">
              Abrir el editor
            </a>
          )}
          {tone === "wait" && (
            <a className="btn primary lg" href={`/cuenta/pago?id=${encodeURIComponent(id)}`}>
              Volver a consultar
            </a>
          )}
          {tone === "error" && (
            <a className="btn primary lg" href="/precios">
              Volver a precios
            </a>
          )}
          <a className="btn lg" href="/cuenta">
            Mi cuenta
          </a>
        </div>
      </div>
    </main>
  );
}
