import type * as PdfjsModule from "pdfjs-dist";

/** Módulo de pdf.js: `pdfjs-dist` en el navegador o `pdfjs-dist/legacy/build/pdf.mjs` en Node. */
export type PdfjsLib = typeof PdfjsModule;

export interface PdfjsConfig {
  lib: PdfjsLib;
  /**
   * Carpeta (URL en el navegador, ruta en Node) con `cmaps/`, `standard_fonts/`,
   * `wasm/` e `iccs/` de pdfjs-dist. Debe terminar en "/".
   */
  assetsUrl: string;
}

let config: PdfjsConfig | null = null;

/**
 * El núcleo no importa pdf.js directamente: cada entorno le pasa su build. Así
 * el mismo código corre en el navegador (con worker) y en Node (build legacy).
 */
export function configurePdfjs(next: PdfjsConfig) {
  config = next;
}

export function getPdfjs(): PdfjsConfig {
  if (!config) throw new Error("pdf.js no está configurado: llama a configurePdfjs() (o setupBrowserPdfjs()) antes.");
  return config;
}
