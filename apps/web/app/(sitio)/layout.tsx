import type { ReactNode } from "react";
import { ADSENSE_CLIENT, adsEnabled } from "../../lib/site";
import { PlanProvider } from "../_components/PlanProvider";
import { SiteFooter, SiteNav } from "../_components/SiteChrome";

/**
 * Páginas públicas (portada, guías, legales, precios y cuenta). El script de
 * AdSense solo se carga aquí, y solo para quien no tiene un plan pago: el editor
 * queda fuera de este grupo para que ningún script de terceros tenga acceso al
 * documento que se está editando.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="home">
      <PlanProvider adsenseClient={adsEnabled() ? ADSENSE_CLIENT : null}>
        <SiteNav />
        {children}
        <SiteFooter />
      </PlanProvider>
    </div>
  );
}
