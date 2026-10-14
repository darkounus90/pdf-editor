import { createContext, useContext, type MutableRefObject } from "react";
import type { TextBlock, TextObject } from "../types";
import type { ObjectPatch } from "./editor";

export type Mode = "edit" | "add";

export interface EditorApi {
  zoom: number;
  mode: Mode;
  selectedId: string | null;
  matchRe: RegExp | null;
  /** true mientras el próximo cambio de texto deba abrir una entrada nueva en el historial. */
  textSession: MutableRefObject<boolean>;
  select: (id: string | null) => void;
  update: (obj: TextObject, patch: ObjectPatch, record?: boolean) => void;
  remove: (obj: TextObject) => void;
  restore: (id: string) => void;
  addAt: (pageIndex: number, x: number, y: number) => void;
  onEnriched: (pageIndex: number, blocks: TextBlock[]) => void;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const api = useContext(EditorContext);
  if (!api) throw new Error("useEditor fuera de EditorContext");
  return api;
}
