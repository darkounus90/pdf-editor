import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Ad } from "../../_components/Ad";
import { GUIDES } from "./guides";

export const metadata: Metadata = {
  title: "Guías para corregir PDF",
  description:
    "Guías prácticas para cambiar fechas, precios y nombres en un PDF, borrar datos sin dejar rastro y entender qué se puede editar.",
  alternates: { canonical: "/guias" },
};

export default function GuidesIndex() {
  return (
    <main className="page-wrap">
      <header className="page-head">
        <h1>Guías para corregir tus PDF</h1>
        <p>Respuestas cortas a los problemas de siempre: una fecha vieja, un precio que cambió, un nombre que hay que reemplazar.</p>
      </header>

      <ol className="guide-list">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/guias/${g.slug}`}>
              <h2>{g.title}</h2>
              <p>{g.description}</p>
              <span className="link-arrow">
                Leer la guía <ArrowRight size={16} aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <Ad />
    </main>
  );
}
