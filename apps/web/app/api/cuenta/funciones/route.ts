import { featuresResponse } from "../../../../lib/server/account";

/**
 * Funciones habilitadas para quien pregunta: plan, vigencia, anuncios y límites.
 * Con ?uso=1 incluye además las descargas y páginas que lleva hoy.
 */
export async function GET(req: Request) {
  const withUsage = new URL(req.url).searchParams.has("uso");
  const body = await featuresResponse(req.headers, withUsage);
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
