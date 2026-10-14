import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { configurePdfjs, extractBlocks, openPdf, type PdfjsLib, type TextBlock } from "../src";

// En Node se usa el build legacy de pdf.js (sin worker real) y los assets salen de node_modules.
const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
configurePdfjs({ lib: pdfjs as unknown as PdfjsLib, assetsUrl: `${pdfjsRoot.replaceAll("\\", "/")}/` });

export const corpusDir = fileURLToPath(new URL("./corpus/", import.meta.url));

export const corpusFiles = () => readdirSync(corpusDir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();

export const readCorpus = (name: string) => new Uint8Array(readFileSync(join(corpusDir, name)));

/** Abre el PDF y agrupa el texto de todas sus páginas en bloques, como hace el editor. */
export async function loadBlocks(bytes: Uint8Array): Promise<TextBlock[][]> {
  const pdf = await openPdf(bytes);
  try {
    const pages: TextBlock[][] = [];
    for (let i = 0; i < pdf.numPages; i++) pages.push(await extractBlocks(await pdf.getPage(i + 1), i));
    return pages;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** Texto de una página según getTextContent, una línea por cada fin de línea que reporta pdf.js. */
export async function pageText(bytes: Uint8Array, pageIndex: number): Promise<string> {
  const pdf = await openPdf(bytes);
  try {
    const content = await (await pdf.getPage(pageIndex + 1)).getTextContent();
    return content.items
      .filter((it): it is TextItem => "str" in it)
      .map((it) => it.str + (it.hasEOL ? "\n" : ""))
      .join("");
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export function findBlock(pages: TextBlock[][], text: string): TextBlock {
  const block = pages.flat().find((b) => b.text === text);
  if (!block) throw new Error(`No se encontró el bloque "${text}"`);
  return block;
}
