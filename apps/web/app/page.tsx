import Link from "next/link";

const FEATURES = [
  {
    title: "Edición en línea",
    text: "Haz clic en cualquier línea para cambiar el texto, el tamaño, la fuente, el color o la posición.",
  },
  {
    title: "Buscar y reemplazar",
    text: "Cambia un nombre, una fecha o un valor en todo el documento de una sola vez.",
  },
  {
    title: "Borrado real",
    text: "Al descargar, el texto original de las líneas editadas se quita del archivo, no solo se tapa.",
  },
  {
    title: "Análisis del documento",
    text: "Metadatos, tamaño de página, fuentes y detección de páginas escaneadas que necesitarían OCR.",
  },
];

const STEPS = [
  { title: "Abre tu PDF", text: "Arrástralo a la página o elígelo desde tu equipo." },
  { title: "Edita", text: "Haz clic en el texto que quieras cambiar, agrega texto nuevo o usa buscar y reemplazar." },
  { title: "Descarga", text: "Obtén el PDF editado con un clic. Puedes deshacer cualquier cambio antes." },
];

export default function HomePage() {
  return (
    <div className="home">
      <header className="home-nav">
        <Link href="/" className="brand">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--accent)" />
            <path d="M14 2v5h5" fill="#fff" opacity=".55" />
            <path d="M8 17l1.2-3.6L15 7.6l2.4 2.4-5.8 5.8L8 17z" fill="#fff" />
          </svg>
          <span>Editor PDF</span>
        </Link>
        <Link href="/editar-pdf" className="btn primary">
          Editar un PDF
        </Link>
      </header>

      <main>
        <section className="home-hero">
          <h1>Edita el texto de cualquier PDF</h1>
          <p>
            Corrige un dato, cambia una fecha o reemplaza un nombre en todo el documento. El PDF se procesa en tu
            navegador: nada se sube a ningún servidor.
          </p>
          <div className="home-cta">
            <Link href="/editar-pdf" className="btn primary lg">
              Abrir un PDF
            </Link>
            <Link href="/editar-pdf?ejemplo" className="btn lg">
              Probar con un ejemplo
            </Link>
          </div>
        </section>

        <section className="home-section" aria-labelledby="features-title">
          <h2 id="features-title">Qué puedes hacer</h2>
          <ul className="home-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-section" aria-labelledby="steps-title">
          <h2 id="steps-title">Cómo funciona</h2>
          <ol className="home-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="home-step-n">{i + 1}</span>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="home-footer">Editor PDF · tus archivos nunca salen de tu equipo.</footer>
    </div>
  );
}
