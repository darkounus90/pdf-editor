import type { Metadata } from "next";
import { EditorClient } from "./EditorClient";

export const metadata: Metadata = {
  title: "Editar PDF en línea",
  description:
    "Edita el texto de un PDF en tu navegador: cambia líneas, busca y reemplaza, agrega texto y descarga el resultado. Sin subir el archivo.",
  alternates: { canonical: "/editar-pdf" },
};

export default function EditarPdfPage() {
  return <EditorClient />;
}
