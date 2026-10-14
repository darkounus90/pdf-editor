import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import type { TextBlock, TextObject } from "../types";
import { eraseOriginalText } from "./eraseText";
import { standardFont } from "./fonts";

export interface ExportResult {
  bytes: Uint8Array;
  /** Caracteres que la fuente estándar no puede representar y se cambiaron por "?". */
  replacedChars: number;
  /** Bloques cuyo texto original no se pudo quitar del archivo y quedó solo tapado. */
  coveredBlocks: number;
}

/**
 * Aplica los cambios sobre el PDF original: el texto de cada bloque modificado
 * se quita del flujo de contenido de la página y se dibuja el texto nuevo. Los
 * bloques que no se pudieron quitar del todo (texto dentro de Form XObjects,
 * fuentes Type3, operadores que mezclan ese texto con otro…) se tapan con un
 * rectángulo del color de fondo detectado. Los textos agregados se dibujan directamente.
 */
export async function exportPdf(original: Uint8Array, objects: TextObject[]): Promise<ExportResult> {
  const doc = await PDFDocument.load(original, { ignoreEncryption: true, updateMetadata: false });
  doc.setModificationDate(new Date());

  // Hay que reescribir el contenido antes de dibujar: pdf-lib agrega sus propios flujos a la página.
  const blocksByPage = new Map<number, TextBlock[]>();
  for (const obj of objects) {
    if (!obj.block) continue;
    const list = blocksByPage.get(obj.pageIndex) ?? [];
    list.push(obj.block);
    blocksByPage.set(obj.pageIndex, list);
  }
  const erased = eraseOriginalText(doc, blocksByPage);

  const fonts = new Map<string, { font: PDFFont; charset: Set<number> }>();
  const getFont = async (obj: TextObject) => {
    const key = standardFont(obj);
    let entry = fonts.get(key);
    if (!entry) {
      const font = await doc.embedFont(key);
      entry = { font, charset: new Set(font.getCharacterSet()) };
      fonts.set(key, entry);
    }
    return entry;
  };

  let replacedChars = 0;
  let coveredBlocks = 0;
  const pages = doc.getPages();

  for (const obj of objects) {
    const page = pages[obj.pageIndex];
    if (!page) continue;

    const b = obj.block;
    if (b && !erased.has(b.id)) {
      coveredBlocks++;
      const pad = Math.max(0.6, b.fontSize * 0.06);
      page.drawRectangle({
        x: b.x - pad,
        y: b.y + b.descent * b.fontSize - pad,
        width: b.width + pad * 2,
        height: (b.ascent - b.descent) * b.fontSize + pad * 2,
        color: rgb(...b.bgColor),
        borderWidth: 0,
      });
    }
    if (obj.deleted || !obj.text.trim()) continue;

    const { font, charset } = await getFont(obj);
    let text = "";
    for (const ch of obj.text.replace(/[\r\n\t]+/g, " ")) {
      if (charset.has(ch.codePointAt(0)!)) text += ch;
      else {
        text += "?";
        replacedChars++;
      }
    }
    page.drawText(text, { x: obj.x, y: obj.y, size: obj.fontSize, font, color: rgb(...obj.color) });
  }

  return { bytes: await doc.save(), replacedChars, coveredBlocks };
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
