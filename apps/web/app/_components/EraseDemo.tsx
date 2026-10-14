"use client";

import { useState } from "react";

type Mode = "cover" | "erase";

/**
 * Muestra la diferencia entre tapar un texto con un parche blanco y borrarlo
 * del archivo: qué capas quedan y qué obtiene quien copie el texto del PDF.
 */
export function EraseDemo() {
  const [mode, setMode] = useState<Mode>("erase");

  return (
    <div className={`edemo mode-${mode}`}>
      <div className="edemo-switch" role="radiogroup" aria-label="Cómo se cambia el texto">
        <span className="thumb" aria-hidden />
        <button type="button" role="radio" aria-checked={mode === "cover"} onClick={() => setMode("cover")}>
          Tapar con un parche
        </button>
        <button type="button" role="radio" aria-checked={mode === "erase"} onClick={() => setMode("erase")}>
          Borrar (Renglón)
        </button>
      </div>

      <div className="edemo-stack" aria-hidden>
        <div className="layer layer-new">
          <span className="layer-tag">Texto nuevo</span>
          <span className="layer-text">TOTAL: $ 8.350.000</span>
        </div>
        <div className="layer layer-patch">
          <span className="layer-tag">Parche blanco</span>
        </div>
        <div className="layer layer-old">
          <span className="layer-tag">Texto original</span>
          <span className="layer-text">
            TOTAL: $ 7.950.000
            <svg className="layer-strike" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M2 6 C 30 3, 70 8, 98 4" pathLength={1} />
            </svg>
          </span>
        </div>
      </div>

      <div className="edemo-copy">
        <span>Si alguien selecciona y copia ese renglón del PDF, obtiene:</span>
        <code aria-live="polite">
          {mode === "cover" ? (
            <>
              <b className="leak">TOTAL: $ 7.950.000</b> TOTAL: $ 8.350.000
            </>
          ) : (
            "TOTAL: $ 8.350.000"
          )}
        </code>
        <p>
          {mode === "cover"
            ? "El valor viejo sigue escondido debajo del parche: cualquiera puede recuperarlo."
            : "El texto original se elimina del archivo. Solo queda lo que tú escribiste."}
        </p>
      </div>
    </div>
  );
}
