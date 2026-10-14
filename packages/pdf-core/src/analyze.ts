import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { getPdfjs } from "./pdfjs";
import type { DocInfo, Family, RGB, TextBlock } from "./types";

export class PdfPasswordError extends Error {}

export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const { lib, assetsUrl: ASSETS } = getPdfjs();
  const task = lib.getDocument({
    // pdf.js transfiere (y deja inutilizable) el buffer: le pasamos una copia.
    data: bytes.slice(),
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
    // Conserva nombre real, negrita/cursiva y serif/mono de cada fuente.
    fontExtraProperties: true,
  });
  task.onPassword = () => {
    task.destroy();
  };
  try {
    return await task.promise;
  } catch (err) {
    if (err instanceof Error && err.name === "PasswordException") {
      throw new PdfPasswordError("El PDF está protegido con contraseña.");
    }
    throw err;
  }
}

function formatPdfDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = getPdfjs().lib.PDFDateString.toDateObject(value);
  return date ? date.toLocaleString("es") : value;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function readDocInfo(pdf: PDFDocumentProxy, fileName: string, fileSize: number): Promise<DocInfo> {
  const { info } = await pdf.getMetadata();
  const meta = info as Record<string, unknown>;

  const pages = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    pages.push({ index: i, width: vp.width, height: vp.height, rotation: page.rotate });
  }

  let formFields = 0;
  try {
    const fields = await pdf.getFieldObjects();
    formFields = fields ? Object.keys(fields).length : 0;
  } catch {
    // Algunos PDFs dañados fallan aquí; no es crítico.
  }

  return {
    fileName,
    fileSize,
    numPages: pdf.numPages,
    pdfVersion: str(meta.PDFFormatVersion),
    title: str(meta.Title),
    author: str(meta.Author),
    subject: str(meta.Subject),
    creator: str(meta.Creator),
    producer: str(meta.Producer),
    creationDate: formatPdfDate(meta.CreationDate),
    modDate: formatPdfDate(meta.ModDate),
    encrypted: Boolean(meta.EncryptFilterName),
    formFields,
    pages,
  };
}

function familyFromCss(cssFamily: string | undefined): Family {
  const f = (cssFamily ?? "").toLowerCase();
  if (f.includes("mono")) return "mono";
  if (f.includes("sans")) return "sans";
  if (f.includes("serif")) return "serif";
  return "sans";
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Agrupa los fragmentos de texto de pdf.js en líneas editables. Dos fragmentos se
 * unen si comparten fuente, tamaño y línea base y están cerca horizontalmente;
 * así las columnas y celdas de tablas quedan como bloques separados.
 */
export async function extractBlocks(page: PDFPageProxy, pageIndex: number): Promise<TextBlock[]> {
  const content = await page.getTextContent();
  const blocks: TextBlock[] = [];
  let cur: (TextBlock & { endX: number }) | null = null;

  const flush = () => {
    if (cur) {
      cur.text = cur.text.trimEnd();
      if (cur.text.trim()) {
        const { endX: _endX, ...block } = cur;
        blocks.push({ ...block, id: `p${pageIndex}-b${blocks.length}` });
      }
    }
    cur = null;
  };

  for (const raw of content.items) {
    if (!("str" in raw)) continue;
    const item = raw as TextItem;
    const [a, b, c, d, e, f] = item.transform as number[];

    // Solo texto horizontal sin rotar (el caso de la gran mayoría de documentos).
    if (Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3 || a <= 0 || d <= 0) {
      flush();
      continue;
    }
    const fontSize = d;
    const isBlank = item.str.trim() === "";

    if (!item.str) {
      if (item.hasEOL) flush();
      continue;
    }

    const c0 = cur as (TextBlock & { endX: number }) | null;
    const sameLine = c0 !== null && Math.abs(c0.y - f) < 0.25 * c0.fontSize;
    const gap = c0 ? e - c0.endX : 0;
    const near = c0 !== null && gap > -0.5 * c0.fontSize && gap < 1.2 * c0.fontSize;

    // pdf.js rellena con un espacio los huecos entre columnas: un espacio
    // más ancho que un par de caracteres separa bloques en vez de unirlos.
    if (isBlank && item.width > 0.9 * fontSize) {
      flush();
    } else if (c0 && sameLine && near && isBlank) {
      if (!c0.text.endsWith(" ")) c0.text += " ";
      c0.endX = Math.max(c0.endX, e + item.width);
    } else if (
      c0 &&
      sameLine &&
      near &&
      c0.fontRef === item.fontName &&
      Math.abs(c0.fontSize - fontSize) < 0.05 * fontSize
    ) {
      if (gap > 0.18 * fontSize && !c0.text.endsWith(" ") && !item.str.startsWith(" ")) c0.text += " ";
      c0.text += item.str;
      c0.endX = Math.max(c0.endX, e + item.width);
      c0.width = c0.endX - c0.x;
    } else if (!isBlank) {
      flush();
      const style = content.styles[item.fontName];
      const ascent = clamp(style?.ascent || (style?.descent ? 1 + style.descent : 0.8), 0.5, 1.1);
      const descent = clamp(style?.descent || -0.2, -0.45, 0);
      cur = {
        id: "",
        pageIndex,
        text: item.str,
        x: e,
        y: f,
        width: item.width,
        endX: e + item.width,
        fontSize,
        ascent,
        descent,
        fontRef: item.fontName,
        fontName: "",
        family: familyFromCss(style?.fontFamily),
        bold: false,
        italic: false,
        color: [0, 0, 0],
        bgColor: [1, 1, 1],
        enriched: false,
      };
    }
    if (item.hasEOL) flush();
  }
  flush();
  return blocks;
}

/** Convierte un rectángulo PDF [x1, y1, x2, y2] a coordenadas del viewport. */
export function toViewportRect(viewport: PageViewport, [x1, y1, x2, y2]: number[]): number[] {
  const [a, b] = viewport.convertToViewportPoint(x1, y1);
  const [c, d] = viewport.convertToViewportPoint(x2, y2);
  return [a, b, c, d];
}

/** Píxeles RGBA de un render (compatible con el ImageData del navegador y con node-canvas). */
export interface PixelData {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

interface FontExtra {
  name?: string;
  bold?: boolean;
  black?: boolean;
  italic?: boolean;
  isSerifFont?: boolean;
  isMonospace?: boolean;
}

function readFont(page: PDFPageProxy, ref: string): FontExtra | null {
  try {
    return page.commonObjs.has(ref) ? (page.commonObjs.get(ref) as FontExtra) : null;
  } catch {
    return null;
  }
}

/** Distancia euclídea entre dos colores RGB 0..255. */
const dist = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) =>
  Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

const median = (values: number[]) => {
  const s = [...values].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] ?? 255;
};

/**
 * Estima el color del texto y del fondo leyendo los píxeles del render:
 * el fondo es la mediana de un anillo alrededor del bloque y el texto el
 * promedio de los píxeles más alejados de ese fondo.
 */
function sampleColors(img: PixelData, viewport: PageViewport, b: TextBlock): { color: RGB; bgColor: RGB } {
  const { width: W, height: H, data } = img;
  const [x1, y1, x2, y2] = toViewportRect(viewport, [
    b.x,
    b.y + b.descent * b.fontSize,
    b.x + b.width,
    b.y + b.ascent * b.fontSize,
  ]);
  const left = Math.max(0, Math.floor(Math.min(x1, x2)));
  const right = Math.min(W - 1, Math.ceil(Math.max(x1, x2)));
  const top = Math.max(0, Math.floor(Math.min(y1, y2)));
  const bottom = Math.min(H - 1, Math.ceil(Math.max(y1, y2)));
  if (right <= left || bottom <= top) return { color: [0, 0, 0], bgColor: [1, 1, 1] };

  const px = (x: number, y: number) => (y * W + x) * 4;
  const m = Math.max(2, Math.round((bottom - top) * 0.12));

  const ring: number[][] = [[], [], []];
  const pushRing = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = px(x, y);
    ring[0].push(data[i]);
    ring[1].push(data[i + 1]);
    ring[2].push(data[i + 2]);
  };
  const stepX = Math.max(1, Math.floor((right - left) / 120));
  for (let x = left - m; x <= right + m; x += stepX) {
    pushRing(x, top - m);
    pushRing(x, bottom + m);
  }
  for (let y = top - m; y <= bottom + m; y += 2) {
    pushRing(left - m, y);
    pushRing(right + m, y);
  }
  const bg = ring[0].length ? [median(ring[0]), median(ring[1]), median(ring[2])] : [255, 255, 255];

  const area = (right - left) * (bottom - top);
  const step = Math.max(1, Math.floor(Math.sqrt(area / 6000)));
  let maxD = 0;
  const samples: [number, number, number, number][] = [];
  for (let y = top; y <= bottom; y += step) {
    for (let x = left; x <= right; x += step) {
      const i = px(x, y);
      const d = dist(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]);
      if (d > 20) samples.push([data[i], data[i + 1], data[i + 2], d]);
      if (d > maxD) maxD = d;
    }
  }

  const bgColor = bg.map((v) => v / 255) as RGB;
  if (maxD < 25 || samples.length === 0) {
    const light = bg[0] + bg[1] + bg[2] > 382;
    return { color: light ? [0, 0, 0] : [1, 1, 1], bgColor };
  }
  let r = 0, g = 0, bl = 0, n = 0;
  for (const [sr, sg, sb, d] of samples) {
    if (d >= maxD * 0.75) {
      r += sr; g += sg; bl += sb; n++;
    }
  }
  return { color: [r / n / 255, g / n / 255, bl / n / 255], bgColor };
}

/**
 * Completa fuente real y colores de los bloques a partir del render de la página
 * (`img` debe corresponder a `viewport`). El canvas lo pone cada entorno.
 */
export function enrichFromPixels(
  page: PDFPageProxy,
  blocks: TextBlock[],
  img: PixelData,
  viewport: PageViewport,
): TextBlock[] {
  return blocks.map((b) => {
    const font = readFont(page, b.fontRef);
    const name = (font?.name ?? "").replace(/^[A-Z]{6}\+/, "");
    const bold = Boolean(font?.bold || font?.black) || /bold|black|heavy|semibold|demi/i.test(name);
    const italic = Boolean(font?.italic) || /italic|oblique/i.test(name);
    let family = b.family;
    if (font?.isMonospace || /courier|mono|consol/i.test(name)) family = "mono";
    else if (/sans|arial|helvetica|calibri|verdana|segoe|roboto/i.test(name)) family = "sans";
    else if (font?.isSerifFont || /times|georgia|garamond|serif|cambria|roman|book/i.test(name)) family = "serif";

    return { ...b, fontName: name, bold, italic, family, ...sampleColors(img, viewport, b), enriched: true };
  });
}
