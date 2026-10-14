"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, MousePointer2, RotateCcw } from "lucide-react";

/**
 * Hoja de demostración: se corrige sola (tacha un precio y escribe el nuevo) y
 * luego deja que la persona haga clic en cualquier renglón y lo cambie.
 */

type LineId = "client" | "date" | "r1" | "r2" | "r3" | "total";

const ORIGINAL: Record<LineId, string> = {
  client: "Cliente: Juan Pérez",
  date: "Fecha: 14 de octubre de 2026",
  r1: "$ 2.500.000",
  r2: "$ 4.800.000",
  r3: "$ 650.000",
  total: "TOTAL: $ 7.950.000",
};

// Guion de la demostración automática.
const SCRIPT: { id: LineId; text: string }[] = [
  { id: "r1", text: "$ 2.900.000" },
  { id: "total", text: "TOTAL: $ 8.350.000" },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function HeroDemo() {
  const [lines, setLines] = useState(ORIGINAL);
  const [active, setActive] = useState<LineId | null>(null);
  const [editing, setEditing] = useState<LineId | null>(null);
  const [striking, setStriking] = useState<LineId | null>(null);
  const [phase, setPhase] = useState<"auto" | "yours" | "free">("auto");
  const [downloadNote, setDownloadNote] = useState(false);
  const run = useRef(0);

  const changes = (Object.keys(ORIGINAL) as LineId[]).filter((id) => lines[id] !== ORIGINAL[id]).length;

  const play = useCallback(async () => {
    const token = ++run.current;
    const alive = () => run.current === token;
    setLines(ORIGINAL);
    setPhase("auto");
    setEditing(null);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLines({ ...ORIGINAL, r1: SCRIPT[0].text, total: SCRIPT[1].text });
      setPhase("yours");
      return;
    }
    await wait(1400);
    for (const step of SCRIPT) {
      if (!alive()) return;
      setActive(step.id);
      await wait(520);
      if (!alive()) return;
      setStriking(step.id);
      await wait(620);
      if (!alive()) return;
      setStriking(null);
      // Borra y escribe carácter a carácter, como lo haría una persona.
      setLines((l) => ({ ...l, [step.id]: "" }));
      for (let i = 1; i <= step.text.length; i++) {
        await wait(42);
        if (!alive()) return;
        setLines((l) => ({ ...l, [step.id]: step.text.slice(0, i) }));
      }
      await wait(650);
    }
    if (!alive()) return;
    setActive(null);
    setPhase("yours");
  }, []);

  useEffect(() => {
    play();
    return () => {
      run.current++;
    };
  }, [play]);

  const startEditing = (id: LineId) => {
    run.current++; // detiene la demostración automática
    setStriking(null);
    setPhase("free");
    setActive(id);
    setEditing(id);
  };

  const reset = () => {
    setDownloadNote(false);
    play();
  };

  const line = (id: LineId, className = "") => {
    const modified = lines[id] !== ORIGINAL[id];
    const isActive = active === id;
    return (
      <span className={`dl ${className} ${modified ? "is-modified" : ""} ${isActive ? "is-active" : ""}`}>
        {editing === id ? (
          <input
            className="dl-input"
            autoFocus
            value={lines[id]}
            size={Math.max(lines[id].length, 4)}
            aria-label="Editar renglón"
            onChange={(e) => setLines((l) => ({ ...l, [id]: e.target.value }))}
            onBlur={() => {
              setEditing(null);
              setActive(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <button type="button" className="dl-text" onClick={() => startEditing(id)} aria-label={`Editar: ${lines[id]}`}>
            {lines[id] || " "}
            {lines[id] === "" || (phase === "auto" && isActive && !striking && modified) ? <span className="caret" /> : null}
          </button>
        )}
        {striking === id && (
          <svg className="strike" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
            <path d="M1 6 C 30 3, 70 8, 99 4" pathLength={1} />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="demo" aria-label="Demostración interactiva del editor">
      <div className="demo-bar">
        <span className="demo-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="demo-file">cotizacion-cliente.pdf</span>
        <span className={`demo-count ${changes ? "has" : ""}`} aria-live="polite">
          {changes ? `${changes} ${changes === 1 ? "cambio" : "cambios"}` : "Sin cambios"}
        </span>
        <button type="button" className="demo-dl" onClick={() => setDownloadNote(true)}>
          <Download size={14} aria-hidden />
          Descargar
        </button>
      </div>

      <div className="demo-page">
        <div className="doc-band">
          <strong>COTIZACIÓN DE SERVICIOS</strong>
          <span>Estudio Andino S.A.S. · NIT 900.123.456-7</span>
        </div>
        <div className="doc-body">
          <div className="doc-row doc-strong">{line("client")}</div>
          <div className="doc-row doc-muted">{line("date")}</div>
          <p className="doc-p">
            Presentamos la propuesta para el desarrollo de su sitio web, incluyendo diseño, programación y puesta en
            marcha.
          </p>
          <div className="doc-table" role="table" aria-label="Detalle de la cotización">
            <div className="doc-tr doc-th" role="row">
              <span role="columnheader">Concepto</span>
              <span role="columnheader">Valor</span>
            </div>
            <div className="doc-tr" role="row">
              <span role="cell">Diseño de interfaz</span>
              <span role="cell">{line("r1")}</span>
            </div>
            <div className="doc-tr" role="row">
              <span role="cell">Desarrollo front-end</span>
              <span role="cell">{line("r2")}</span>
            </div>
            <div className="doc-tr" role="row">
              <span role="cell">Hosting anual</span>
              <span role="cell">{line("r3")}</span>
            </div>
          </div>
          <div className="doc-total">{line("total")}</div>
        </div>

        {phase === "yours" && (
          <div className="demo-cue" role="status">
            <MousePointer2 size={15} aria-hidden />
            Tu turno: haz clic en cualquier renglón y escríbele encima
          </div>
        )}

        {downloadNote && (
          <div className="demo-note" role="status">
            <p>Esto es una demostración. En el editor abres tu propio PDF y lo descargas corregido.</p>
            <div>
              <Link href="/editar-pdf" className="btn primary">
                Abrir el editor
                <ArrowRight size={16} aria-hidden />
              </Link>
              <button type="button" className="btn ghost" onClick={() => setDownloadNote(false)}>
                Seguir probando
              </button>
            </div>
          </div>
        )}
      </div>

      <button type="button" className="demo-replay" onClick={reset}>
        <RotateCcw size={13} aria-hidden />
        Repetir demostración
      </button>
    </div>
  );
}
