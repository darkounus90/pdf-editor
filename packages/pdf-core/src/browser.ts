/**
 * Partes del motor que necesitan el navegador (canvas, document, worker de pdf.js).
 * El resto de @pdf-editor/pdf-core no toca el DOM y corre también en Node.
 */
import * as pdfjs from "pdfjs-dist";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import { enrichFromPixels } from "./analyze";
import { configurePdfjs } from "./pdfjs";
import type { TextBlock } from "./types";

export interface BrowserPdfjsOptions {
  /** URL de la carpeta con los assets de pdf.js (cmaps, standard_fonts, wasm, iccs). */
  assetsUrl?: string;
  /** URL del worker; por defecto `${assetsUrl}pdf.worker.min.mjs`. */
  workerSrc?: string;
}

/** Configura pdf.js con su worker. Se puede llamar varias veces. */
export function setupBrowserPdfjs({ assetsUrl = "/pdfjs/", workerSrc }: BrowserPdfjsOptions = {}) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc ?? `${assetsUrl}pdf.worker.min.mjs`;
  configurePdfjs({ lib: pdfjs, assetsUrl });
}

export interface RenderHandle {
  viewport: PageViewport;
  promise: Promise<void>;
  cancel: () => void;
}

export function renderToCanvas(page: PDFPageProxy, canvas: HTMLCanvasElement, scale: number): RenderHandle {
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const task = page.render({ canvas, viewport });
  return { viewport, promise: task.promise, cancel: () => task.cancel() };
}

/** Completa fuente real y colores de los bloques una vez renderizada la página. */
export function enrichBlocks(
  page: PDFPageProxy,
  blocks: TextBlock[],
  canvas: HTMLCanvasElement,
  viewport: PageViewport,
): TextBlock[] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || canvas.width === 0) return blocks;
  return enrichFromPixels(page, blocks, ctx.getImageData(0, 0, canvas.width, canvas.height), viewport);
}

/** Renderiza una página fuera de pantalla para enriquecer sus bloques (p. ej. antes de exportar). */
export async function enrichOffscreen(page: PDFPageProxy, blocks: TextBlock[]): Promise<TextBlock[]> {
  const canvas = document.createElement("canvas");
  const handle = renderToCanvas(page, canvas, 1.5);
  await handle.promise;
  return enrichBlocks(page, blocks, canvas, handle.viewport);
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, font: string): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 8;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
