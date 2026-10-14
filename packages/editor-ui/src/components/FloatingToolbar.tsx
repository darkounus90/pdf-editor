import type { PointerEvent as ReactPointerEvent } from "react";
import { Bold, GripVertical, Italic, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { FAMILY_LABEL, hexToRgb, rgbToHex, type Family, type TextObject } from "@pdf-editor/pdf-core";
import { useEditor } from "../context";

interface Props {
  obj: TextObject;
  anchor: { left: number; top: number; width: number; height: number };
  pageHeight: number;
  onGrip: (e: ReactPointerEvent) => void;
}

/** Barra contextual sobre el texto seleccionado: mover, fuente, tamaño, estilo, color y borrar. */
export function FloatingToolbar({ obj, anchor, pageHeight, onGrip }: Props) {
  const api = useEditor();
  const above = anchor.top > 56;
  const top = above ? anchor.top - 50 : Math.min(anchor.top + anchor.height + 10, pageHeight - 44);
  const size = Math.round(obj.fontSize * 10) / 10;

  // Mantiene el foco en el campo de texto al usar la barra.
  const keepFocus = (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) e.preventDefault();
  };

  return (
    <div
      className="ftb"
      role="toolbar"
      aria-label="Formato del texto"
      style={{ left: anchor.left, top, transformOrigin: above ? "bottom left" : "top left" }}
      onPointerDown={keepFocus}
    >
      <button
        className="ftb-btn ftb-grip"
        title="Arrastrar para mover"
        aria-label="Mover"
        onPointerDown={(e) => {
          e.stopPropagation();
          onGrip(e);
        }}
      >
        <GripVertical size={16} />
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
      <button className="ftb-btn" title="Reducir tamaño" aria-label="Reducir tamaño" onClick={() => api.update(obj, { fontSize: Math.max(4, size - 1) })}>
        <Minus size={15} />
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
      <button className="ftb-btn" title="Aumentar tamaño" aria-label="Aumentar tamaño" onClick={() => api.update(obj, { fontSize: Math.min(200, size + 1) })}>
        <Plus size={15} />
      </button>
      <span className="ftb-sep" />
      <button
        className={`ftb-btn ${obj.bold ? "on" : ""}`}
        title="Negrita"
        aria-label="Negrita"
        aria-pressed={obj.bold}
        onClick={() => api.update(obj, { bold: !obj.bold })}
      >
        <Bold size={15} strokeWidth={2.4} />
      </button>
      <button
        className={`ftb-btn ${obj.italic ? "on" : ""}`}
        title="Cursiva"
        aria-label="Cursiva"
        aria-pressed={obj.italic}
        onClick={() => api.update(obj, { italic: !obj.italic })}
      >
        <Italic size={15} />
      </button>
      <label className="ftb-color" title="Color del texto" style={{ background: rgbToHex(obj.color) }}>
        <input type="color" aria-label="Color del texto" value={rgbToHex(obj.color)} onChange={(e) => api.update(obj, { color: hexToRgb(e.target.value) })} />
      </label>
      <span className="ftb-sep" />
      {obj.kind === "block" && obj.modified && (
        <button className="ftb-btn" title="Restaurar original" aria-label="Restaurar original" onClick={() => api.restore(obj.id)}>
          <RotateCcw size={15} />
        </button>
      )}
      <button className="ftb-btn danger" title="Eliminar texto" aria-label="Eliminar texto" onClick={() => api.remove(obj)}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}
