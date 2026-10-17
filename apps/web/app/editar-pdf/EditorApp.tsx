"use client";

import { PdfEditor, type DownloadGate } from "@pdf-editor/editor-ui";
import { Crown, UserRound } from "lucide-react";
import { useFeatures, type FeaturesResponse } from "../../lib/use-features";

/** Pide permiso al servidor para descargar y registra el uso del día. */
async function checkDownload(pages: number): Promise<DownloadGate> {
  try {
    const res = await fetch("/api/uso/descarga", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages }),
    });
    if (res.status === 429) {
      const body = (await res.json()) as { message?: string; reason?: string };
      return {
        ok: false,
        title: body.reason === "pages" ? "Llegaste al límite de páginas de hoy" : "Llegaste al límite de descargas de hoy",
        message: body.message ?? "El plan gratis tiene un límite diario.",
        actionLabel: "Ver planes Pro",
        actionHref: "/precios",
      };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true };
  } catch (err) {
    // Si el servidor de cuentas falla, no se bloquea la edición: el documento
    // nunca sale del navegador y el límite es solo del plan gratis.
    console.warn("No se pudo validar el límite de descargas", err);
    return { ok: true };
  }
}

function PlanChip({ data }: { data: FeaturesResponse | null }) {
  if (!data) return null;
  if (data.plan !== "free") {
    return (
      <a className={`topbar-chip ${data.expiringSoon ? "warn" : "pro"}`} href="/cuenta" title={`${data.planName} · Mi cuenta`}>
        <Crown size={14} aria-hidden />
        {data.expiringSoon ? `Vence en ${data.daysLeft} ${data.daysLeft === 1 ? "día" : "días"}` : "Pro"}
      </a>
    );
  }
  const max = data.features.dailyDownloads;
  const left = max === null ? null : Math.max(0, max - (data.usage?.downloads ?? 0));
  return (
    <>
      {left !== null && (
        <a className={`topbar-chip ${left === 0 ? "warn" : ""}`} href="/precios" title="Descargas gratis que te quedan hoy. Con Pro no hay límite.">
          Quedan {left}
          <span className="chip-long">&nbsp;de {max} descargas hoy</span>
          <span className="chip-extra">· Pro</span>
        </a>
      )}
      <a className="topbar-chip chip-extra" href={data.user ? "/cuenta" : "/ingresar?next=/editar-pdf"} title={data.user ? "Mi cuenta" : "Ingresar"}>
        <UserRound size={14} aria-hidden />
        <span className="chip-long">{data.user ? "Mi cuenta" : "Ingresar"}</span>
      </a>
    </>
  );
}

export default function EditorApp() {
  // /editar-pdf?ejemplo abre directamente el PDF de muestra (enlace de la portada).
  const autoLoadSample = new URLSearchParams(window.location.search).has("ejemplo");
  const { data, refresh } = useFeatures(true);
  return (
    <PdfEditor
      assetsUrl="/pdfjs/"
      sampleUrl="/ejemplo.pdf"
      autoLoadSample={autoLoadSample}
      homeHref="/"
      beforeDownload={async ({ pages }) => {
        const gate = await checkDownload(pages);
        refresh();
        return gate;
      }}
      topbarExtra={<PlanChip data={data} />}
    />
  );
}
