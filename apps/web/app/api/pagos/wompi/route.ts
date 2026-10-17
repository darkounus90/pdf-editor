import { handleWompiEvent } from "../../../../lib/server/billing";
import { wompiConfig } from "../../../../lib/server/config";
import { getDb } from "../../../../lib/server/db";
import { verifyEvent } from "../../../../lib/server/wompi";

/**
 * URL de eventos de Wompi (se configura en el panel de comercios).
 * Verifica el checksum y aplica el estado de la transacción a su pago; aplicar
 * dos veces el mismo pago no extiende el plan dos veces. Wompi reintenta
 * mientras la respuesta no sea 200, así que los errores internos responden 500.
 */
export async function POST(req: Request) {
  const wompi = wompiConfig();
  if (!wompi) return Response.json({ error: "Wompi no está configurado." }, { status: 503 });

  const event = await req.json().catch(() => null);
  if (!verifyEvent(event, wompi.eventsSecret, req.headers.get("x-event-checksum"))) {
    console.warn("[wompi] evento con firma inválida descartado");
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }

  try {
    const { duplicate, result } = await handleWompiEvent(await getDb(), event, new Date());
    const tx = event.data.transaction;
    console.info(`[wompi] ${event.event} ${tx?.reference ?? "-"} ${tx?.status ?? "-"} → ${result}${duplicate ? " (repetido)" : ""}`);
    if (result === "amount_mismatch" || result === "unknown_reference") {
      console.warn(`[wompi] revisar transacción ${tx?.id}: ${result}`);
    }
    return Response.json({ ok: true, result });
  } catch (err) {
    console.error("[wompi] error procesando el evento", err);
    return Response.json({ error: "Error interno." }, { status: 500 });
  }
}
