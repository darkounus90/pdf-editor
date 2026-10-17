"use client";

import Script from "next/script";
import { createContext, useContext, type ReactNode } from "react";
import { useFeatures, type FeaturesResponse } from "../../lib/use-features";

interface PlanState {
  data: FeaturesResponse | null;
  /** true cuando ya se sabe el plan (o falló la consulta y se asume el gratis). */
  ready: boolean;
  showAds: boolean;
}

const PlanContext = createContext<PlanState>({ data: null, ready: false, showAds: false });

export const usePlan = () => useContext(PlanContext);

/**
 * Consulta el plan una vez por página. Los anuncios (y el script de AdSense)
 * solo se cargan cuando el plan los incluye: los usuarios Pro no los ven.
 */
export function PlanProvider({ adsenseClient, children }: { adsenseClient: string | null; children: ReactNode }) {
  const { data, failed } = useFeatures(false);
  const ready = !!data || failed;
  const showAds = ready && (data ? data.features.ads : true);
  return (
    <PlanContext.Provider value={{ data, ready, showAds }}>
      {adsenseClient && showAds && (
        <Script
          id="adsense"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
        />
      )}
      {children}
    </PlanContext.Provider>
  );
}

/** Muestra su contenido solo a quien tiene anuncios en su plan. */
export function AdGate({ children }: { children: ReactNode }) {
  return usePlan().showAds ? <>{children}</> : null;
}

/** Enlace de la barra: «Ingresar» o «Mi cuenta». */
export function AccountLink() {
  const { data, ready } = usePlan();
  if (!ready) return <span className="nav-account" aria-hidden />;
  return data?.user ? (
    <a href="/cuenta" className="nav-account">
      Mi cuenta
    </a>
  ) : (
    <a href="/ingresar" className="nav-account">
      Ingresar
    </a>
  );
}
