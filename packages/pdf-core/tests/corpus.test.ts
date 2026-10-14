import { describe, expect, it } from "vitest";
import { blockToObject, exportPdf, type TextObject } from "../src";
import { corpusFiles, loadBlocks, readCorpus } from "./helpers";

/**
 * Prueba de humo sobre todos los PDFs de tests/corpus: en cada página se edita
 * el primer bloque, se exporta y se vuelve a abrir. El texto nuevo debe estar,
 * el original debe desaparecer (salvo que el exportador avise que solo lo tapó)
 * y ningún otro bloque debe perderse.
 */
describe.each(corpusFiles())("corpus: %s", (file) => {
  it("edita el primer bloque de cada página sin dañar el resto", async () => {
    const original = readCorpus(file);
    const pages = await loadBlocks(original);
    const targets = pages.map((p) => p[0]).filter((b) => b !== undefined);
    if (!targets.length) return; // PDF sin texto (escaneado): no hay nada que editar.

    const marker = (i: number) => `CORPUS EDIT ${i}`;
    const objects: TextObject[] = targets.map((b, i) => blockToObject(b, { text: marker(i) }));
    const { bytes, coveredBlocks } = await exportPdf(original, objects);

    const before = pages.flat().map((b) => b.text);
    const after = (await loadBlocks(bytes)).flat().map((b) => b.text);
    targets.forEach((_, i) => expect(after).toContain(marker(i)));

    // Cuenta cuántas veces aparece cada texto para tolerar líneas repetidas (encabezados, pies).
    const count = (list: string[]) => list.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>());
    const afterCount = count(after);
    const expected = count(before);
    for (const t of targets) expected.set(t.text, expected.get(t.text)! - 1);
    for (const [text, n] of expected) {
      const found = afterCount.get(text) ?? 0;
      if (coveredBlocks === 0) expect(found, `"${text}"`).toBe(n);
      else expect(found, `"${text}"`).toBeGreaterThanOrEqual(n);
    }
  });
});
