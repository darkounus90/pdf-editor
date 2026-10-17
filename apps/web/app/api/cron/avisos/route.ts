import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { entitlementFrom, formatDate, PLANS } from "../../../../lib/plans";
import { markReminded, subscriptionsToRemind } from "../../../../lib/server/billing";
import { appUrl, freeLimits } from "../../../../lib/server/config";
import { getDb } from "../../../../lib/server/db";
import { user } from "../../../../lib/server/db/schema";
import { actionMail, emailEnabled, sendMail } from "../../../../lib/server/email";

/**
 * Avisos por correo de planes por vencer. Lo llama el cron diario del VPS:
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://renglonpdf.online/api/cron/avisos
 * Cada vigencia se avisa una sola vez. Sin SMTP no envía nada (el aviso igual
 * aparece en «Mi cuenta» y en el editor).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!emailEnabled()) return Response.json({ sent: 0, skipped: "sin SMTP_URL" });

  const db = await getDb();
  const now = new Date();
  const maxDays = Math.max(...Object.values(PLANS).map((p) => p.reminderDays));
  let sent = 0;
  for (const sub of await subscriptionsToRemind(db, now, maxDays)) {
    const ent = entitlementFrom(sub, now, freeLimits());
    if (!ent.expiringSoon || !ent.expiresAt) continue;
    const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, sub.userId)).limit(1);
    if (!u) continue;
    try {
      await sendMail(
        actionMail(
          u.email,
          `Tu ${ent.planName} de Renglón vence pronto`,
          `Tu ${ent.planName} vence el ${formatDate(ent.expiresAt)}. Después volverás al plan gratis, con anuncios y descargas limitadas.`,
          "Renovar ahora",
          `${appUrl()}/precios`,
          "Si renuevas antes de que venza, el tiempo nuevo se suma al que te queda.",
        ),
      );
      await markReminded(db, sub.userId, sub.currentPeriodEnd);
      sent++;
    } catch (err) {
      console.error(`[avisos] no se pudo avisar a ${sub.userId}`, err);
    }
  }
  return Response.json({ sent });
}
