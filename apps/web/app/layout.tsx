import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import type { ReactNode } from "react";
import "@pdf-editor/editor-ui/styles.css";
import "./home.css";
import "./account.css";

// Una sola familia con eje de ancho: expandida para titulares, normal para la interfaz.
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://renglonpdf.online"),
  title: {
    default: "Renglón · Edita el texto de tu PDF en línea",
    template: "%s · Renglón",
  },
  description:
    "Corrige una fecha, un precio o un nombre en tu PDF en segundos. Renglón edita el texto directamente en tu navegador: tu archivo nunca se sube a ningún servidor.",
  applicationName: "Renglón",
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Renglón",
    title: "Renglón · Edita el texto de tu PDF, renglón por renglón",
    description: "Corrige cualquier PDF en tu navegador. Sin subir el archivo.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
