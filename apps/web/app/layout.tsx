import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@pdf-editor/editor-ui/styles.css";
import "./home.css";

export const metadata: Metadata = {
  title: {
    default: "Editor PDF: edita el texto de tus PDF en línea",
    template: "%s · Editor PDF",
  },
  description:
    "Cambia el texto de cualquier PDF directamente en tu navegador: editar líneas, buscar y reemplazar, agregar texto. Tu archivo no se sube a ningún servidor.",
};

export const viewport: Viewport = {
  themeColor: "#3b5bdb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
