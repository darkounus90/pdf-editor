import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkoutUrl, eventChecksum, integritySignature, verifyEvent, type WompiEvent } from "../lib/server/wompi";

// Evento y secreto de ejemplo de la documentación de Wompi (docs.wompi.co → Eventos).
// La documentación muestra la cadena concatenada del paso 3; el hash que imprime
// en el paso 4 (3476DDA5…) no es el SHA256 de esa cadena, así que el checksum del
// archivo de ejemplo es el SHA256 real de la cadena documentada.
const DOCS_CONCATENATED = "1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";
const DOCS_EVENTS_SECRET = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";
const docsEvent = (): WompiEvent => JSON.parse(readFileSync(new URL("./fixtures/wompi-event-docs.json", import.meta.url), "utf8"));

describe("firma de integridad", () => {
  it("coincide con el ejemplo de la documentación", () => {
    expect(integritySignature("sk8-438k4-xmxm392-sn2m", 2490000, "COP", "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6")).toBe(
      "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5",
    );
  });

  it("incluye la fecha de expiración antes del secreto cuando se envía", () => {
    const sin = integritySignature("ref", 100, "COP", "secreto");
    const con = integritySignature("ref", 100, "COP", "secreto", "2026-10-20T00:00:00.000Z");
    expect(con).not.toBe(sin);
    expect(con).toBe(integritySignature("ref", 100, "COP2026-10-20T00:00:00.000Z", "secreto"));
  });

  it("arma la URL del Web Checkout con todos los parámetros", () => {
    const url = new URL(
      checkoutUrl(
        { publicKey: "pub_test_abc", integritySecret: "test_integrity_x" },
        { reference: "RGL-1", amountInCents: 1690000, redirectUrl: "https://renglonpdf.online/cuenta/pago" },
      ),
    );
    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    expect(url.searchParams.get("public-key")).toBe("pub_test_abc");
    expect(url.searchParams.get("currency")).toBe("COP");
    expect(url.searchParams.get("amount-in-cents")).toBe("1690000");
    expect(url.searchParams.get("reference")).toBe("RGL-1");
    expect(url.searchParams.get("redirect-url")).toBe("https://renglonpdf.online/cuenta/pago");
    expect(url.searchParams.get("signature:integrity")).toBe(integritySignature("RGL-1", 1690000, "COP", "test_integrity_x"));
  });
});

describe("verificación de eventos", () => {
  it("acepta el evento de ejemplo de la documentación", () => {
    const event = docsEvent();
    expect(eventChecksum(event, DOCS_EVENTS_SECRET)).toBe(createHash("sha256").update(DOCS_CONCATENATED).digest("hex"));
    expect(eventChecksum(event, DOCS_EVENTS_SECRET)).toBe(event.signature.checksum.toLowerCase());
    expect(verifyEvent(event, DOCS_EVENTS_SECRET)).toBe(true);
  });

  it("acepta el checksum del encabezado X-Event-Checksum", () => {
    const event = docsEvent();
    const checksum = event.signature.checksum;
    event.signature.checksum = "";
    expect(verifyEvent(event, DOCS_EVENTS_SECRET, checksum)).toBe(true);
  });

  it("rechaza eventos alterados o con otro secreto", () => {
    const tampered = docsEvent();
    tampered.data.transaction!.amount_in_cents = 100;
    expect(verifyEvent(tampered, DOCS_EVENTS_SECRET)).toBe(false);

    const status = docsEvent();
    status.data.transaction!.status = "DECLINED";
    expect(verifyEvent(status, DOCS_EVENTS_SECRET)).toBe(false);

    const time = docsEvent();
    time.timestamp += 1;
    expect(verifyEvent(time, DOCS_EVENTS_SECRET)).toBe(false);

    expect(verifyEvent(docsEvent(), "test_events_otro")).toBe(false);
    expect(verifyEvent(docsEvent(), "")).toBe(false);
  });

  it("rechaza cuerpos mal formados sin lanzar", () => {
    expect(verifyEvent(null, DOCS_EVENTS_SECRET)).toBe(false);
    expect(verifyEvent({}, DOCS_EVENTS_SECRET)).toBe(false);
    expect(verifyEvent({ ...docsEvent(), signature: { properties: "x", checksum: "zz" } }, DOCS_EVENTS_SECRET)).toBe(false);
    expect(verifyEvent({ ...docsEvent(), signature: { properties: [], checksum: "a".repeat(64) } }, DOCS_EVENTS_SECRET)).toBe(false);
  });

  it("usa las propiedades que indique el evento, no una lista fija", () => {
    const event = docsEvent();
    event.signature.properties = ["transaction.reference", "transaction.status"];
    event.signature.checksum = eventChecksum(event, "test_events_s");
    expect(verifyEvent(event, "test_events_s")).toBe(true);
  });
});
