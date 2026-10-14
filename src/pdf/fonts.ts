import { StandardFonts } from "pdf-lib";
import type { Family, RGB, TextStyle } from "../types";

/**
 * Las ediciones se escriben con las 14 fuentes estándar de PDF, así lo que se
 * ve en pantalla coincide con el archivo exportado. Estas son sus equivalentes CSS.
 */
const CSS_FAMILY: Record<Family, string> = {
  sans: "Helvetica, Arial, 'Liberation Sans', sans-serif",
  serif: "'Times New Roman', Times, 'Liberation Serif', serif",
  mono: "'Courier New', Courier, 'Liberation Mono', monospace",
};

/** Distancia de la parte superior de la caja (line-height: 1) a la línea base, en em. */
const BASELINE_RATIO: Record<Family, number> = { sans: 0.85, serif: 0.84, mono: 0.77 };

const STANDARD: Record<Family, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  mono: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

export const FAMILY_LABEL: Record<Family, string> = { sans: "Sans (Helvetica)", serif: "Serif (Times)", mono: "Mono (Courier)" };

export const cssFontFamily = (family: Family) => CSS_FAMILY[family];
export const baselineRatio = (family: Family) => BASELINE_RATIO[family];

export function standardFont(style: Pick<TextStyle, "family" | "bold" | "italic">): StandardFonts {
  return STANDARD[style.family][(style.bold ? 1 : 0) + (style.italic ? 2 : 0)];
}

export function cssFont(style: Pick<TextStyle, "family" | "bold" | "italic">, sizePx: number): string {
  return `${style.italic ? "italic " : ""}${style.bold ? "700 " : "400 "}${sizePx}px ${CSS_FAMILY[style.family]}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(text: string, font: string): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 8;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export const rgbToCss = ([r, g, b]: RGB) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

export const rgbToHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
