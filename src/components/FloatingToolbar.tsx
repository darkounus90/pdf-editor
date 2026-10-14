import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { FAMILY_LABEL, hexToRgb, rgbToHex } from "../pdf/fonts";
import { useEditor } from "../state/context";
import type { Family, TextObject } from "../types";

interface Props {
  obj: TextObject;
  anchor: { left: number; top: number; width: number; height: number };
  pageHeight: number;
  onGrip: (e: ReactPointerEvent) => void;
}

/** Barra contextual sobre el texto seleccionado: mover, fuente, tamaño, estilo, color y borrar. */
export function FloatingToolbar({ obj, anchor, pageHeight, onGrip }: Props) {
  const api = useEditor();
  const above = anchor.top > 52;
  const top = above ? anchor.top - 46 : Math.min(anchor.top + anchor.height + 8, pageHeight - 40);
  const size = Math.round(obj.fontSize * 10) / 10;

  // Mantiene el foco en el campo de texto al usar la barra.
  const keepFocus = (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) e.preventDefault();
  };

  return (
    <div className="ftb" style={{ left: anchor.left, top }} onPointerDown={keepFocus}>
      <button
        className="ftb-btn ftb-grip"
        title="Arrastrar para mover"
        onPointerDown={(e) => {
          e.stopPropagation();
          onGrip(e);
        }}
      >
        <Icon>
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </Icon>
      </button>
      <span className="ftb-sep" />
      <select
        className="ftb-select"
        value={obj.family}
        title="Fuente"
        onChange={(e) => api.update(obj, { family: e.target.value as Family })}
      >
        {(Object.keys(FAMILY_LABEL) as Family[]).map((f) => (
          <option key={f} value={f}>
            {FAMILY_LABEL[f]}
          </option>
        ))}
      </select>
      <button className="ftb-btn" title="Reducir tamaño" onClick={() => api.update(obj, { fontSize: Math.max(4, size - 1) })}>
        −
      </button>
      <input
        className="ftb-size"
        type="number"
        min={4}
        max={200}
        step={0.5}
        value={size}
        title="Tamaño (pt)"
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (v >= 4 && v <= 200) api.update(obj, { fontSize: v });
        }}
      />
      <button className="ftb-btn" title="Aumentar tamaño" onClick={() => api.update(obj, { fontSize: Math.min(200, size + 1) })}>
        +
      </button>
      <span className="ftb-sep" />
      <button
        className={`ftb-btn ${obj.bold ? "on" : ""}`}
        title="Negrita"
        style={{ fontWeight: 700 }}
        onClick={() => api.update(obj, { bold: !obj.bold })}
      >
        B
      </button>
      <button
        className={`ftb-btn ${obj.italic ? "on" : ""}`}
        title="Cursiva"
        style={{ fontStyle: "italic", fontFamily: "Georgia, serif" }}
        onClick={() => api.update(obj, { italic: !obj.italic })}
      >
        I
      </button>
      <label className="ftb-color" title="Color del texto" style={{ background: rgbToHex(obj.color) }}>
        <input type="color" value={rgbToHex(obj.color)} onChange={(e) => api.update(obj, { color: hexToRgb(e.target.value) })} />
      </label>
      <span className="ftb-sep" />
      {obj.kind === "block" && obj.modified && (
        <button className="ftb-btn" title="Restaurar original" onClick={() => api.restore(obj.id)}>
          <Icon>
            <path d="M3 12a9 9 0 1 0 3-6.7" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" />
            <path d="M3 4v5h5" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          </Icon>
        </button>
      )}
      <button className="ftb-btn danger" title="Eliminar texto" onClick={() => api.remove(obj)}>
        <Icon>
          <path
            d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Icon>
      </button>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {children}
    </svg>
  );
}
