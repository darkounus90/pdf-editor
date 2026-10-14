import type { AddedText, BlockEdit, EditState, RGB, TextBlock, TextObject, TextStyle } from "./types";

// ---------- Historial (deshacer / rehacer) ----------

export interface History {
  past: EditState[];
  present: EditState;
  future: EditState[];
}

export type HistoryAction =
  | { type: "apply"; fn: (s: EditState) => EditState; record: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

const MAX_HISTORY = 200;
export const emptyState: EditState = { edits: {}, added: [] };
export const initialHistory: History = { past: [], present: emptyState, future: [] };

export function historyReducer(h: History, action: HistoryAction): History {
  switch (action.type) {
    case "apply": {
      const next = action.fn(h.present);
      if (next === h.present) return h;
      if (!action.record) return { ...h, present: next };
      return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: next, future: [] };
    }
    case "undo": {
      if (!h.past.length) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    }
    case "redo": {
      if (!h.future.length) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    }
    case "reset":
      return initialHistory;
  }
}

// ---------- Objetos de texto ----------

const sameColor = (a: RGB, b: RGB) => a.every((v, i) => Math.abs(v - b[i]) < 1 / 255);

export function blockToObject(block: TextBlock, edit: BlockEdit | undefined): TextObject {
  const e = edit ?? {};
  return {
    id: block.id,
    kind: "block",
    pageIndex: block.pageIndex,
    x: block.x + (e.dx ?? 0),
    y: block.y + (e.dy ?? 0),
    text: e.text ?? block.text,
    fontSize: e.fontSize ?? block.fontSize,
    family: e.family ?? block.family,
    bold: e.bold ?? block.bold,
    italic: e.italic ?? block.italic,
    color: e.color ?? block.color,
    modified: edit !== undefined,
    deleted: Boolean(e.deleted),
    block,
  };
}

export function addedToObject(a: AddedText): TextObject {
  return { ...a, kind: "added", modified: true, deleted: false };
}

export function pageObjects(blocks: TextBlock[], state: EditState, pageIndex: number, draft: AddedText | null): TextObject[] {
  const list = blocks.map((b) => blockToObject(b, state.edits[b.id]));
  for (const a of state.added) if (a.pageIndex === pageIndex) list.push(addedToObject(a));
  if (draft && draft.pageIndex === pageIndex) list.push(addedToObject(draft));
  return list;
}

/** Quita del edit las claves que coinciden con el bloque original. */
function normalizeEdit(block: TextBlock, edit: BlockEdit): BlockEdit | undefined {
  const e: BlockEdit = { ...edit };
  if (e.text === block.text) delete e.text;
  if (e.fontSize !== undefined && Math.abs(e.fontSize - block.fontSize) < 0.01) delete e.fontSize;
  if (e.family === block.family) delete e.family;
  if (e.bold === block.bold) delete e.bold;
  if (e.italic === block.italic) delete e.italic;
  if (e.color && sameColor(e.color, block.color)) delete e.color;
  if (e.dx !== undefined && Math.abs(e.dx) < 0.01) delete e.dx;
  if (e.dy !== undefined && Math.abs(e.dy) < 0.01) delete e.dy;
  if (!e.deleted) delete e.deleted;
  return Object.keys(e).length ? e : undefined;
}

export type ObjectPatch = Partial<TextStyle> & { text?: string; x?: number; y?: number; deleted?: boolean };

export function patchObject(state: EditState, obj: TextObject, patch: ObjectPatch): EditState {
  if (obj.kind === "added") {
    return { ...state, added: state.added.map((a) => (a.id === obj.id ? { ...a, ...withoutDeleted(patch) } : a)) };
  }
  const block = obj.block!;
  const prev = state.edits[block.id] ?? {};
  const { x, y, ...rest } = patch;
  const merged: BlockEdit = { ...prev, ...rest };
  if (x !== undefined) merged.dx = x - block.x;
  if (y !== undefined) merged.dy = y - block.y;
  const normalized = normalizeEdit(block, merged);
  const edits = { ...state.edits };
  if (normalized) edits[block.id] = normalized;
  else delete edits[block.id];
  return { ...state, edits };
}

function withoutDeleted(patch: ObjectPatch): Partial<AddedText> {
  const { deleted: _deleted, ...rest } = patch;
  return rest;
}

export function deleteObject(state: EditState, obj: TextObject): EditState {
  if (obj.kind === "added") return { ...state, added: state.added.filter((a) => a.id !== obj.id) };
  return patchObject(state, obj, { deleted: true });
}

export function restoreBlock(state: EditState, id: string): EditState {
  if (!state.edits[id]) return state;
  const edits = { ...state.edits };
  delete edits[id];
  return { ...state, edits };
}

export function countChanges(state: EditState): number {
  return Object.keys(state.edits).length + state.added.length;
}

// ---------- Buscar y reemplazar ----------

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function searchRegExp(query: string, caseSensitive: boolean): RegExp | null {
  if (!query) return null;
  return new RegExp(escapeRegExp(query), caseSensitive ? "g" : "gi");
}

export function replaceAll(
  state: EditState,
  blocks: TextBlock[][],
  query: string,
  replacement: string,
  caseSensitive: boolean,
): { state: EditState; count: number } {
  const re = searchRegExp(query, caseSensitive);
  if (!re) return { state, count: 0 };
  let count = 0;
  let next = state;
  for (const page of blocks) {
    for (const block of page) {
      const obj = blockToObject(block, next.edits[block.id]);
      if (obj.deleted) continue;
      const matches = obj.text.match(re);
      if (!matches) continue;
      count += matches.length;
      next = patchObject(next, obj, { text: obj.text.replace(re, () => replacement) });
    }
  }
  for (const a of next.added) {
    const matches = a.text.match(re);
    if (!matches) continue;
    count += matches.length;
    next = patchObject(next, addedToObject(a), { text: a.text.replace(re, () => replacement) });
  }
  return { state: next, count };
}
