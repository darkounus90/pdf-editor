"use client";

import { PdfEditor } from "@pdf-editor/editor-ui";

export default function EditorApp() {
  // /editar-pdf?ejemplo abre directamente el PDF de muestra (enlace de la portada).
  const autoLoadSample = new URLSearchParams(window.location.search).has("ejemplo");
  return <PdfEditor assetsUrl="/pdfjs/" sampleUrl="/ejemplo.pdf" autoLoadSample={autoLoadSample} homeHref="/" />;
}
