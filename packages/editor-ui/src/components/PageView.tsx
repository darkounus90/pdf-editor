import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  baselineRatio,
  cssFont,
  rgbToCss,
  toViewportRect,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageInfo,
  type PageViewport,
  type TextBlock,
  type TextObject,
} from "@pdf-editor/pdf-core";
import { enrichBlocks, measureText, renderToCanvas } from "@pdf-editor/pdf-core/browser";
import { useEditor } from "../context";
import { FloatingToolbar } from "./FloatingToolbar";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function normRect(r: number[]): Box {
  const [x1, y1, x2, y2] = r;
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

function blockRect(b: TextBlock, viewport: PageViewport, pad = 0): Box {
  return normRect(
    toViewportRect(viewport, [
      b.x - pad,
      b.y + b.descent * b.fontSize - pad,
      b.x + b.width + pad,
      b.y + b.ascent * b.fontSize + pad,
    ]),
  );
}

/** Caja del texto tal como se dibujará con la fuente estándar. */
function textBox(obj: TextObject, viewport: PageViewport, zoom: number): Box {
  const fontPx = obj.fontSize * zoom;
  const [px, py] = viewport.convertToViewportPoint(obj.x, obj.y);
  const width = measureText(obj.text || " ", cssFont(obj, fontPx));
  return { left: px, top: py - baselineRatio(obj.family) * fontPx, width, height: fontPx };
}

interface Props {
  pdf: PDFDocumentProxy;
  info: PageInfo;
  blocks: TextBlock[];
  objects: TextObject[];
}

export function PageView({ pdf, info, blocks, objects }: Props) {
  const api = useEditor();
  const { zoom } = api;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendering, setRendering] = useState(true);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => {
    let alive = true;
    pdf.getPage(info.index + 1).then((p) => alive && setPage(p));
    return () => {
      alive = false;
    };
  }, [pdf, info.index]);

  // Render diferido: solo cuando la página se acerca a la vista.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const viewport = useMemo(() => page?.getViewport({ scale: zoom }) ?? null, [page, zoom]);

  const pendingRender = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    if (!visible || !page || !canvasRef.current) return;
    const canvas = canvasRef.current;
    let cancelled = false;
    let cancel = () => {};
    setRendering(true);

    const run = async () => {
      // pdf.js no permite dos render() simultáneos sobre el mismo canvas.
      await pendingRender.current?.catch(() => {});
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const handle = renderToCanvas(page, canvas, zoom * dpr);
      cancel = handle.cancel;
      pendingRender.current = handle.promise;
      try {
        await handle.promise;
      } catch {
        return; // render cancelado
      }
      if (cancelled) return;
      setRendering(false);
      if (blocksRef.current.some((b) => !b.enriched)) {
        api.onEnriched(info.index, enrichBlocks(page, blocksRef.current, canvas, handle.viewport));
      }
    };
    run();
    return () => {
      cancelled = true;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, page, zoom]);

  const cssW = info.width * zoom;
  const cssH = info.height * zoom;

  const onBackgroundPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== overlayRef.current || !viewport) return;
    if (api.mode === "add") {
      const rect = overlayRef.current.getBoundingClientRect();
      const fontPx = 12 * zoom;
      const [x, y] = viewport.convertToPdfPoint(
        e.clientX - rect.left,
        e.clientY - rect.top + baselineRatio("sans") * fontPx - fontPx / 2,
      );
      api.addAt(info.index, x, y);
      e.preventDefault();
    } else {
      api.select(null);
    }
  };

  const startDrag = (e: ReactPointerEvent, obj: TextObject) => {
    if (!viewport || !overlayRef.current) return;
    e.preventDefault();
    const rect = overlayRef.current.getBoundingClientRect();
    const [sx, sy] = viewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
    const { x: ox, y: oy } = obj;
    let first = true;
    const move = (ev: PointerEvent) => {
      const [px, py] = viewport.convertToPdfPoint(ev.clientX - rect.left, ev.clientY - rect.top);
      api.update(obj, { x: ox + px - sx, y: oy + py - sy }, first);
      first = false;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="page" id={`page-${info.index}`} ref={containerRef} style={{ width: cssW, height: cssH }}>
      <canvas ref={canvasRef} style={{ width: cssW, height: cssH }} />
      {rendering && (
        <div className="page-loading" role="status" aria-label="Cargando página">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      )}
      <div
        ref={overlayRef}
        className={`overlay mode-${api.mode}`}
        onPointerDown={onBackgroundPointerDown}
        style={{ width: cssW, height: cssH }}
      >
        {viewport &&
          objects.map((obj) => (
            <TextObjectView key={obj.id} obj={obj} viewport={viewport} onGrip={(e) => startDrag(e, obj)} />
          ))}
      </div>
      <div className="page-number">{info.index + 1}</div>
    </div>
  );
}

function TextObjectView({
  obj,
  viewport,
  onGrip,
}: {
  obj: TextObject;
  viewport: PageViewport;
  onGrip: (e: ReactPointerEvent) => void;
}) {
  const api = useEditor();
  const { zoom } = api;
  const selected = api.selectedId === obj.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const fontPx = obj.fontSize * zoom;
  const font = cssFont(obj, fontPx);
  const block = obj.block;

  useLayoutEffect(() => {
    if (selected) inputRef.current?.focus({ preventScroll: true });
  }, [selected]);

  // Tapa el texto original cuando el bloque se modificó o se está editando.
  const showCover = block && (obj.modified || selected);
  const cover = showCover ? blockRect(block, viewport, Math.max(0.6, block.fontSize * 0.06)) : null;

  // Bloque intacto: zona de clic sobre el texto original del canvas.
  const pristine = obj.kind === "block" && !obj.modified && !selected;
  const box = pristine && block ? blockRect(block, viewport) : textBox(obj, viewport, zoom);

  const isMatch = api.matchRe !== null && !obj.deleted && obj.text.search(api.matchRe) >= 0;

  const textStyle = {
    left: box.left,
    top: box.top,
    font,
    lineHeight: 1,
    color: rgbToCss(obj.color),
  };

  return (
    <>
      {cover && <div className="cover" style={{ ...boxStyle(cover), background: rgbToCss(block!.bgColor) }} />}

      {!obj.deleted && selected && (
        <input
          ref={inputRef}
          className="tb-input"
          data-editor-input
          value={obj.text}
          spellCheck={false}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            api.update(obj, { text: e.target.value }, api.textSession.current);
            api.textSession.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              api.select(null);
            }
          }}
          style={{ ...textStyle, width: box.width + fontPx * 1.5, height: fontPx }}
        />
      )}

      {!obj.deleted && !selected && (
        <div
          className={[
            "tb",
            pristine ? "tb-pristine" : "tb-modified",
            obj.kind === "added" ? "tb-added" : "",
            isMatch ? "tb-match" : "",
          ].join(" ")}
          title={pristine ? "Clic para editar" : undefined}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            api.select(obj.id);
          }}
          style={pristine ? boxStyle(box) : { ...textStyle, height: box.height, minWidth: box.width }}
        >
          {pristine ? null : obj.text}
        </div>
      )}

      {selected && !obj.deleted && (
        <FloatingToolbar obj={obj} anchor={box} pageHeight={viewport.height} onGrip={onGrip} />
      )}
    </>
  );
}

const boxStyle = (b: Box) => ({ left: b.left, top: b.top, width: b.width, height: b.height });
