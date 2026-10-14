export type RGB = [number, number, number]; // 0..1
export type Family = "sans" | "serif" | "mono";

/** Línea de texto detectada en el PDF original (coordenadas en espacio de usuario PDF). */
export interface TextBlock {
  id: string;
  pageIndex: number;
  text: string;
  /** Origen de la línea base del primer fragmento. */
  x: number;
  y: number;
  width: number;
  fontSize: number;
  /** Proporciones respecto a fontSize (descent es negativo). */
  ascent: number;
  descent: number;
  fontRef: string; // nombre interno de pdf.js (g_d0_f1…)
  fontName: string; // nombre real, si se conoce
  family: Family;
  bold: boolean;
  italic: boolean;
  color: RGB;
  bgColor: RGB;
  /** true cuando ya se analizó el render (fuente real + colores). */
  enriched: boolean;
}

export interface TextStyle {
  fontSize: number;
  family: Family;
  bold: boolean;
  italic: boolean;
  color: RGB;
}

/** Cambios aplicados sobre un bloque original. Solo se guardan las claves modificadas. */
export interface BlockEdit extends Partial<TextStyle> {
  text?: string;
  deleted?: boolean;
  dx?: number;
  dy?: number;
}

/** Texto nuevo agregado por el usuario. */
export interface AddedText extends TextStyle {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  text: string;
}

export interface EditState {
  edits: Record<string, BlockEdit>;
  added: AddedText[];
}

/** Vista unificada de un objeto de texto editable (bloque original o agregado). */
export interface TextObject extends TextStyle {
  id: string;
  kind: "block" | "added";
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  modified: boolean;
  deleted: boolean;
  block?: TextBlock;
}

export interface PageInfo {
  index: number;
  width: number; // en puntos, ya rotada
  height: number;
  rotation: number;
}

export interface DocInfo {
  fileName: string;
  fileSize: number;
  numPages: number;
  pdfVersion?: string;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  encrypted: boolean;
  formFields: number;
  pages: PageInfo[];
}
