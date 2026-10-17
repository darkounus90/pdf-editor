import Link from "next/link";
import { Brand } from "@pdf-editor/editor-ui/brand";

export function SiteNav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Brand href="/" />
        <nav aria-label="Secciones">
          <a href="/#como-funciona">Cómo funciona</a>
          <Link href="/guias">Guías</Link>
          <a href="/#privacidad">Privacidad</a>
          <a href="/#preguntas">Preguntas</a>
        </nav>
        <Link href="/editar-pdf" className="btn primary">
          Abrir un PDF
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <Brand href="/" />
      <nav aria-label="Pie de página">
        <Link href="/editar-pdf">Editar un PDF</Link>
        <Link href="/guias">Guías</Link>
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/terminos">Términos</Link>
      </nav>
      <span>© {new Date().getFullYear()} Renglón</span>
      <span className="footer-credit">
        Hecho por{" "}
        <a href="https://onnyxsoftware.online/" target="_blank" rel="noopener">
          Onnyx Software
        </a>
      </span>
    </footer>
  );
}
