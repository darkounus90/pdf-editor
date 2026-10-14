import { ADSENSE_CLIENT, ADSENSE_SLOT, ADS_PREVIEW, adsEnabled } from "../../lib/site";
import { AdSlot } from "./AdSlot";

/**
 * Espacio publicitario de las páginas públicas. No renderiza nada mientras
 * AdSense no esté configurado; con ADS_PREVIEW=1 muestra un recuadro de prueba.
 */
export function Ad() {
  if (ADS_PREVIEW) {
    return (
      <aside className="ad" aria-label="Publicidad">
        <span className="ad-label">Publicidad</span>
        <div className="ad-preview">Espacio de anuncio</div>
      </aside>
    );
  }
  if (!adsEnabled() || !ADSENSE_SLOT) return null;
  return (
    <aside className="ad" aria-label="Publicidad">
      <span className="ad-label">Publicidad</span>
      <AdSlot client={ADSENSE_CLIENT} slot={ADSENSE_SLOT} />
    </aside>
  );
}
