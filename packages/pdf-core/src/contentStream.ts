/**
 * Tokenizador mínimo de flujos de contenido PDF. Devuelve cada operador con sus
 * operandos y el rango de bytes que ocupa, para poder reescribir solo algunos
 * operadores y copiar el resto tal cual.
 */

export type Operand =
  | { t: "num"; v: number }
  | { t: "name"; v: string }
  | { t: "str"; bytes: Uint8Array }
  | { t: "arr"; items: Operand[] }
  | { t: "dict"; entries: Map<string, Operand> }
  | { t: "kw"; v: string }; // true, false, null u otras palabras sueltas

export interface ContentOp {
  op: string;
  operands: Operand[];
  /** Inicio del primer operando (o del operador si no tiene). */
  start: number;
  /** Fin del operador (exclusivo). En imágenes en línea, fin de EI. */
  end: number;
}

export class ContentParseError extends Error {}

const isWhite = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
const isDelim = (c: number) =>
  c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d ||
  c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;
const isRegular = (c: number) => !isWhite(c) && !isDelim(c);
const hexVal = (c: number) =>
  c >= 0x30 && c <= 0x39 ? c - 0x30 : c >= 0x41 && c <= 0x46 ? c - 55 : c >= 0x61 && c <= 0x66 ? c - 87 : -1;

export function parseContent(data: Uint8Array): ContentOp[] {
  const n = data.length;
  let pos = 0;
  const ops: ContentOp[] = [];

  const skipWhite = () => {
    while (pos < n) {
      const c = data[pos];
      if (isWhite(c)) pos++;
      else if (c === 0x25) {
        while (pos < n && data[pos] !== 10 && data[pos] !== 13) pos++;
      } else break;
    }
  };

  const readRegular = () => {
    const s = pos;
    while (pos < n && isRegular(data[pos])) pos++;
    return String.fromCharCode(...data.subarray(s, pos));
  };

  const readLiteral = (): Uint8Array => {
    pos++; // (
    const out: number[] = [];
    let depth = 1;
    while (pos < n) {
      const c = data[pos++];
      if (c === 0x5c) {
        if (pos >= n) break;
        const e = data[pos++];
        if (e === 0x6e) out.push(10);
        else if (e === 0x72) out.push(13);
        else if (e === 0x74) out.push(9);
        else if (e === 0x62) out.push(8);
        else if (e === 0x66) out.push(12);
        else if (e === 13) {
          if (data[pos] === 10) pos++;
        } else if (e === 10) {
          // continuación de línea
        } else if (e >= 0x30 && e <= 0x37) {
          let v = e - 0x30;
          for (let k = 0; k < 2 && pos < n && data[pos] >= 0x30 && data[pos] <= 0x37; k++) v = v * 8 + data[pos++] - 0x30;
          out.push(v & 0xff);
        } else out.push(e);
      } else if (c === 0x28) {
        depth++;
        out.push(c);
      } else if (c === 0x29) {
        if (--depth === 0) return Uint8Array.from(out);
        out.push(c);
      } else out.push(c);
    }
    throw new ContentParseError("Cadena sin cerrar");
  };

  const readHex = (): Uint8Array => {
    pos++; // <
    const out: number[] = [];
    let hi = -1;
    while (pos < n && data[pos] !== 0x3e) {
      const v = hexVal(data[pos++]);
      if (v < 0) continue;
      if (hi < 0) hi = v;
      else {
        out.push(hi * 16 + v);
        hi = -1;
      }
    }
    if (pos >= n) throw new ContentParseError("Cadena hexadecimal sin cerrar");
    pos++; // >
    if (hi >= 0) out.push(hi * 16);
    return Uint8Array.from(out);
  };

  const readName = (): string => {
    pos++; // /
    const s = pos;
    while (pos < n && isRegular(data[pos])) pos++;
    return String.fromCharCode(...data.subarray(s, pos)).replace(/#([0-9a-fA-F]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
  };

  /** Lee un objeto; devuelve null si lo que sigue es un operador (palabra suelta fuera de contenedor). */
  const readObject = (nested: boolean): Operand | { op: string } => {
    const c = data[pos];
    if (c === 0x28) return { t: "str", bytes: readLiteral() };
    if (c === 0x3c) {
      if (data[pos + 1] === 0x3c) return readDict();
      return { t: "str", bytes: readHex() };
    }
    if (c === 0x5b) return readArray();
    if (c === 0x2f) return { t: "name", v: readName() };
    if (isDelim(c)) throw new ContentParseError(`Delimitador inesperado en ${pos}`);
    const word = readRegular();
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) return { t: "num", v: parseFloat(word) };
    if (nested || word === "true" || word === "false" || word === "null") return { t: "kw", v: word };
    return { op: word };
  };

  const readArray = (): Operand => {
    pos++; // [
    const items: Operand[] = [];
    for (;;) {
      skipWhite();
      if (pos >= n) throw new ContentParseError("Arreglo sin cerrar");
      if (data[pos] === 0x5d) {
        pos++;
        return { t: "arr", items };
      }
      items.push(readObject(true) as Operand);
    }
  };

  const readDict = (): Operand => {
    pos += 2; // <<
    const entries = new Map<string, Operand>();
    for (;;) {
      skipWhite();
      if (pos >= n) throw new ContentParseError("Diccionario sin cerrar");
      if (data[pos] === 0x3e && data[pos + 1] === 0x3e) {
        pos += 2;
        return { t: "dict", entries };
      }
      if (data[pos] !== 0x2f) throw new ContentParseError("Clave de diccionario inválida");
      const key = readName();
      skipWhite();
      entries.set(key, readObject(true) as Operand);
    }
  };

  /** Salta los datos binarios de una imagen en línea y devuelve la posición tras EI. */
  const skipInlineImage = (dict: Map<string, Operand>): number => {
    // Tras ID va exactamente un espacio en blanco y luego los datos.
    let p = pos + 1;
    const len = dict.get("L") ?? dict.get("Length");
    if (len?.t === "num" && len.v > 0) p = Math.min(n, p + len.v);
    for (; p + 1 < n; p++) {
      if (data[p] !== 0x45 || data[p + 1] !== 0x49) continue; // EI
      if (p > 0 && !isWhite(data[p - 1])) continue;
      const after = p + 2;
      if (after < n && !isWhite(data[after]) && !isDelim(data[after])) continue;
      // Como hace pdf.js: lo que sigue a EI debe parecer contenido de texto, no binario.
      let ok = true;
      for (let q = after; q < Math.min(n, after + 64); q++) {
        const b = data[q];
        if (b > 0x7e || (b < 0x20 && !isWhite(b))) {
          ok = false;
          break;
        }
      }
      if (ok) return after;
    }
    throw new ContentParseError("Imagen en línea sin EI");
  };

  let operands: Operand[] = [];
  let opStart = -1;
  while (true) {
    skipWhite();
    if (pos >= n) break;
    const tokStart = pos;
    const obj = readObject(false);
    if (opStart < 0) opStart = tokStart;
    if ("op" in obj) {
      if (obj.op === "BI") {
        const dict = new Map<string, Operand>();
        for (;;) {
          skipWhite();
          if (pos >= n) throw new ContentParseError("Imagen en línea sin ID");
          if (data[pos] === 0x2f) {
            const key = readName();
            skipWhite();
            dict.set(key, readObject(true) as Operand);
            continue;
          }
          const word = readRegular();
          if (word !== "ID") throw new ContentParseError("Imagen en línea mal formada");
          break;
        }
        pos = skipInlineImage(dict);
        ops.push({ op: "BI", operands: [{ t: "dict", entries: dict }], start: opStart, end: pos });
      } else {
        ops.push({ op: obj.op, operands, start: opStart, end: pos });
      }
      operands = [];
      opStart = -1;
    } else {
      operands.push(obj);
    }
  }
  return ops;
}
