import { ADSENSE_CLIENT, ADSENSE_SLOT, ADS_PREVIEW, adsEnabled } from "../../lib/site";
import { AdSlot } from "./AdSlot";
import { AdGate } from "./PlanProvider";

/**
 * Espacio publicitario de las páginas públicas. No renderiza nada mientras
 * AdSense no esté configurado; con ADS_PREVIEW=1 muestra un recuadro de prueba.
 * Los usuarios con un plan pago no ven anuncios (AdGate).
 */
export function Ad() {
  if (ADS_PREVIEW) {
    return (
      <AdGate>
        <aside className="ad" aria-label="Publicidad">
          <span className="ad-label">Publicidad</span>
          <div className="ad-preview">Espacio de anuncio</div>
        </aside>
      </AdGate>
    );
  }
  if (!adsEnabled() || !ADSENSE_SLOT) return null;
  return (
    <AdGate>
      <aside className="ad" aria-label="Publicidad">
        <span className="ad-label">Publicidad</span>
        <AdSlot client={ADSENSE_CLIENT} slot={ADSENSE_SLOT} />
      </aside>
    </AdGate>
  );
}
