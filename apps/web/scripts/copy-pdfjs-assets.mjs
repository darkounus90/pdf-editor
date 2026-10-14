// Copia el worker, las fuentes estándar, cmaps, wasm e ICC de pdf.js a
// public/pdfjs para que pdf.js pueda renderizar PDFs con fuentes no incrustadas
// o imágenes JPX/JBIG2, y el PDF de ejemplo del corpus a public/ejemplo.pdf.
// Se resuelve pdfjs-dist desde @pdf-editor/pdf-core para que el worker sea
// exactamente la versión que usa el editor.
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const coreRoot = dirname(require.resolve("@pdf-editor/pdf-core/package.json"));
const pdfjsRoot = dirname(createRequire(join(coreRoot, "package.json")).resolve("pdfjs-dist/package.json"));
const target = join(appRoot, "public", "pdfjs");

mkdirSync(target, { recursive: true });
for (const dir of ["standard_fonts", "cmaps", "wasm", "iccs"]) {
  cpSync(join(pdfjsRoot, dir), join(target, dir), { recursive: true });
}
copyFileSync(join(pdfjsRoot, "build", "pdf.worker.min.mjs"), join(target, "pdf.worker.min.mjs"));
copyFileSync(join(coreRoot, "tests", "corpus", "ejemplo.pdf"), join(appRoot, "public", "ejemplo.pdf"));
console.log("pdf.js assets -> public/pdfjs, ejemplo.pdf -> public/");
