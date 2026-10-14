// Copia fuentes estándar, cmaps, wasm e ICC de pdf.js a public/pdfjs para que
// pdf.js pueda renderizar PDFs con fuentes no incrustadas o imágenes JPX/JBIG2.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const target = join(process.cwd(), "public", "pdfjs");

mkdirSync(target, { recursive: true });
for (const dir of ["standard_fonts", "cmaps", "wasm", "iccs"]) {
  cpSync(join(pdfjsRoot, dir), join(target, dir), { recursive: true });
}
console.log("pdf.js assets -> public/pdfjs");
