"use client";

import { Fragment, useMemo, useState } from "react";
import { Replace, Undo2 } from "lucide-react";

const LINES = [
  "Cliente: Juan Pérez",
  "Señor Juan Pérez, gracias por su interés en nuestros servicios.",
  "Válida hasta el 30 de octubre de 2026.",
  "Firma de aceptación: Juan Pérez",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Buscar y reemplazar en vivo sobre un documento de juguete. */
export function ReplaceDemo() {
  const [query, setQuery] = useState("Juan Pérez");
  const [replacement, setReplacement] = useState("María Gómez");
  const [applied, setApplied] = useState<{ query: string; replacement: string } | null>(null);

  const re = useMemo(() => (query.trim() ? new RegExp(`(${escape(query)})`, "gi") : null), [query]);
  const total = re ? LINES.reduce((n, l) => n + (l.match(re)?.length ?? 0), 0) : 0;

  const render = (line: string) => {
    if (applied) {
      const are = new RegExp(`(${escape(applied.query)})`, "gi");
      return line.split(are).map((part, i) =>
        i % 2 === 1 ? (
          <span className="swap" key={i} style={{ animationDelay: `${i * 60}ms` }}>
            <del>{part}</del>
            <ins>{applied.replacement}</ins>
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      );
    }
    if (!re) return line;
    return line.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>));
  };

  return (
    <div className="rdemo">
      <div className="rdemo-controls">
        <label>
          <span>Buscar</span>
          <input
            value={query}
            disabled={!!applied}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Un nombre, una fecha…"
          />
        </label>
        <label>
          <span>Reemplazar por</span>
          <input
            value={replacement}
            disabled={!!applied}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Nuevo texto"
          />
        </label>
        {applied ? (
          <button type="button" className="btn" onClick={() => setApplied(null)}>
            <Undo2 size={16} aria-hidden />
            Deshacer
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={!total}
            onClick={() => setApplied({ query, replacement })}
          >
            <Replace size={16} aria-hidden />
            Reemplazar todo
            {total > 0 && <span className="count">{total}</span>}
          </button>
        )}
      </div>
      <div className="rdemo-doc" aria-live="polite">
        {LINES.map((l, i) => (
          <p key={i}>{render(l)}</p>
        ))}
      </div>
      <p className="rdemo-status">
        {applied
          ? "Listo. En tu PDF esto pasa en todas las páginas a la vez."
          : total
            ? `${total} ${total === 1 ? "coincidencia" : "coincidencias"} resaltadas`
            : "Sin coincidencias: prueba con otra palabra del documento"}
      </p>
    </div>
  );
}
