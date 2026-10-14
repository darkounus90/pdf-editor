// Núcleo del editor: análisis, estado de edición y exportación. Sin React ni DOM;
// lo que necesita canvas o document está en "@pdf-editor/pdf-core/browser".
export * from "./types";
export * from "./pdfjs";
export * from "./analyze";
export * from "./editor";
export * from "./fonts";
export * from "./export";
export { eraseOriginalText } from "./eraseText";
export { parseContent, ContentParseError, type ContentOp, type Operand } from "./contentStream";
export type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";
