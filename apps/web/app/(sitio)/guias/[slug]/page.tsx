import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { SITE_URL } from "../../../../lib/site";
import { Ad } from "../../../_components/Ad";
import { findGuide, GUIDES } from "../guides";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guias/${guide.slug}` },
    openGraph: { type: "article", title: guide.title, description: guide.description },
  };
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

export default async function GuidePage({ params }: Params) {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    dateModified: guide.updated,
    inLanguage: "es",
    mainEntityOfPage: `${SITE_URL}/guias/${guide.slug}`,
    publisher: { "@type": "Organization", name: "Renglón", url: SITE_URL },
  };

  return (
    <main className="page-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="prose">
        <Link href="/guias" className="back-link">
          <ArrowLeft size={16} aria-hidden /> Guías
        </Link>
        <h1>{guide.title}</h1>
        <p className="prose-meta">Actualizada el {formatDate(guide.updated)}</p>
        {guide.intro.map((p, i) => (
          <p key={i} className={i === 0 ? "prose-lede" : undefined}>
            {p}
          </p>
        ))}

        <Ad />

        {guide.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.body?.map((p, i) => <p key={i}>{p}</p>)}
            {s.steps && (
              <ol className="prose-steps">
                {s.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            )}
            {s.tip && (
              <p className="prose-tip">
                <Lightbulb size={18} aria-hidden />
                <span>{s.tip}</span>
              </p>
            )}
          </section>
        ))}

        <div className="prose-cta">
          <div>
            <strong>Pruébalo con tu PDF</strong>
            <span>Se procesa en tu navegador. Nada se sube a ningún servidor.</span>
          </div>
          <Link href="/editar-pdf" className="btn primary">
            Abrir el editor <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </article>

      <Ad />

      <aside className="related" aria-labelledby="related-title">
        <h2 id="related-title">Otras guías</h2>
        <ul>
          {others.map((g) => (
            <li key={g.slug}>
              <Link href={`/guias/${g.slug}`}>{g.title}</Link>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
