import { requestAccount } from "../../../../lib/server/account";
import { recordDownload } from "../../../../lib/server/billing";
import { getDb } from "../../../../lib/server/db";

/**
 * Registra una descarga antes de generar el PDF y aplica los límites del plan
 * gratis. Body: { "pages": número de páginas del documento }.
 * 200 → se puede descargar; 429 → se alcanzó el límite del día.
 */
export async function POST(req: Request) {
  // Exigir JSON obliga a los navegadores a hacer preflight CORS en peticiones de
  // otros sitios, que este endpoint no acepta.
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Se esperaba JSON." }, { status: 415 });
  }
  const body = (await req.json().catch(() => null)) as { pages?: unknown } | null;
  const pages = Number(body?.pages);
  if (!Number.isInteger(pages) || pages < 1 || pages > 10_000) {
    return Response.json({ error: "Número de páginas inválido." }, { status: 400 });
  }

  const now = new Date();
  const { user, entitlement, subject } = await requestAccount(req.headers, now);
  const { features } = entitlement;
  const paid = entitlement.plan !== "free";
  const result = await recordDownload(await getDb(), subject, pages, paid ? null : features, now);
  const base = { plan: entitlement.plan, limits: { dailyDownloads: features.dailyDownloads, dailyPages: features.dailyPages }, usage: result.usage };

  if (result.allowed) return Response.json({ allowed: true, ...base });

  const message =
    result.reason === "downloads"
      ? `Llegaste al límite gratis de ${features.dailyDownloads} descargas por día.`
      : `El plan gratis permite descargar hasta ${features.dailyPages} páginas por día.`;
  return Response.json(
    {
      allowed: false,
      reason: result.reason,
      message: `${message} ${user ? "Pásate a Pro para descargar sin límites." : "Crea una cuenta y pásate a Pro para descargar sin límites."}`,
      ...base,
    },
    { status: 429 },
  );
}
