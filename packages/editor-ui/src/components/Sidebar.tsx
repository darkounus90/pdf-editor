import { Fragment, useMemo, useState, type ReactNode } from "react";
import { History, Info, ListChecks, ScanSearch, Search as SearchIcon, TriangleAlert } from "lucide-react";
import {
  addedToObject,
  blockToObject,
  FAMILY_LABEL,
  searchRegExp,
  type DocInfo,
  type EditState,
  type PageInfo,
  type TextBlock,
  type TextObject,
} from "@pdf-editor/pdf-core";

type Tab = "analysis" | "search" | "changes";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "analysis", label: "Análisis", icon: <ScanSearch size={15} aria-hidden /> },
  { id: "search", label: "Buscar", icon: <SearchIcon size={15} aria-hidden /> },
  { id: "changes", label: "Cambios", icon: <ListChecks size={15} aria-hidden /> },
];

interface Props {
  info: DocInfo;
  blocks: TextBlock[][];
  state: EditState;
  search: { query: string; replace: string; caseSensitive: boolean };
  onSearchChange: (s: Props["search"]) => void;
  onReplaceAll: () => void;
  onGoTo: (obj: TextObject) => void;
  onRestore: (id: string) => void;
}

export function Sidebar(props: Props) {
  const [tab, setTab] = useState<Tab>("analysis");
  const changes = Object.keys(props.state.edits).length + props.state.added.length;

  return (
    <aside className="sidebar">
      <div className="tabs" role="tablist">
        <span
          className="thumb"
          aria-hidden
          style={{ transform: `translateX(calc(${TABS.findIndex((t) => t.id === tab)} * (100% + 2px)))` }}
        />
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.id === "changes" && changes > 0 ? <span className="badge">{changes}</span> : t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="sidebar-body">
        <div className="tab-panel" key={tab} role="tabpanel">
          {tab === "analysis" && <Analysis info={props.info} blocks={props.blocks} />}
          {tab === "search" && <Search {...props} />}
          {tab === "changes" && <Changes {...props} />}
        </div>
      </div>
    </aside>
  );
}

// ---------- Análisis ----------

const PAPER: [string, number, number][] = [
  ["A3", 842, 1191],
  ["A4", 595, 842],
  ["A5", 420, 595],
  ["Carta", 612, 792],
  ["Oficio", 612, 1008],
];

function paperName(p: PageInfo): string {
  const w = Math.min(p.width, p.height);
  const h = Math.max(p.width, p.height);
  const match = PAPER.find(([, pw, ph]) => Math.abs(pw - w) < 4 && Math.abs(ph - h) < 4);
  const mm = (pt: number) => Math.round((pt / 72) * 25.4);
  const orient = p.width > p.height ? " horizontal" : "";
  return `${match ? match[0] + orient + " · " : ""}${mm(p.width)} × ${mm(p.height)} mm`;
}

const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`;

function Analysis({ info, blocks }: { info: DocInfo; blocks: TextBlock[][] }) {
  const stats = useMemo(() => {
    const all = blocks.flat();
    const text = all.map((b) => b.text).join(" ");
    const words = text.split(/\s+/).filter(Boolean).length;
    const emptyPages = blocks.map((p, i) => (p.length === 0 ? i + 1 : -1)).filter((i) => i > 0);
    const analyzedPages = blocks.filter((p) => p.length > 0 && p.every((b) => b.enriched)).length;
    const pagesWithText = blocks.filter((p) => p.length > 0).length;

    const fonts = new Map<string, { name: string; count: number; sizes: Set<number>; block: TextBlock }>();
    for (const b of all) {
      const key = b.enriched ? b.fontName || b.fontRef : b.fontRef;
      const entry = fonts.get(key) ?? { name: b.fontName, count: 0, sizes: new Set<number>(), block: b };
      entry.count++;
      entry.sizes.add(Math.round(b.fontSize * 10) / 10);
      fonts.set(key, entry);
    }
    const sizes = new Set(info.pages.map(paperName));
    return { blocks: all.length, words, chars: text.length, emptyPages, analyzedPages, pagesWithText, fonts, sizes };
  }, [blocks, info.pages]);

  const scanned = stats.emptyPages.length > 0;

  return (
    <div className="analysis">
      <section>
        <h3>Archivo</h3>
        <dl>
          <dt>Nombre</dt>
          <dd title={info.fileName}>{info.fileName}</dd>
          <dt>Tamaño</dt>
          <dd>{formatBytes(info.fileSize)}</dd>
          {info.pdfVersion && (
            <>
              <dt>Versión</dt>
              <dd>PDF {info.pdfVersion}</dd>
            </>
          )}
          <dt>Páginas</dt>
          <dd>{info.numPages}</dd>
          <dt>Formato</dt>
          <dd>{stats.sizes.size === 1 ? [...stats.sizes][0] : `${stats.sizes.size} tamaños distintos`}</dd>
          <dt>Cifrado</dt>
          <dd>{info.encrypted ? "Sí" : "No"}</dd>
          <dt>Formulario</dt>
          <dd>{info.formFields ? `${info.formFields} campos` : "No"}</dd>
        </dl>
      </section>

      <section>
        <h3>Metadatos</h3>
        <dl>
          {(
            [
              ["Título", info.title],
              ["Autor", info.author],
              ["Asunto", info.subject],
              ["Creado con", info.creator],
              ["Productor", info.producer],
              ["Creación", info.creationDate],
              ["Modificación", info.modDate],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <Row key={k} k={k} v={v!} />
            ))}
        </dl>
        {!info.title && !info.author && !info.producer && <p className="muted small">Este PDF no trae metadatos.</p>}
      </section>

      <section>
        <h3>Contenido</h3>
        <div className="stats">
          <Stat n={stats.blocks} label="líneas editables" />
          <Stat n={stats.words} label="palabras" />
          <Stat n={stats.fonts.size} label="fuentes" />
        </div>
        {scanned && (
          <p className="warn">
            <TriangleAlert size={16} aria-hidden />
            {stats.emptyPages.length === info.numPages
              ? "El documento no tiene texto seleccionable: probablemente es un escaneo y necesitaría OCR para editarse."
              : `Páginas sin texto (posibles imágenes escaneadas): ${stats.emptyPages.join(", ")}.`}
          </p>
        )}
      </section>

      <section>
        <h3>Fuentes detectadas</h3>
        {stats.analyzedPages < stats.pagesWithText && (
          <p className="muted small">
            Estilo analizado en {stats.analyzedPages} de {stats.pagesWithText} páginas; se completa al desplazarte.
          </p>
        )}
        <ul className="fonts">
          {[...stats.fonts.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .map(([key, f]) => (
              <li key={key}>
                <span className="font-name">{f.block.enriched ? f.name || "Sin nombre" : "Pendiente de análisis"}</span>
                <span className="font-meta">
                  {[
                    FAMILY_LABEL[f.block.family].split(" ")[0],
                    f.block.bold && "negrita",
                    f.block.italic && "cursiva",
                    [...f.sizes].sort((a, b) => a - b).slice(0, 4).join(" / ") + " pt",
                    `${f.count} líneas`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <>
    <dt>{k}</dt>
    <dd title={v}>{v}</dd>
  </>
);

const Stat = ({ n, label }: { n: number; label: string }) => (
  <div className="stat">
    <strong>{n.toLocaleString("es")}</strong>
    <span>{label}</span>
  </div>
);

// ---------- Buscar y reemplazar ----------

function Search({ blocks, state, search, onSearchChange, onReplaceAll, onGoTo }: Props) {
  const results = useMemo(() => {
    const re = searchRegExp(search.query, search.caseSensitive);
    if (!re) return [];
    const out: { obj: TextObject; count: number }[] = [];
    const objs = [...blocks.flat().map((b) => blockToObject(b, state.edits[b.id])), ...state.added.map(addedToObject)];
    for (const obj of objs) {
      if (obj.deleted) continue;
      const m = obj.text.match(re);
      if (m) out.push({ obj, count: m.length });
    }
    return out.sort((a, b) => a.obj.pageIndex - b.obj.pageIndex);
  }, [blocks, state, search.query, search.caseSensitive]);

  const total = results.reduce((s, r) => s + r.count, 0);

  return (
    <div className="search">
      <label className="field">
        <span>Buscar</span>
        <input
          value={search.query}
          placeholder="Texto a buscar"
          onChange={(e) => onSearchChange({ ...search, query: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Reemplazar por</span>
        <input
          value={search.replace}
          placeholder="Nuevo texto"
          onChange={(e) => onSearchChange({ ...search, replace: e.target.value })}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={search.caseSensitive}
          onChange={(e) => onSearchChange({ ...search, caseSensitive: e.target.checked })}
        />
        Distinguir mayúsculas
      </label>
      <button className="btn primary block" disabled={!total || !search.query} onClick={onReplaceAll}>
        Reemplazar todo{total ? <span className="count">{total}</span> : null}
      </button>
      {search.query && (
        <p className="muted small">{total ? `${total} coincidencias en ${results.length} líneas` : "Sin coincidencias"}</p>
      )}
      <ul className="results">
        {results.map(({ obj }) => (
          <li key={obj.id}>
            <button onClick={() => onGoTo(obj)}>
              <span className="pg">Pág. {obj.pageIndex + 1}</span>
              <span className="snippet">{highlight(obj.text, search.query, search.caseSensitive)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Cambios ----------

function Changes({ blocks, state, onGoTo, onRestore }: Props) {
  const items = useMemo(() => {
    const byId = new Map(blocks.flat().map((b) => [b.id, b]));
    const list: { obj: TextObject; label: string }[] = [];
    for (const [id, edit] of Object.entries(state.edits)) {
      const b = byId.get(id);
      if (!b) continue;
      const parts = [];
      if (edit.deleted) parts.push("Eliminado");
      else {
        if (edit.text !== undefined) parts.push("Texto");
        if (edit.dx !== undefined || edit.dy !== undefined) parts.push("Movido");
        if (edit.fontSize || edit.family || edit.bold !== undefined || edit.italic !== undefined || edit.color)
          parts.push("Estilo");
      }
      list.push({ obj: blockToObject(b, edit), label: parts.join(" · ") });
    }
    for (const a of state.added) list.push({ obj: addedToObject(a), label: "Nuevo" });
    return list.sort((a, b) => a.obj.pageIndex - b.obj.pageIndex);
  }, [blocks, state]);

  if (!items.length)
    return (
      <div className="empty-panel">
        <History size={28} strokeWidth={1.6} aria-hidden />
        <strong>Todavía no hay cambios</strong>
        Haz clic en cualquier línea del documento para corregirla. Cada cambio aparecerá aquí y podrás restaurarlo.
      </div>
    );

  return (
    <>
      <ul className="results changes">
        {items.map(({ obj, label }) => (
          <li key={obj.id}>
            <button onClick={() => onGoTo(obj)}>
              <span className="pg">
                Pág. {obj.pageIndex + 1} · {label}
              </span>
              {obj.block && obj.block.text !== obj.text && <span className="snippet old">{obj.block.text}</span>}
              <span className={`snippet ${obj.deleted ? "old" : "new"}`}>{obj.text || "(vacío)"}</span>
            </button>
            {obj.kind === "block" && (
              <button className="link" onClick={() => onRestore(obj.id)}>
                Restaurar
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="note">
        <Info size={15} aria-hidden />
        <span>
          Al descargar, el texto original de cada línea corregida se borra del archivo. Si alguna no se puede borrar con
          seguridad (por ejemplo, texto dentro de una capa de OCR o un PDF cifrado), se tapa con el color de fondo y te
          avisamos cuántas quedaron así.
        </span>
      </p>
    </>
  );
}

/** Marca con resaltador las coincidencias de la búsqueda dentro de un texto. */
function highlight(text: string, query: string, caseSensitive: boolean): ReactNode {
  const re = searchRegExp(query, caseSensitive);
  if (!re) return text;
  const parts = text.split(new RegExp(`(${re.source})`, re.flags));
  return parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>));
}
