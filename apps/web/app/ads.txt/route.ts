import { ADSENSE_CLIENT, adsEnabled } from "../../lib/site";

// ads.txt declara quién puede vender anuncios en el dominio. Sin AdSense configurado, no existe.
export const dynamic = "force-static";

export function GET() {
  if (!adsEnabled()) return new Response("Not found", { status: 404 });
  const publisher = ADSENSE_CLIENT.replace(/^ca-/, "");
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
