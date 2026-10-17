"use client";

import { useState } from "react";
import type { PaidPlanId } from "../../../lib/plans";

/**
 * Crea el pago en el servidor y lleva al Web Checkout de Wompi. Sin sesión,
 * manda primero a crear la cuenta y luego vuelve a precios.
 */
export function BuyButton({
  plan,
  label,
  loggedIn,
  available,
  primary,
}: {
  plan: PaidPlanId;
  label: string;
  loggedIn: boolean;
  available: boolean;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cls = `btn lg block ${primary ? "primary" : ""}`;

  if (!available) {
    return (
      <button className={cls} disabled title="Los pagos aún no están disponibles">
        Próximamente
      </button>
    );
  }
  if (!loggedIn) {
    return (
      <a className={cls} href={`/registro?next=${encodeURIComponent(`/precios#${plan}`)}`}>
        {label}
      </a>
    );
  }

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pagos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "No se pudo iniciar el pago.");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setBusy(false);
    }
  };

  return (
    <>
      <button className={cls} onClick={buy} disabled={busy}>
        {busy ? "Abriendo Wompi…" : label}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
