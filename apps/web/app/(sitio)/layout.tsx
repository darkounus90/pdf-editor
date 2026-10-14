import Script from "next/script";
import type { ReactNode } from "react";
import { ADSENSE_CLIENT, adsEnabled } from "../../lib/site";
import { SiteFooter, SiteNav } from "../_components/SiteChrome";

/**
 * Páginas públicas (portada, guías, legales). El script de AdSense solo se carga
 * aquí: el editor queda fuera de este grupo para que ningún script de terceros
 * tenga acceso al documento que se está editando.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="home">
      {adsEnabled() && (
        <Script
          id="adsense"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        />
      )}
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}
