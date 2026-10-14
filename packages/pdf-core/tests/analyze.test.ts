import { describe, expect, it } from "vitest";
import { extractBlocks, openPdf, readDocInfo, type PDFPageProxy } from "../src";
import { findBlock, loadBlocks, readCorpus } from "./helpers";

describe("extracción de ejemplo.pdf", () => {
  const bytes = readCorpus("ejemplo.pdf");

  it("lee los metadatos y las páginas", async () => {
    const pdf = await openPdf(bytes);
    const info = await readDocInfo(pdf, "ejemplo.pdf", bytes.byteLength);
    await pdf.loadingTask.destroy();
    expect(info.numPages).toBe(2);
    expect(info.title).toBe("Cotización de servicios");
    expect(info.author).toBe("Empresa Demo S.A.S.");
    expect(info.pages[0].width).toBeCloseTo(595.28, 1);
    expect(info.pages[0].height).toBeCloseTo(841.89, 1);
  });

  it("separa en bloques distintos las columnas de una misma línea", async () => {
    const pages = await loadBlocks(bytes);
    const fecha = findBlock(pages, "Fecha: 14 de octubre de 2026");
    const valida = findBlock(pages, "Válida hasta: 30 de octubre de 2026");
    expect(fecha.id).not.toBe(valida.id);
    expect(fecha.y).toBeCloseTo(valida.y, 1);
    expect(fecha.x).toBeCloseTo(50, 1);
    expect(valida.x).toBeCloseTo(330, 1);
    expect(fecha.x + fecha.width).toBeLessThan(valida.x);
  });

  it("deja cada celda de la tabla como un bloque", async () => {
    const texts = (await loadBlocks(bytes))[0].map((b) => b.text);
    for (const cell of ["Concepto", "Cantidad", "Valor", "Diseño de interfaz", "$ 2.500.000", "Hosting anual"]) {
      expect(texts).toContain(cell);
    }
  });

  it("mantiene unidas las líneas de un párrafo", async () => {
    const pages = await loadBlocks(bytes);
    const line = findBlock(pages, "Estimado cliente, a continuación presentamos la propuesta económica para el");
    expect(line.fontSize).toBeCloseTo(12, 1);
    expect(line.family).toBe("serif");
    expect(pages[1].map((b) => b.text)).toContain("Condiciones generales");
  });
});

describe("agrupación de fragmentos", () => {
  // Página falsa: solo lo que extractBlocks usa de pdf.js.
  const fakePage = (items: object[]) =>
    ({
      getTextContent: async () => ({
        items,
        styles: { f1: { fontFamily: "sans-serif", ascent: 0.9, descent: -0.2, vertical: false } },
      }),
    }) as unknown as PDFPageProxy;
  const item = (str: string, x: number, width: number, extra: object = {}) => ({
    str,
    dir: "ltr",
    transform: [11, 0, 0, 11, x, 700],
    width,
    height: 11,
    fontName: "f1",
    hasEOL: false,
    ...extra,
  });

  it("un espacio más ancho que un par de caracteres separa columnas", async () => {
    const blocks = await extractBlocks(
      fakePage([item("Fecha: 14", 50, 50), item(" ", 100, 230), item("Válida hasta: 30", 330, 90, { hasEOL: true })]),
      0,
    );
    expect(blocks.map((b) => b.text)).toEqual(["Fecha: 14", "Válida hasta: 30"]);
    expect(blocks.map((b) => b.id)).toEqual(["p0-b0", "p0-b1"]);
  });

  it("un espacio normal une las palabras de la misma línea", async () => {
    const blocks = await extractBlocks(fakePage([item("Hola", 50, 22), item(" ", 72, 3), item("mundo", 75, 30)]), 0);
    expect(blocks.map((b) => b.text)).toEqual(["Hola mundo"]);
    expect(blocks[0].width).toBeCloseTo(55, 5);
  });

  it("un hueco grande sin espacio también separa bloques", async () => {
    const blocks = await extractBlocks(fakePage([item("Cantidad", 330, 45), item("Valor", 440, 28)]), 0);
    expect(blocks.map((b) => b.text)).toEqual(["Cantidad", "Valor"]);
  });
});
