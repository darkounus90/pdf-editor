import { describe, expect, it } from "vitest";
import { addedToObject, blockToObject, exportPdf, type BlockEdit, type TextBlock, type TextObject } from "../src";
import { findBlock, loadBlocks, pageText, readCorpus } from "./helpers";

const edited = (b: TextBlock, edit: BlockEdit): TextObject => blockToObject(b, edit);

describe("exportar → reabrir (ejemplo.pdf)", () => {
  const original = readCorpus("ejemplo.pdf");

  it("escribe el texto editado, borra el original y deja intacto el resto de la línea", async () => {
    const pages = await loadBlocks(original);
    const fecha = findBlock(pages, "Fecha: 14 de octubre de 2026");

    const result = await exportPdf(original, [edited(fecha, { text: "Fecha: 15 de noviembre de 2026" })]);
    expect(result.coveredBlocks).toBe(0);
    expect(result.replacedChars).toBe(0);

    const text = await pageText(result.bytes, 0);
    expect(text).toContain("Fecha: 15 de noviembre de 2026");
    expect(text).not.toContain("14 de octubre");
    expect(text).toContain("Válida hasta: 30 de octubre de 2026");
    expect(text).toContain("Cliente: Juan Pérez");
  });

  it("borra una celda sin tocar las demás de la fila", async () => {
    const pages = await loadBlocks(original);
    const valor = findBlock(pages, "$ 2.500.000");

    const result = await exportPdf(original, [edited(valor, { text: "$ 3.100.000" })]);
    expect(result.coveredBlocks).toBe(0);

    const after = (await loadBlocks(result.bytes))[0].map((b) => b.text);
    expect(after).toContain("$ 3.100.000");
    expect(after).not.toContain("$ 2.500.000");
    expect(after).toContain("Diseño de interfaz");
    expect(after).toContain("$ 4.800.000");
  });

  it("elimina un bloque y conserva el resto del documento", async () => {
    const pages = await loadBlocks(original);
    const nota = findBlock(pages, "Nota: el anticipo del 50% se cancela al firmar la propuesta.");

    const result = await exportPdf(original, [edited(nota, { deleted: true })]);
    expect(result.coveredBlocks).toBe(0);

    const after = await loadBlocks(result.bytes);
    const texts = after.flat().map((b) => b.text);
    expect(texts.some((t) => t.includes("anticipo del 50%"))).toBe(false);
    const expected = pages.flat().filter((b) => b.id !== nota.id).map((b) => b.text);
    expect(texts.sort()).toEqual(expected.sort());
  });

  it("agrega texto nuevo y reemplaza los caracteres que la fuente estándar no tiene", async () => {
    const result = await exportPdf(original, [
      addedToObject({
        id: "new-1",
        pageIndex: 1,
        x: 50,
        y: 200,
        text: "Aprobado ✓",
        fontSize: 12,
        family: "sans",
        bold: true,
        italic: false,
        color: [0, 0.4, 0],
      }),
    ]);
    expect(result.replacedChars).toBe(1);
    expect(await pageText(result.bytes, 1)).toContain("Aprobado ?");
  });
});
