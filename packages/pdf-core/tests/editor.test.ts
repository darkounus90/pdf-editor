import { describe, expect, it } from "vitest";
import {
  blockToObject,
  countChanges,
  deleteObject,
  emptyState,
  historyReducer,
  initialHistory,
  patchObject,
  replaceAll,
  restoreBlock,
  type EditState,
  type History,
  type TextBlock,
} from "../src";

const block = (id: string, text: string, pageIndex = 0): TextBlock => ({
  id,
  pageIndex,
  text,
  x: 50,
  y: 700,
  width: 100,
  fontSize: 12,
  ascent: 0.9,
  descent: -0.2,
  fontRef: "f1",
  fontName: "Helvetica",
  family: "sans",
  bold: false,
  italic: false,
  color: [0, 0, 0],
  bgColor: [1, 1, 1],
  enriched: true,
});

const setText = (b: TextBlock, text: string) => (s: EditState) => patchObject(s, blockToObject(b, s.edits[b.id]), { text });
const apply = (h: History, fn: (s: EditState) => EditState, record = true) =>
  historyReducer(h, { type: "apply", fn, record });

describe("historial", () => {
  const a = block("p0-b0", "Cliente: Juan Pérez");

  it("apply registra el estado anterior y vacía el futuro", () => {
    let h = apply(initialHistory, setText(a, "Cliente: Ana"));
    expect(h.present.edits[a.id]).toEqual({ text: "Cliente: Ana" });
    expect(h.past).toEqual([emptyState]);
    h = historyReducer(h, { type: "undo" });
    expect(h.future).toHaveLength(1);
    h = apply(h, setText(a, "Cliente: Luis"));
    expect(h.future).toEqual([]);
    expect(h.past).toHaveLength(1);
  });

  it("undo y redo recorren los estados", () => {
    let h = apply(initialHistory, setText(a, "Uno"));
    h = apply(h, setText(a, "Dos"));
    h = historyReducer(h, { type: "undo" });
    expect(h.present.edits[a.id].text).toBe("Uno");
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual(emptyState);
    expect(historyReducer(h, { type: "undo" })).toBe(h); // nada más que deshacer
    h = historyReducer(h, { type: "redo" });
    h = historyReducer(h, { type: "redo" });
    expect(h.present.edits[a.id].text).toBe("Dos");
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("los cambios sin registrar (record: false) no crean entradas", () => {
    let h = apply(initialHistory, setText(a, "C"));
    h = apply(h, setText(a, "Cl"), false);
    h = apply(h, setText(a, "Cli"), false);
    expect(h.past).toHaveLength(1);
    expect(h.present.edits[a.id].text).toBe("Cli");
    expect(historyReducer(h, { type: "undo" }).present).toEqual(emptyState);
  });

  it("un apply sin cambios no toca el historial", () => {
    const h = apply(initialHistory, (s) => s);
    expect(h).toBe(initialHistory);
  });

  it("reset vuelve al historial vacío", () => {
    const h = apply(initialHistory, setText(a, "X"));
    expect(historyReducer(h, { type: "reset" })).toBe(initialHistory);
  });
});

describe("edición de bloques", () => {
  const a = block("p0-b0", "Total: $ 100");

  it("volver al valor original elimina la edición", () => {
    let s = setText(a, "Total: $ 200")(emptyState);
    expect(countChanges(s)).toBe(1);
    s = setText(a, "Total: $ 100")(s);
    expect(s.edits).toEqual({});
    expect(countChanges(s)).toBe(0);
  });

  it("mover guarda solo el desplazamiento", () => {
    const s = patchObject(emptyState, blockToObject(a, undefined), { x: 60, y: 690 });
    expect(s.edits[a.id]).toEqual({ dx: 10, dy: -10 });
    expect(blockToObject(a, s.edits[a.id])).toMatchObject({ x: 60, y: 690, modified: true });
  });

  it("eliminar y restaurar", () => {
    let s = deleteObject(emptyState, blockToObject(a, undefined));
    expect(blockToObject(a, s.edits[a.id]).deleted).toBe(true);
    s = restoreBlock(s, a.id);
    expect(s.edits).toEqual({});
  });
});

describe("buscar y reemplazar", () => {
  const pages = [
    [block("p0-b0", "Fecha: 14 de octubre de 2026"), block("p0-b1", "Válida hasta: 30 de octubre de 2026")],
    [block("p1-b0", "Octubre es el mes de entrega", 1), block("p1-b1", "Sin coincidencias", 1)],
  ];

  it("reemplaza todas las coincidencias sin distinguir mayúsculas", () => {
    const { state, count } = replaceAll(emptyState, pages, "octubre", "noviembre", false);
    expect(count).toBe(3);
    expect(state.edits["p0-b0"].text).toBe("Fecha: 14 de noviembre de 2026");
    expect(state.edits["p0-b1"].text).toBe("Válida hasta: 30 de noviembre de 2026");
    expect(state.edits["p1-b0"].text).toBe("noviembre es el mes de entrega");
    expect(state.edits["p1-b1"]).toBeUndefined();
  });

  it("respeta mayúsculas cuando se pide", () => {
    const { state, count } = replaceAll(emptyState, pages, "Octubre", "Noviembre", true);
    expect(count).toBe(1);
    expect(Object.keys(state.edits)).toEqual(["p1-b0"]);
  });

  it("trata la búsqueda como texto literal, no como expresión regular", () => {
    const money = [[block("p0-b0", "Valor: $ 2.500.000 (IVA incluido)")]];
    const { state, count } = replaceAll(emptyState, money, "$ 2.500.000 (IVA", "$ 3.000.000 (IVA", false);
    expect(count).toBe(1);
    expect(state.edits["p0-b0"].text).toBe("Valor: $ 3.000.000 (IVA incluido)");
  });

  it("trabaja sobre el texto ya editado y salta los bloques eliminados", () => {
    let s = setText(pages[0][0], "Fecha: 1 de octubre")(emptyState);
    s = deleteObject(s, blockToObject(pages[0][1], undefined));
    const { state, count } = replaceAll(s, pages, "octubre", "mayo", false);
    expect(count).toBe(2);
    expect(state.edits["p0-b0"].text).toBe("Fecha: 1 de mayo");
    expect(state.edits["p0-b1"]).toEqual({ deleted: true });
  });

  it("también reemplaza en los textos agregados", () => {
    const s: EditState = {
      edits: {},
      added: [{ id: "new-1", pageIndex: 0, x: 0, y: 0, text: "octubre", fontSize: 12, family: "sans", bold: false, italic: false, color: [0, 0, 0] }],
    };
    const { state, count } = replaceAll(s, [], "octubre", "junio", false);
    expect(count).toBe(1);
    expect(state.added[0].text).toBe("junio");
  });

  it("una búsqueda vacía no cambia nada", () => {
    const { state, count } = replaceAll(emptyState, pages, "", "x", false);
    expect(count).toBe(0);
    expect(state).toBe(emptyState);
  });
});
