// Genera public/ejemplo.pdf: un documento de prueba con varias fuentes,
// colores, fondos y una tabla, útil para probar el editor.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const doc = await PDFDocument.create();
doc.setTitle("Cotización de servicios");
doc.setAuthor("Empresa Demo S.A.S.");
doc.setSubject("Documento de ejemplo para el editor PDF");
doc.setCreator("pdf-editor / make-sample");

const helv = await doc.embedFont(StandardFonts.Helvetica);
const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
const times = await doc.embedFont(StandardFonts.TimesRoman);
const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
const courier = await doc.embedFont(StandardFonts.Courier);

const navy = rgb(0.09, 0.2, 0.42);
const gray = rgb(0.35, 0.35, 0.38);

// Página 1
const p1 = doc.addPage([595.28, 841.89]); // A4
p1.drawRectangle({ x: 0, y: 760, width: 595.28, height: 82, color: navy });
p1.drawText("COTIZACIÓN DE SERVICIOS", { x: 50, y: 795, size: 22, font: helvBold, color: rgb(1, 1, 1) });
p1.drawText("Empresa Demo S.A.S.  ·  NIT 900.123.456-7", { x: 50, y: 775, size: 10, font: helv, color: rgb(0.85, 0.9, 1) });

p1.drawText("Cliente: Juan Pérez", { x: 50, y: 720, size: 12, font: helvBold, color: rgb(0, 0, 0) });
p1.drawText("Fecha: 14 de octubre de 2026", { x: 50, y: 702, size: 11, font: helv, color: gray });
p1.drawText("Válida hasta: 30 de octubre de 2026", { x: 330, y: 702, size: 11, font: helv, color: gray });

const body = [
  "Estimado cliente, a continuación presentamos la propuesta económica para el",
  "desarrollo de su sitio web, incluyendo diseño, programación y puesta en marcha.",
  "Los valores están expresados en pesos colombianos e incluyen IVA.",
];
body.forEach((line, i) => {
  p1.drawText(line, { x: 50, y: 665 - i * 17, size: 12, font: times, color: rgb(0.1, 0.1, 0.1) });
});

// Tabla
const rows = [
  ["Concepto", "Cantidad", "Valor"],
  ["Diseño de interfaz", "1", "$ 2.500.000"],
  ["Desarrollo front-end", "1", "$ 4.800.000"],
  ["Hosting anual", "1", "$ 650.000"],
];
let y = 590;
rows.forEach((r, i) => {
  if (i === 0) p1.drawRectangle({ x: 50, y: y - 6, width: 495, height: 22, color: rgb(0.93, 0.95, 0.98) });
  const f = i === 0 ? helvBold : helv;
  p1.drawText(r[0], { x: 58, y, size: 11, font: f, color: rgb(0.1, 0.1, 0.1) });
  p1.drawText(r[1], { x: 330, y, size: 11, font: f, color: rgb(0.1, 0.1, 0.1) });
  p1.drawText(r[2], { x: 440, y, size: 11, font: f, color: rgb(0.1, 0.1, 0.1) });
  p1.drawLine({ start: { x: 50, y: y - 7 }, end: { x: 545, y: y - 7 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.86) });
  y -= 24;
});
p1.drawText("TOTAL: $ 7.950.000", { x: 400, y: y - 10, size: 14, font: helvBold, color: rgb(0.75, 0.1, 0.1) });

p1.drawText("Nota: el anticipo del 50% se cancela al firmar la propuesta.", {
  x: 50, y: 440, size: 11, font: timesItalic, color: gray,
});
p1.drawText("Ref: COT-2026-0142", { x: 50, y: 60, size: 9, font: courier, color: gray });

// Página 2
const p2 = doc.addPage([595.28, 841.89]);
p2.drawText("Condiciones generales", { x: 50, y: 780, size: 18, font: helvBold, color: navy });
const terms = [
  "1. El tiempo de entrega es de 6 semanas a partir del anticipo.",
  "2. Se incluyen dos rondas de ajustes sobre el diseño aprobado.",
  "3. El soporte técnico gratuito cubre los primeros 3 meses.",
  "4. Los cambios fuera del alcance se cotizan por separado.",
];
terms.forEach((t, i) => p2.drawText(t, { x: 50, y: 745 - i * 20, size: 12, font: times, color: rgb(0.1, 0.1, 0.1) }));
p2.drawRectangle({ x: 50, y: 560, width: 495, height: 50, color: rgb(1, 0.96, 0.85) });
p2.drawText("Importante: precios sujetos a cambios sin previo aviso.", { x: 62, y: 580, size: 12, font: helvBold, color: rgb(0.55, 0.35, 0) });
p2.drawText("Firma del cliente: ______________________", { x: 50, y: 300, size: 12, font: helv, color: rgb(0, 0, 0) });

const bytes = await doc.save();
const out = join(process.cwd(), "public", "ejemplo.pdf");
writeFileSync(out, bytes);
console.log("PDF de ejemplo ->", out);
