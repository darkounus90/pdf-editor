import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type DragEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { enrichOffscreen, extractBlocks, openPdf, PdfPasswordError, readDocInfo } from "./pdf/analyze";
import { downloadBytes, exportPdf } from "./pdf/export";
import { EditorContext, type EditorApi, type Mode } from "./state/context";
import {
  addedToObject,
  blockToObject,
  countChanges,
  deleteObject,
  historyReducer,
  initialHistory,
  pageObjects,
  patchObject,
  replaceAll,
  restoreBlock,
  searchRegExp,
  type ObjectPatch,
} from "./state/editor";
import { PageView } from "./components/PageView";
import { Sidebar } from "./components/Sidebar";
import type { AddedText, DocInfo, TextBlock, TextObject, TextStyle } from "./types";

interface LoadedDoc {
  pdf: PDFDocumentProxy;
  bytes: Uint8Array;
  info: DocInfo;
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export default function App() {
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [blocks, setBlocks] = useState<TextBlock[][]>([]);
  const [history, dispatch] = useReducer(historyReducer, initialHistory);
  const [draft, setDraft] = useState<AddedText | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const [zoom, setZoom] = useState(1.25);
  const [search, setSearch] = useState({ query: "", replace: "", caseSensitive: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textSession = useRef(true);
  const lastStyle = useRef<TextStyle>({ fontSize: 12, family: "sans", bold: false, italic: false, color: [0, 0, 0] });

  const state = history.present;

  const notify = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setToast({ text, kind });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 5000);
  }, []);

  // ---------- Carga ----------

  const loadBytes = useCallback(
    async (bytes: Uint8Array, fileName: string) => {
      setBusy("Analizando PDF…");
      try {
        const pdf = await openPdf(bytes);
        const info = await readDocInfo(pdf, fileName, bytes.byteLength);
        const all: TextBlock[][] = [];
        for (let i = 0; i < pdf.numPages; i++) {
          setBusy(`Analizando página ${i + 1} de ${pdf.numPages}…`);
          all.push(await extractBlocks(await pdf.getPage(i + 1), i));
        }
        setDoc((prev) => {
          prev?.pdf.loadingTask.destroy();
          return { pdf, bytes, info };
        });
        setBlocks(all);
        dispatch({ type: "reset" });
        setDraft(null);
        setSelectedId(null);
        setMode("edit");
      } catch (err) {
        console.error(err);
        notify(
          err instanceof PdfPasswordError ? err.message : "No se pudo abrir el archivo. ¿Es un PDF válido?",
          "error",
        );
      } finally {
        setBusy(null);
      }
    },
    [notify],
  );

  const loadFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        notify("Selecciona un archivo PDF.", "error");
        return;
      }
      if (doc && countChanges(state) > 0 && !window.confirm("Hay cambios sin descargar. ¿Abrir otro archivo de todos modos?")) return;
      await loadBytes(new Uint8Array(await file.arrayBuffer()), file.name);
    },
    [doc, state, loadBytes, notify],
  );

  const loadSample = async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}ejemplo.pdf`);
    await loadBytes(new Uint8Array(await res.arrayBuffer()), "ejemplo.pdf");
  };

  // ---------- API de edición ----------

  const select = useCallback(
    (id: string | null) => {
      setDraft((d) => (d && d.id !== id ? null : d));
      setSelectedId(id);
      textSession.current = true;
    },
    [],
  );

  const update = useCallback(
    (obj: TextObject, patch: ObjectPatch, record = true) => {
      if (obj.kind === "added") {
        const { text: _t, x: _x, y: _y, deleted: _d, ...style } = patch;
        lastStyle.current = { ...lastStyle.current, ...style };
      }
      // Un texto nuevo vive como borrador hasta que se le escribe algo.
      if (draft && obj.id === draft.id) {
        const next = { ...draft, ...patch } as AddedText;
        if (next.text.trim()) {
          dispatch({ type: "apply", record: true, fn: (s) => ({ ...s, added: [...s.added, next] }) });
          setDraft(null);
          textSession.current = false;
        } else setDraft(next);
        return;
      }
      dispatch({ type: "apply", record, fn: (s) => patchObject(s, obj, patch) });
    },
    [draft],
  );

  const remove = useCallback(
    (obj: TextObject) => {
      if (draft && obj.id === draft.id) setDraft(null);
      else dispatch({ type: "apply", record: true, fn: (s) => deleteObject(s, obj) });
      setSelectedId(null);
    },
    [draft],
  );

  const restore = useCallback((id: string) => {
    dispatch({ type: "apply", record: true, fn: (s) => restoreBlock(s, id) });
  }, []);

  const addAt = useCallback((pageIndex: number, x: number, y: number) => {
    const id = `new-${Date.now().toString(36)}`;
    setDraft({ id, pageIndex, x, y, text: "", ...lastStyle.current });
    setSelectedId(id);
    setMode("edit");
    textSession.current = true;
  }, []);

  const onEnriched = useCallback((pageIndex: number, enriched: TextBlock[]) => {
    setBlocks((prev) => prev.map((p, i) => (i === pageIndex ? enriched : p)));
  }, []);

  const matchRe = useMemo(() => searchRegExp(search.query, search.caseSensitive), [search.query, search.caseSensitive]);

  const api: EditorApi = useMemo(
    () => ({ zoom, mode, selectedId, matchRe, textSession, select, update, remove, restore, addAt, onEnriched }),
    [zoom, mode, selectedId, matchRe, select, update, remove, restore, addAt, onEnriched],
  );

  // ---------- Acciones de la barra ----------

  const undo = () => {
    setDraft(null);
    setSelectedId(null);
    dispatch({ type: "undo" });
  };
  const redo = () => {
    setDraft(null);
    setSelectedId(null);
    dispatch({ type: "redo" });
  };

  const onReplaceAll = () => {
    const { state: next, count } = replaceAll(state, blocks, search.query, search.replace, search.caseSensitive);
    if (!count) return;
    dispatch({ type: "apply", record: true, fn: () => next });
    notify(`${count} reemplazos realizados.`);
  };

  const goTo = (obj: TextObject) => {
    document.getElementById(`page-${obj.pageIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!obj.deleted) select(obj.id);
  };

  const download = async () => {
    if (!doc) return;
    setSelectedId(null);
    setDraft(null);
    setBusy("Generando PDF…");
    try {
      // Las páginas editadas que nunca se renderizaron (p. ej. por reemplazar todo)
      // necesitan colores y fuentes antes de exportar.
      const touchedPages = new Set<number>();
      for (const id of Object.keys(state.edits)) touchedPages.add(Number(id.slice(1, id.indexOf("-"))));
      let current = blocks;
      for (const p of touchedPages) {
        if (current[p]?.some((b) => !b.enriched)) {
          const enriched = await enrichOffscreen(await doc.pdf.getPage(p + 1), current[p]);
          current = current.map((pb, i) => (i === p ? enriched : pb));
        }
      }
      if (current !== blocks) setBlocks(current);

      const objects: TextObject[] = [];
      for (const page of current) for (const b of page) if (state.edits[b.id]) objects.push(blockToObject(b, state.edits[b.id]));
      objects.push(...state.added.map(addedToObject));

      const { bytes, replacedChars, coveredBlocks } = await exportPdf(doc.bytes, objects);
      const base = doc.info.fileName.replace(/\.pdf$/i, "");
      downloadBytes(bytes, `${base}-editado.pdf`);
      const notes = ["PDF descargado."];
      if (replacedChars) notes.push(`${replacedChars} caracteres no soportados por la fuente se cambiaron por “?”.`);
      if (coveredBlocks)
        notes.push(
          coveredBlocks === 1
            ? "1 línea no se pudo borrar del archivo: quedó tapada y su texto original sigue dentro."
            : `${coveredBlocks} líneas no se pudieron borrar del archivo: quedaron tapadas y su texto original sigue dentro.`,
        );
      notify(notes.join(" "));
    } catch (err) {
      console.error(err);
      notify("No se pudo generar el PDF.", "error");
    } finally {
      setBusy(null);
    }
  };

  // ---------- Atajos de teclado ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inForeignField =
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") && !target.hasAttribute("data-editor-input");
      if (!doc || inForeignField) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        select(null);
        setMode("edit");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- Arrastrar y soltar ----------

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const changes = countChanges(state);

  return (
    <EditorContext.Provider value={api}>
      <div
        className={`app ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
        onDrop={onDrop}
      >
        <header className="topbar">
          <div className="brand">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--accent)" />
              <path d="M14 2v5h5" fill="#fff" opacity=".55" />
              <path d="M8 17l1.2-3.6L15 7.6l2.4 2.4-5.8 5.8L8 17z" fill="#fff" />
            </svg>
            <span>Editor PDF</span>
            {doc && <span className="doc-name" title={doc.info.fileName}>{doc.info.fileName}</span>}
          </div>

          {doc && (
            <div className="tools">
              <div className="segmented" role="radiogroup" aria-label="Modo">
                <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")} title="Clic en un texto para editarlo">
                  Editar texto
                </button>
                <button className={mode === "add" ? "active" : ""} onClick={() => setMode("add")} title="Clic en la página para agregar texto">
                  + Agregar texto
                </button>
              </div>
              <span className="sep" />
              <button className="icon-btn" onClick={undo} disabled={!history.past.length} title="Deshacer (Ctrl+Z)">
                ↶
              </button>
              <button className="icon-btn" onClick={redo} disabled={!history.future.length} title="Rehacer (Ctrl+Y)">
                ↷
              </button>
              <span className="sep" />
              <button className="icon-btn" onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])} disabled={zoom === ZOOMS[0]} title="Alejar">
                −
              </button>
              <select className="zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom">
                {ZOOMS.map((z) => (
                  <option key={z} value={z}>
                    {Math.round(z * 100)}%
                  </option>
                ))}
              </select>
              <button className="icon-btn" onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} title="Acercar">
                +
              </button>
            </div>
          )}

          <div className="actions">
            <button className="btn" onClick={() => fileInput.current?.click()}>
              Abrir PDF
            </button>
            {doc && (
              <button className="btn primary" onClick={download} disabled={!!busy}>
                Descargar{changes ? ` (${changes})` : ""}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFile(f);
              e.target.value = "";
            }}
          />
        </header>

        {doc ? (
          <div className="workspace">
            <Sidebar
              info={doc.info}
              blocks={blocks}
              state={state}
              search={search}
              onSearchChange={setSearch}
              onReplaceAll={onReplaceAll}
              onGoTo={goTo}
              onRestore={restore}
            />
            <main className={`viewer ${mode === "add" ? "adding" : ""}`}>
              {mode === "add" && (
                <div className="hint">
                  <span>Haz clic en la página donde quieras escribir · Esc para cancelar</span>
                </div>
              )}
              {doc.info.pages.map((p) => (
                <PageView
                  key={`${doc.info.fileName}-${p.index}`}
                  pdf={doc.pdf}
                  info={p}
                  blocks={blocks[p.index] ?? []}
                  objects={pageObjects(blocks[p.index] ?? [], state, p.index, draft)}
                />
              ))}
            </main>
          </div>
        ) : (
          <EmptyState onOpen={() => fileInput.current?.click()} onSample={loadSample} />
        )}

        {busy && (
          <div className="busy">
            <div className="spinner" />
            {busy}
          </div>
        )}
        {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
        {dragOver && <div className="drop-zone">Suelta el PDF para abrirlo</div>}
      </div>
    </EditorContext.Provider>
  );
}

function EmptyState({ onOpen, onSample }: { onOpen: () => void; onSample: () => void }) {
  return (
    <div className="empty">
      <div className="empty-card">
        <h1>Edita el texto de cualquier PDF</h1>
        <p>
          Arrastra un archivo aquí o ábrelo desde tu equipo. El documento se analiza en tu navegador: nada se sube a
          ningún servidor.
        </p>
        <div className="empty-actions">
          <button className="btn primary lg" onClick={onOpen}>
            Abrir PDF
          </button>
          <button className="btn lg" onClick={onSample}>
            Probar con un ejemplo
          </button>
        </div>
        <ul className="features">
          <li>
            <strong>Análisis</strong>
            <span>Metadatos, fuentes, tamaños, colores y detección de páginas escaneadas.</span>
          </li>
          <li>
            <strong>Edición en línea</strong>
            <span>Haz clic en una línea para cambiar texto, tamaño, estilo, color o posición.</span>
          </li>
          <li>
            <strong>Buscar y reemplazar</strong>
            <span>Cambia un dato en todo el documento de una sola vez.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
