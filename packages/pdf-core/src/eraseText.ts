import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  StandardFontEmbedder,
  StandardFonts,
  decodePDFRawStream,
  type PDFDocument,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";
import type { TextBlock } from "./types";
import { parseContent, type ContentOp, type Operand } from "./contentStream";

/*
 * Borrado real del texto original. Se decodifica el flujo de contenido de la
 * página, se sigue el estado gráfico y de texto (CTM, matriz de texto, fuente,
 * espaciados) y se calcula la caja de cada glifo con los anchos de la fuente.
 * Los glifos que caen por completo dentro del rectángulo de un bloque editado se
 * quitan, reemplazándolos por un desplazamiento equivalente en un TJ para que el
 * resto de la línea no se mueva. Un bloque solo se da por borrado si no quedó
 * ningún glifo suyo en pie; si no, la exportación lo sigue tapando.
 */

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 × m2 con la convención de PDF (vector fila). */
const mul = (m1: Matrix, m2: Matrix): Matrix => [
  m1[0] * m2[0] + m1[1] * m2[2],
  m1[0] * m2[1] + m1[1] * m2[3],
  m1[2] * m2[0] + m1[3] * m2[2],
  m1[2] * m2[1] + m1[3] * m2[3],
  m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
  m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
];
const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Métricas de una fuente: cómo partir una cadena en códigos y el ancho de cada uno (en milésimas de em). */
interface FontMetrics {
  bytesPerCode: 1 | 2;
  width: (code: number) => number | undefined;
}

interface GState {
  ctm: Matrix;
  font: FontMetrics | null;
  fontSize: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  leading: number;
  rise: number;
  renderMode: number;
}

interface Target {
  block: TextBlock;
  /** Zona donde un glifo puede quitarse. */
  outer: Box;
  /** Zona que cualquier glifo del bloque toca: si un glifo que la toca queda, el bloque no está limpio. */
  core: Box;
  removed: number;
  clean: boolean;
}

// ---------- Fuentes ----------

const STANDARD_ALIASES: Record<string, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  "Helvetica-Bold": StandardFonts.HelveticaBold,
  "Helvetica-Oblique": StandardFonts.HelveticaOblique,
  "Helvetica-BoldOblique": StandardFonts.HelveticaBoldOblique,
  Arial: StandardFonts.Helvetica,
  "Arial,Bold": StandardFonts.HelveticaBold,
  "Arial,Italic": StandardFonts.HelveticaOblique,
  "Arial,BoldItalic": StandardFonts.HelveticaBoldOblique,
  "Times-Roman": StandardFonts.TimesRoman,
  "Times-Bold": StandardFonts.TimesRomanBold,
  "Times-Italic": StandardFonts.TimesRomanItalic,
  "Times-BoldItalic": StandardFonts.TimesRomanBoldItalic,
  TimesNewRoman: StandardFonts.TimesRoman,
  "TimesNewRoman,Bold": StandardFonts.TimesRomanBold,
  "TimesNewRoman,Italic": StandardFonts.TimesRomanItalic,
  "TimesNewRoman,BoldItalic": StandardFonts.TimesRomanBoldItalic,
  Courier: StandardFonts.Courier,
  "Courier-Bold": StandardFonts.CourierBold,
  "Courier-Oblique": StandardFonts.CourierOblique,
  "Courier-BoldOblique": StandardFonts.CourierBoldOblique,
  CourierNew: StandardFonts.Courier,
  "CourierNew,Bold": StandardFonts.CourierBold,
  "CourierNew,Italic": StandardFonts.CourierOblique,
  "CourierNew,BoldItalic": StandardFonts.CourierBoldOblique,
  Symbol: StandardFonts.Symbol,
  ZapfDingbats: StandardFonts.ZapfDingbats,
};

const num = (obj: PDFObject | undefined): number | undefined => (obj instanceof PDFNumber ? obj.asNumber() : undefined);

/** Anchos de las 14 fuentes estándar cuando el PDF no trae /Widths (pdf-lib, por ejemplo, no los escribe). */
function standardMetrics(dict: PDFDict, baseFont: string): FontMetrics | null {
  const std = STANDARD_ALIASES[baseFont];
  if (!std) return null;
  const embedder = StandardFontEmbedder.for(std as never);
  const names = new Map<number, string>();
  const encoding = dict.lookup(PDFName.of("Encoding"));
  const encName =
    encoding instanceof PDFName ? encoding.asString() : encoding instanceof PDFDict ? encoding.lookup(PDFName.of("BaseEncoding"))?.toString() : undefined;
  const builtIn = std === StandardFonts.Symbol || std === StandardFonts.ZapfDingbats;

  if (builtIn || encName === "/WinAnsiEncoding") {
    for (const cp of embedder.encoding.supportedCodePoints) {
      const { code, name } = embedder.encoding.encodeUnicodeCodePoint(cp);
      if (!names.has(code)) names.set(code, name);
    }
  } else {
    // StandardEncoding / MacRoman: en ASCII coinciden con WinAnsi salvo las comillas.
    for (let cp = 32; cp < 127; cp++) names.set(cp, embedder.encoding.encodeUnicodeCodePoint(cp).name);
    names.set(39, "quoteright");
    names.set(96, "quoteleft");
  }
  if (encoding instanceof PDFDict) {
    const diffs = encoding.lookup(PDFName.of("Differences"));
    if (diffs instanceof PDFArray) {
      let code = 0;
      for (let i = 0; i < diffs.size(); i++) {
        const item = diffs.lookup(i);
        if (item instanceof PDFNumber) code = item.asNumber();
        else if (item instanceof PDFName) names.set(code++, item.asString().slice(1));
      }
    }
  }
  return {
    bytesPerCode: 1,
    width: (code) => {
      const name = names.get(code);
      if (!name) return undefined;
      const w = embedder.font.getWidthOfGlyph(name);
      return typeof w === "number" ? w : undefined;
    },
  };
}

function simpleMetrics(dict: PDFDict): FontMetrics | null {
  const widths = dict.lookup(PDFName.of("Widths"));
  const baseFont = (dict.lookup(PDFName.of("BaseFont"))?.toString() ?? "").slice(1).replace(/^[A-Z]{6}\+/, "");
  if (!(widths instanceof PDFArray)) return standardMetrics(dict, baseFont);

  const first = num(dict.lookup(PDFName.of("FirstChar"))) ?? 0;
  const descriptor = dict.lookup(PDFName.of("FontDescriptor"));
  const missing = descriptor instanceof PDFDict ? num(descriptor.lookup(PDFName.of("MissingWidth"))) ?? 0 : 0;
  const list: number[] = [];
  for (let i = 0; i < widths.size(); i++) list.push(num(widths.lookup(i)) ?? missing);
  return { bytesPerCode: 1, width: (code) => list[code - first] ?? missing };
}

function type0Metrics(dict: PDFDict): FontMetrics | null {
  // Solo codificación Identity horizontal: código de 2 bytes = CID.
  const encoding = dict.lookup(PDFName.of("Encoding"));
  if (!(encoding instanceof PDFName) || encoding.asString() !== "/Identity-H") return null;
  const descendants = dict.lookup(PDFName.of("DescendantFonts"));
  const cidFont = descendants instanceof PDFArray ? descendants.lookup(0) : undefined;
  if (!(cidFont instanceof PDFDict)) return null;

  const dw = num(cidFont.lookup(PDFName.of("DW"))) ?? 1000;
  const map = new Map<number, number>();
  const w = cidFont.lookup(PDFName.of("W"));
  if (w instanceof PDFArray) {
    for (let i = 0; i < w.size(); ) {
      const first = num(w.lookup(i));
      const next = w.lookup(i + 1);
      if (first === undefined) return null;
      if (next instanceof PDFArray) {
        for (let k = 0; k < next.size(); k++) map.set(first + k, num(next.lookup(k)) ?? dw);
        i += 2;
      } else {
        const last = num(next);
        const value = num(w.lookup(i + 2));
        if (last === undefined || value === undefined) return null;
        for (let c = first; c <= last; c++) map.set(c, value);
        i += 3;
      }
    }
  }
  return { bytesPerCode: 2, width: (code) => map.get(code) ?? dw };
}

function fontMetrics(dict: PDFDict): FontMetrics | null {
  const subtype = dict.lookup(PDFName.of("Subtype"))?.toString();
  if (subtype === "/Type1" || subtype === "/MMType1" || subtype === "/TrueType") return simpleMetrics(dict);
  if (subtype === "/Type0") return type0Metrics(dict);
  return null; // Type3 u otras: su geometría no se puede calcular con seguridad.
}

// ---------- Utilidades ----------

const fmt = (v: number) => {
  const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};
const hex = (bytes: Uint8Array) => "<" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + ">";
const operandNum = (o: Operand | undefined) => (o?.t === "num" ? o.v : 0);

const boxOf = (points: [number, number][]): Box => ({
  x1: Math.min(...points.map((p) => p[0])),
  y1: Math.min(...points.map((p) => p[1])),
  x2: Math.max(...points.map((p) => p[0])),
  y2: Math.max(...points.map((p) => p[1])),
});
const inBox = (b: Box, [x, y]: [number, number]) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
const overlaps = (a: Box, b: Box) => a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;

function makeTarget(block: TextBlock): Target {
  const fs = block.fontSize;
  const tolX = 0.1 * fs + 0.3;
  const tolY = 0.1 * fs;
  const outer = {
    x1: block.x - tolX,
    x2: block.x + block.width + tolX,
    y1: block.y + block.descent * fs - tolY,
    y2: block.y + block.ascent * fs + tolY,
  };
  const inset = Math.min(0.1 * fs, block.width / 2);
  const core = { x1: block.x + inset, x2: block.x + block.width - inset, y1: block.y + 0.05 * fs, y2: block.y + 0.4 * fs };
  return { block, outer, core, removed: 0, clean: true };
}

// ---------- Recursos de la página ----------

interface Resources {
  fonts: PDFDict | undefined;
  xobjects: PDFDict | undefined;
  extGStates: PDFDict | undefined;
}

function decodeStream(obj: PDFObject | undefined): Uint8Array | null {
  if (!(obj instanceof PDFRawStream)) return null;
  return decodePDFRawStream(obj).decode();
}

/** ¿El Form XObject dibuja texto? (o anida otros XObjects, que se tratan como si lo hicieran). */
function formMayHaveText(stream: PDFRawStream, cache: Map<PDFRawStream, boolean>): boolean {
  let result = cache.get(stream);
  if (result === undefined) {
    try {
      const data = decodeStream(stream);
      result = !data || parseContent(data).some((o) => o.op === "BT" || o.op === "Do");
    } catch {
      result = true;
    }
    cache.set(stream, result);
  }
  return result;
}

// ---------- Interpretación y reescritura ----------

interface Rewrite {
  start: number;
  end: number;
  text: string;
}

/**
 * Recorre los operadores de la página y decide qué glifos quitar. Devuelve los
 * reemplazos a aplicar sobre los bytes originales y el nivel de q/Q sin cerrar.
 */
function planErase(ops: ContentOp[], res: Resources, targets: Target[]): { rewrites: Rewrite[]; openSaves: number } {
  const fontCache = new Map<string, FontMetrics | null>();
  const formCache = new Map<PDFRawStream, boolean>();
  const getFont = (name: string): FontMetrics | null => {
    if (!fontCache.has(name)) {
      const dict = res.fonts?.lookup(PDFName.of(name));
      let metrics: FontMetrics | null = null;
      try {
        metrics = dict instanceof PDFDict ? fontMetrics(dict) : null;
      } catch {
        metrics = null;
      }
      fontCache.set(name, metrics);
    }
    return fontCache.get(name) ?? null;
  };

  const markUnclean = (box: Box) => {
    for (const t of targets) if (overlaps(box, t.outer)) t.clean = false;
  };
  const markAllUnclean = () => targets.forEach((t) => (t.clean = false));

  let gs: GState = {
    ctm: IDENTITY,
    font: null,
    fontSize: 0,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 1,
    leading: 0,
    rise: 0,
    renderMode: 0,
  };
  // La fuente se recuerda aparte del objeto de métricas: Tf con una fuente no soportada deja font = null.
  let fontSet = false;
  const stack: { gs: GState; fontSet: boolean }[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let posKnown = true;
  // Operandos mal formados en cm/Tm: la geometría deja de ser fiable y no se quita nada más.
  let broken = false;
  const rewrites: Rewrite[] = [];

  const nextLine = (tx: number, ty: number) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
  };

  for (const op of ops) {
    const a = op.operands;
    switch (op.op) {
      case "q":
        stack.push({ gs: { ...gs }, fontSet });
        break;
      case "Q": {
        const prev = stack.pop();
        if (prev) ({ gs, fontSet } = prev);
        break;
      }
      case "cm":
        if (a.length === 6 && a.every((o) => o.t === "num")) gs.ctm = mul(a.map(operandNum) as Matrix, gs.ctm);
        else broken = true;
        break;
      case "BT":
        tm = tlm = IDENTITY;
        posKnown = true;
        break;
      case "Tm":
        if (a.length === 6 && a.every((o) => o.t === "num")) {
          tm = tlm = a.map(operandNum) as Matrix;
          posKnown = true;
        } else broken = true;
        break;
      case "Td":
        nextLine(operandNum(a[0]), operandNum(a[1]));
        break;
      case "TD":
        gs.leading = -operandNum(a[1]);
        nextLine(operandNum(a[0]), operandNum(a[1]));
        break;
      case "T*":
        nextLine(0, -gs.leading);
        break;
      case "TL":
        gs.leading = operandNum(a[0]);
        break;
      case "Tc":
        gs.charSpacing = operandNum(a[0]);
        break;
      case "Tw":
        gs.wordSpacing = operandNum(a[0]);
        break;
      case "Tz":
        gs.hScale = operandNum(a[0]) / 100;
        break;
      case "Ts":
        gs.rise = operandNum(a[0]);
        break;
      case "Tr":
        gs.renderMode = operandNum(a[0]);
        break;
      case "Tf":
        gs.font = a[0]?.t === "name" ? getFont(a[0].v) : null;
        gs.fontSize = operandNum(a[1]);
        fontSet = true;
        break;
      case "gs": {
        const ext = a[0]?.t === "name" ? res.extGStates?.lookup(PDFName.of(a[0].v)) : undefined;
        if (ext instanceof PDFDict && ext.has(PDFName.of("Font"))) {
          // Fuente fijada desde un ExtGState: no la seguimos.
          gs.font = null;
          fontSet = true;
        }
        break;
      }
      case "Do": {
        const xobj = a[0]?.t === "name" ? res.xobjects?.lookup(PDFName.of(a[0].v)) : undefined;
        if (!(xobj instanceof PDFRawStream)) break;
        if (xobj.dict.lookup(PDFName.of("Subtype"))?.toString() !== "/Form") break;
        if (!formMayHaveText(xobj, formCache)) break;
        // El texto dentro del formulario no se toca: los bloques que alcance se siguen tapando.
        const bbox = xobj.dict.lookup(PDFName.of("BBox"));
        const matrix = xobj.dict.lookup(PDFName.of("Matrix"));
        const nums = (arr: PDFObject | undefined, len: number) =>
          arr instanceof PDFArray && arr.size() === len ? arr.asArray().map((_, i) => num(arr.lookup(i)) ?? 0) : null;
        const bb = nums(bbox, 4);
        if (!bb) {
          markAllUnclean();
          break;
        }
        const m = mul((nums(matrix, 6) as Matrix | null) ?? IDENTITY, gs.ctm);
        markUnclean(boxOf([apply(m, bb[0], bb[1]), apply(m, bb[2], bb[1]), apply(m, bb[0], bb[3]), apply(m, bb[2], bb[3])]));
        break;
      }
      case "Tj":
      case "TJ":
      case "'":
      case '"': {
        let prefix = "";
        if (op.op === "'") {
          nextLine(0, -gs.leading);
          prefix = "T*\n";
        } else if (op.op === '"') {
          gs.wordSpacing = operandNum(a[0]);
          gs.charSpacing = operandNum(a[1]);
          nextLine(0, -gs.leading);
          prefix = `${fmt(gs.wordSpacing)} Tw ${fmt(gs.charSpacing)} Tc T*\n`;
        }
        const arg = op.op === "TJ" ? a[0] : op.op === '"' ? a[2] : a[0];
        const elements: Operand[] = op.op === "TJ" ? (arg?.t === "arr" ? arg.items : []) : arg ? [arg] : [];
        const rw = showText(elements);
        if (rw !== null) rewrites.push({ start: op.start, end: op.end, text: prefix + rw });
        break;
      }
    }
  }

  /**
   * Avanza la matriz de texto por los elementos de un operador de texto y quita
   * los glifos que caen dentro de algún bloque. Devuelve el TJ de reemplazo, o
   * null si el operador queda como estaba.
   */
  function showText(elements: Operand[]): string | null {
    const font = gs.font;
    const fs = gs.fontSize;
    const canMeasure =
      !broken &&
      posKnown && fontSet && font !== null && fs !== 0 && elements.every((e) => e.t === "num" || e.t === "str");

    if (!canMeasure) {
      // Sin geometría fiable: lo que esté en esa línea no se puede dar por borrado.
      if (posKnown && !broken) {
        const m = mul(tm, gs.ctm);
        const [x, y] = apply(m, 0, gs.rise);
        const size = Math.abs(fs) * Math.hypot(m[2], m[3]) || 12;
        markUnclean({ x1: x - size, x2: Infinity, y1: y - size, y2: y + size });
      } else markAllUnclean();
      posKnown = false;
      return null;
    }

    // Una pasada en seco: si algún código no tiene ancho, no se toca nada.
    interface Glyph {
      bytes: Uint8Array;
      code: number;
      advance: number; // en espacio de texto, antes de la escala horizontal
      remove: boolean;
    }
    type Piece = { kind: "num"; v: number } | { kind: "glyphs"; glyphs: Glyph[] };
    const pieces: Piece[] = [];
    const n = font.bytesPerCode;
    for (const el of elements) {
      if (el.t === "num") {
        pieces.push({ kind: "num", v: el.v });
        continue;
      }
      if (el.t !== "str") continue;
      if (el.bytes.length % n !== 0) {
        markUnclean({ x1: -Infinity, x2: Infinity, y1: -Infinity, y2: Infinity });
        posKnown = false;
        return null;
      }
      const glyphs: Glyph[] = [];
      for (let i = 0; i < el.bytes.length; i += n) {
        const code = n === 1 ? el.bytes[i] : (el.bytes[i] << 8) | el.bytes[i + 1];
        const w = font.width(code);
        if (w === undefined) {
          posKnown = false;
          markAllUnclean();
          return null;
        }
        glyphs.push({ bytes: el.bytes.subarray(i, i + n), code, advance: w, remove: false });
      }
      pieces.push({ kind: "glyphs", glyphs });
    }

    const th = gs.hScale;
    const removable = gs.renderMode < 4; // los modos 4-7 recortan: quitarlos cambiaría el recorte
    const invisible = gs.renderMode === 3 || gs.renderMode === 7;
    let anyRemoved = false;

    for (const piece of pieces) {
      if (piece.kind === "num") {
        tm = mul([1, 0, 0, 1, (-piece.v / 1000) * fs * th, 0], tm);
        continue;
      }
      for (const g of piece.glyphs) {
        const w0 = g.advance / 1000;
        const trm = mul(mul([fs * th, 0, 0, fs, 0, gs.rise], tm), gs.ctm);
        // Caja conservadora del glifo: de la línea base a media altura.
        const corners: [number, number][] = [apply(trm, 0, 0), apply(trm, w0, 0), apply(trm, 0, 0.5), apply(trm, w0, 0.5)];
        const box = boxOf(corners);
        const target = removable ? targets.find((t) => corners.every((p) => inBox(t.outer, p))) : undefined;
        if (target) {
          g.remove = true;
          anyRemoved = true;
          target.removed++;
          // Texto invisible (capa OCR): lo que se ve es otra cosa, el tapado sigue haciendo falta.
          if (invisible) target.clean = false;
        } else {
          for (const t of targets) if (overlaps(box, t.core)) t.clean = false;
        }
        const isSpace = n === 1 && g.code === 32;
        const tx = (w0 * fs + gs.charSpacing + (isSpace ? gs.wordSpacing : 0)) * th;
        tm = mul([1, 0, 0, 1, tx, 0], tm);
      }
    }
    if (!anyRemoved) return null;

    // Reescritura: los glifos que quedan se copian tal cual; los quitados se
    // cambian por un desplazamiento TJ que avanza exactamente lo mismo.
    const out: string[] = [];
    let pending = 0;
    const flushNum = () => {
      if (pending !== 0) out.push(fmt(pending));
      pending = 0;
    };
    for (const piece of pieces) {
      if (piece.kind === "num") {
        pending += piece.v;
        continue;
      }
      let run: Uint8Array[] = [];
      const flushRun = () => {
        if (!run.length) return;
        flushNum();
        const bytes = new Uint8Array(run.reduce((s, b) => s + b.length, 0));
        let o = 0;
        for (const b of run) {
          bytes.set(b, o);
          o += b.length;
        }
        out.push(hex(bytes));
        run = [];
      };
      for (const g of piece.glyphs) {
        if (g.remove) {
          flushRun();
          const isSpace = n === 1 && g.code === 32;
          const advance = (g.advance / 1000) * fs + gs.charSpacing + (isSpace ? gs.wordSpacing : 0);
          pending += (-advance * 1000) / fs;
        } else run.push(g.bytes);
      }
      flushRun();
    }
    flushNum();
    return `[${out.join(" ")}] TJ`;
  }

  if (broken) markAllUnclean();
  return { rewrites, openSaves: stack.length };
}

/** Referencias a flujos de contenido de una página (el propio /Contents, si es indirecto, y sus elementos). */
function contentRefs(page: PDFPage): { refs: PDFRef[]; streams: (PDFObject | undefined)[] } {
  const raw = page.node.get(PDFName.of("Contents"));
  const refs: PDFRef[] = [];
  const streams: (PDFObject | undefined)[] = [];
  if (!raw) return { refs, streams };
  const resolved = raw instanceof PDFRef ? page.doc.context.lookup(raw) : raw;
  if (raw instanceof PDFRef) refs.push(raw);
  if (resolved instanceof PDFArray) {
    for (let i = 0; i < resolved.size(); i++) {
      const item = resolved.get(i);
      if (item instanceof PDFRef) refs.push(item);
      streams.push(resolved.lookup(i));
    }
  } else if (resolved) streams.push(resolved);
  return { refs, streams };
}

/**
 * Quita del flujo de contenido los glifos de los bloques indicados. Devuelve
 * los ids de los bloques que quedaron completamente borrados; el resto debe
 * seguir tapándose. Debe llamarse antes de dibujar nada con pdf-lib en esas
 * páginas: al dibujar, pdf-lib agrega flujos propios (compartidos entre páginas)
 * al /Contents, y estos no deben reescribirse ni eliminarse.
 */
export function eraseOriginalText(doc: PDFDocument, blocksByPage: Map<number, TextBlock[]>): Set<string> {
  const erased = new Set<string>();
  if (doc.isEncrypted) return erased;
  const pages = doc.getPages();
  const encoder = new TextEncoder();

  for (const [pageIndex, blocks] of blocksByPage) {
    const page = pages[pageIndex];
    if (!page || !blocks.length) continue;
    try {
      const { refs, streams } = contentRefs(page);
      const parts: Uint8Array[] = [];
      for (const s of streams) {
        const data = decodeStream(s);
        if (!data) throw new Error("Flujo de contenido no soportado");
        parts.push(data, Uint8Array.of(10));
      }
      const data = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
      let offset = 0;
      for (const p of parts) {
        data.set(p, offset);
        offset += p.length;
      }

      const resources = page.node.Resources();
      const res: Resources = {
        fonts: resources?.lookupMaybe(PDFName.of("Font"), PDFDict),
        xobjects: resources?.lookupMaybe(PDFName.of("XObject"), PDFDict),
        extGStates: resources?.lookupMaybe(PDFName.of("ExtGState"), PDFDict),
      };
      const targets = blocks.map(makeTarget);
      const { rewrites, openSaves } = planErase(parseContent(data), res, targets);
      if (!rewrites.length) continue;

      // Bytes originales con los operadores reemplazados, todo envuelto en q/Q
      // para que lo que se dibuje después no herede transformaciones sin cerrar.
      const out: Uint8Array[] = [encoder.encode("q\n")];
      let pos = 0;
      for (const r of rewrites) {
        out.push(data.subarray(pos, r.start), encoder.encode(r.text));
        pos = r.end;
      }
      out.push(data.subarray(pos), encoder.encode("\n" + "Q\n".repeat(openSaves + 1)));
      const total = new Uint8Array(out.reduce((s, p) => s + p.length, 0));
      offset = 0;
      for (const p of out) {
        total.set(p, offset);
        offset += p.length;
      }

      page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.flateStream(total)));

      // Los flujos viejos quedarían huérfanos dentro del archivo con el texto
      // original: se eliminan si ninguna otra página los usa.
      const shared = new Set<string>();
      pages.forEach((p, i) => {
        if (i !== pageIndex) contentRefs(p).refs.forEach((r) => shared.add(r.toString()));
      });
      for (const ref of refs) if (!shared.has(ref.toString())) doc.context.delete(ref);

      for (const t of targets) if (t.clean && t.removed > 0) erased.add(t.block.id);
    } catch (err) {
      console.warn(`No se pudo reescribir el contenido de la página ${pageIndex + 1}; se usa el tapado.`, err);
    }
  }
  return erased;
}
