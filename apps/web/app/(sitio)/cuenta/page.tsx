import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { formatCop, formatDate, PLANS, type PlanId } from "../../../lib/plans";
import { currentUser } from "../../../lib/server/auth";
import { getEntitlement, getUsage, usageSubject } from "../../../lib/server/billing";
import { freeLimits } from "../../../lib/server/config";
import { getDb } from "../../../lib/server/db";
import { account, payment } from "../../../lib/server/db/schema";
import { DeleteAccount, SignOutButton } from "../../_components/account/AuthForms";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

const STATUS: Record<string, string> = {
  APPROVED: "Aprobado",
  PENDING: "Pendiente",
  DECLINED: "Rechazado",
  VOIDED: "Anulado",
  ERROR: "Con error",
};

/** Un pago pendiente de hace más de una hora es un checkout que no se terminó. */
function PaymentStatus({ status, createdAt, now }: { status: string; createdAt: Date; now: Date }) {
  const abandoned = status === "PENDING" && now.getTime() - createdAt.getTime() > 60 * 60 * 1000;
  return (
    <span className={`status s-${abandoned ? "abandoned" : status.toLowerCase()}`}>
      {abandoned ? "Sin completar" : (STATUS[status] ?? status)}
    </span>
  );
}

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/ingresar?next=/cuenta");

  const db = await getDb();
  const now = new Date();
  const free = freeLimits();
  const [ent, usage, payments, credential] = await Promise.all([
    getEntitlement(db, user.id, now, free),
    getUsage(db, usageSubject(user.id, "", ""), now),
    db.select().from(payment).where(eq(payment.userId, user.id)).orderBy(desc(payment.createdAt)).limit(10),
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.providerId, "credential")))
      .limit(1),
  ]);
  const paid = ent.plan !== "free";

  return (
    <main className="page-wrap account">
      <header className="page-head">
        <h1>Mi cuenta</h1>
        <p>
          {user.name} · {user.email}
        </p>
      </header>

      {ent.expiringSoon && ent.expiresAt && (
        <div className="banner warn" role="status">
          <div>
            <strong>
              Tu {ent.planName} vence {ent.daysLeft === 1 ? "mañana" : `en ${ent.daysLeft} días`}.
            </strong>
            <span>Renueva antes del {formatDate(ent.expiresAt)} y el tiempo nuevo se suma al que te queda.</span>
          </div>
          <a className="btn primary" href="/precios">
            Renovar
          </a>
        </div>
      )}

      <div className="account-grid">
        <section className="card">
          <span className="card-kicker">Tu plan</span>
          <h2>
            {ent.planName}
            {paid && <span className="badge">Sin anuncios</span>}
          </h2>
          {paid && ent.expiresAt ? (
            <p>
              Vigente hasta el <strong>{formatDate(ent.expiresAt)}</strong> ({ent.daysLeft} {ent.daysLeft === 1 ? "día" : "días"}).
              Descargas sin límite y sin anuncios. El plan no se renueva solo: te avisaremos antes de que venza.
            </p>
          ) : (
            <p>
              Hoy llevas{" "}
              <strong>
                {usage.downloads} de {free.dailyDownloads}
              </strong>{" "}
              descargas
              {free.dailyPages > 0 && (
                <>
                  {" "}
                  y{" "}
                  <strong>
                    {usage.pages} de {free.dailyPages}
                  </strong>{" "}
                  páginas
                </>
              )}
              . El contador se reinicia a medianoche (hora de Colombia).
            </p>
          )}
          <a className={`btn lg ${paid ? "" : "primary"}`} href="/precios">
            {paid ? "Extender mi plan" : "Pasarme a Pro"}
          </a>
        </section>

        <section className="card">
          <span className="card-kicker">Pagos</span>
          {payments.length ? (
            <div className="table-scroll">
              <table className="payments">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Plan</th>
                    <th>Valor</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.reference}>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>{PLANS[p.plan as PlanId]?.name ?? p.plan}</td>
                      <td>{formatCop(p.amountInCents / 100)}</td>
                      <td>
                        <PaymentStatus status={p.status} createdAt={p.createdAt} now={now} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Aún no tienes pagos. Los pagos se hacen con Wompi y aparecen aquí.</p>
          )}
        </section>
      </div>

      <section className="account-actions">
        <SignOutButton />
        <DeleteAccount hasPassword={credential.length > 0} />
      </section>
    </main>
  );
}
