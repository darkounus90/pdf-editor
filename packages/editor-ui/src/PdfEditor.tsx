import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  FileUp,
  FolderOpen,
  Lock,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Sparkles,
  TextCursorInput,
  Undo2,
} from "lucide-react";
import type { PDFDocumentProxy } from "@pdf-editor/pdf-core";
import {
  addedToObject,
  blockToObject,
  countChanges,
  deleteObject,
  exportPdf,
  extractBlocks,
  historyReducer,
  initialHistory,
  openPdf,
  pageObjects,
  patchObject,
  PdfPasswordError,
  readDocInfo,
  replaceAll,
  restoreBlock,
  searchRegExp,
  type AddedText,
  type DocInfo,
  type ObjectPatch,
  type TextBlock,
  type TextObject,
  type TextStyle,
} from "@pdf-editor/pdf-core";
import { downloadBytes, enrichOffscreen, setupBrowserPdfjs } from "@pdf-editor/pdf-core/browser";
import { EditorContext, type EditorApi, type Mode } from "./context";
import { Brand } from "./components/Brand";
import { PageView } from "./components/PageView";
import { Sidebar } from "./components/Sidebar";

interface LoadedDoc {
  pdf: PDFDocumentProxy;
  bytes: Uint8Array;
  info: DocInfo;
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** Zoom inicial: 125 % si cabe; en pantallas angostas, el mayor que deje ver la página completa. */
function fitZoom(pageWidth: number): number {
  const available = window.innerWidth - (window.innerWidth > 900 ? 324 + 64 : 32);
  const fitting = ZOOMS.filter((z) => z <= 1.25 && pageWidth * z <= available);
  return fitting.length ? fitting[fitting.length - 1] : ZOOMS[0];
}

export interface PdfEditorProps {
  /** URL de la carpeta con los assets de pdf.js (worker, cmaps, fuentes estándar, wasm, ICC). */
  assetsUrl?: string;
  /** PDF que abre el botón «Probar con un ejemplo». */
  sampleUrl?: string;
  /** Abre el ejemplo al montar el editor. */
  autoLoadSample?: boolean;
  /** Si se indica, el logo de la barra enlaza aquí (p. ej. la portada). */
  homeHref?: string;
  /**
   * Se consulta antes de generar cada descarga (p. ej. para validar en el servidor
   * los límites del plan). Si devuelve `ok: false`, la descarga no se hace y se
   * muestra el mensaje con su botón.
   */
  beforeDownload?: (info: { pages: number; fileName: string }) => Promise<DownloadGate>;
  /** Se llama después de cada descarga exitosa. */
  onDownloaded?: () => void;
  /** Contenido extra a la derecha de la barra superior (plan, cuenta…). */
  topbarExtra?: ReactNode;
}

/** Respuesta de `beforeDownload`. */
export type DownloadGate =
  | { ok: true }
  | { ok: false; title: string; message: string; actionLabel?: string; actionHref?: string };

type BlockedDownload = Extract<DownloadGate, { ok: false }>;

export function PdfEditor({
  assetsUrl = "/pdfjs/",
  sampleUrl = "/ejemplo.pdf",
  autoLoadSample = false,
  homeHref,
  beforeDownload,
  onDownloaded,
  topbarExtra,
}: PdfEditorProps) {
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [blocks, setBlocks] = useState<TextBlock[][]>([]);
  const [history, dispatch] = useReducer(historyReducer, initialHistory);
  const [draft, setDraft] = useState<AddedText | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const [zoom, setZoom] = useState(1.25);
  const [search, setSearch] = useState({ query: "", replace: "", caseSensitive: false });
  const [busy, setBusy] = useState<{ text: string; progress?: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [blocked, setBlocked] = useState<BlockedDownload | null>(null);
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
      setBusy({ text: "Abriendo el PDF…" });
      try {
        setupBrowserPdfjs({ assetsUrl });
        const pdf = await openPdf(bytes);
        const info = await readDocInfo(pdf, fileName, bytes.byteLength);
        const all: TextBlock[][] = [];
        for (let i = 0; i < pdf.numPages; i++) {
          setBusy({ text: `Analizando página ${i + 1} de ${pdf.numPages}…`, progress: (i + 1) / pdf.numPages });
          all.push(await extractBlocks(await pdf.getPage(i + 1), i));
        }
        setDoc((prev) => {
          prev?.pdf.loadingTask.destroy();
          return { pdf, bytes, info };
        });
        setBlocks(all);
        setZoom(fitZoom(info.pages[0]?.width ?? 612));
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
    [assetsUrl, notify],
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

  const loadSample = useCallback(async () => {
    const res = await fetch(sampleUrl);
    const name = decodeURIComponent(sampleUrl.split(/[?#]/)[0].split("/").pop() || "ejemplo.pdf");
    await loadBytes(new Uint8Array(await res.arrayBuffer()), name);
  }, [sampleUrl, loadBytes]);

  const autoLoaded = useRef(false);
  useEffect(() => {
    if (!autoLoadSample || autoLoaded.current) return;
    autoLoaded.current = true;
    loadSample();
  }, [autoLoadSample, loadSample]);

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
    setBusy({ text: "Generando tu PDF…" });
    try {
      if (beforeDownload) {
        const gate = await beforeDownload({ pages: doc.info.numPages, fileName: doc.info.fileName });
        if (!gate.ok) {
          setBlocked(gate);
          return;
        }
      }
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
      onDownloaded?.();
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
          <div className="topbar-left">
            <Brand href={homeHref} />
            {doc && (
              <span className="doc-pill" title={doc.info.fileName}>
                <FileText size={15} aria-hidden />
                <span className="name">{doc.info.fileName}</span>
                <span className="meta">
                  · {doc.info.numPages} {doc.info.numPages === 1 ? "pág." : "págs."}
                </span>
              </span>
            )}
          </div>

          {doc ? (
            <div className="tools">
              <div className="segmented" role="radiogroup" aria-label="Modo" data-active={mode === "add" ? 1 : 0}>
                <span className="thumb" aria-hidden />
                <button
                  role="radio"
                  aria-checked={mode === "edit"}
                  className={mode === "edit" ? "active" : ""}
                  onClick={() => setMode("edit")}
                  title="Clic en un texto para editarlo"
                >
                  <MousePointer2 size={15} aria-hidden />
                  <span>Editar</span>
                </button>
                <button
                  role="radio"
                  aria-checked={mode === "add"}
                  className={mode === "add" ? "active" : ""}
                  onClick={() => setMode("add")}
                  title="Clic en la página para agregar texto"
                >
                  <TextCursorInput size={15} aria-hidden />
                  <span>Agregar texto</span>
                </button>
              </div>
              <span className="sep" />
              <button className="icon-btn" onClick={undo} disabled={!history.past.length} title="Deshacer (Ctrl+Z)" aria-label="Deshacer">
                <Undo2 size={17} />
              </button>
              <button className="icon-btn" onClick={redo} disabled={!history.future.length} title="Rehacer (Ctrl+Y)" aria-label="Rehacer">
                <Redo2 size={17} />
              </button>
              <span className="sep" />
              <div className="zoom-group">
                <button
                  className="icon-btn"
                  onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}
                  disabled={zoom === ZOOMS[0]}
                  title="Alejar"
                  aria-label="Alejar"
                >
                  <Minus size={16} />
                </button>
                <select className="zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom">
                  {ZOOMS.map((z) => (
                    <option key={z} value={z}>
                      {Math.round(z * 100)}%
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}
                  disabled={zoom === ZOOMS[ZOOMS.length - 1]}
                  title="Acercar"
                  aria-label="Acercar"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ) : (
            <span />
          )}

          <div className="actions">
            {topbarExtra}
            <button className={`btn ${doc ? "ghost" : ""}`} onClick={() => fileInput.current?.click()} title="Abrir otro PDF">
              <FolderOpen size={16} aria-hidden />
              <span>Abrir</span>
            </button>
            {doc && (
              <button className="btn primary" onClick={download} disabled={!!busy}>
                <Download size={16} aria-hidden />
                Descargar
                {changes > 0 && <span className="count">{changes}</span>}
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
                  <span>
                    <TextCursorInput size={15} aria-hidden />
                    Haz clic en la página donde quieras escribir <kbd>Esc</kbd>
                  </span>
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
          <div className="busy" role="status" aria-live="polite">
            <div className="busy-card">
              {busy.text}
              <div className={`progress ${busy.progress === undefined ? "indeterminate" : ""}`}>
                <span style={busy.progress === undefined ? undefined : { width: `${Math.round(busy.progress * 100)}%` }} />
              </div>
            </div>
          </div>
        )}
        {toast && (
          <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"} key={toast.text}>
            {toast.kind === "error" ? <CircleAlert size={18} aria-hidden /> : <CircleCheck size={18} aria-hidden />}
            {toast.text}
          </div>
        )}
        {blocked && <BlockedDialog blocked={blocked} onClose={() => setBlocked(null)} />}
        {dragOver && (
          <div className="drop-zone">
            <div>
              <FileUp size={40} strokeWidth={1.75} aria-hidden />
              Suelta el PDF para abrirlo
            </div>
          </div>
        )}
      </div>
    </EditorContext.Provider>
  );
}

function BlockedDialog({ blocked, onClose }: { blocked: BlockedDownload; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="blocked-title">
        <span className="modal-icon" aria-hidden>
          <Sparkles size={22} />
        </span>
        <h2 id="blocked-title">{blocked.title}</h2>
        <p>{blocked.message}</p>
        <div className="modal-actions">
          <button ref={close} className="btn" onClick={onClose}>
            Ahora no
          </button>
          {blocked.actionHref && (
            <a className="btn primary" href={blocked.actionHref}>
              {blocked.actionLabel ?? "Ver planes"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onOpen, onSample }: { onOpen: () => void; onSample: () => void }) {
  return (
    <div className="empty">
      <div className="dropzone">
        <div>
          <h1>Abre un PDF y corrígelo renglón por renglón</h1>
          <p>
            Arrastra el archivo a esta zona o búscalo en tu equipo. Luego haz clic en cualquier línea del documento
            para cambiarla.
          </p>
          <div className="empty-actions">
            <button className="btn primary lg" onClick={onOpen}>
              <FolderOpen size={18} aria-hidden />
              Elegir un PDF
            </button>
            <button className="btn lg" onClick={onSample}>
              Probar con un ejemplo
            </button>
          </div>
          <div className="empty-foot">
            <Lock size={14} aria-hidden />
            Tu archivo se procesa en este navegador y nunca se sube a un servidor.
          </div>
        </div>
        <div className="sheet" aria-hidden>
          <i />
          <i />
          <i />
          <span className="fixed">
            <svg className="mark" viewBox="0 0 200 20" preserveAspectRatio="none">
              <path d="M2 11 C 60 7, 120 13, 198 9" pathLength={1} />
            </svg>
          </span>
          <span className="new-line" />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
