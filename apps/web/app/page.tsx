import Link from "next/link";
import { ArrowRight, Check, CloudOff, FileDown, FileUp, Lock, MousePointerClick, ScanSearch } from "lucide-react";
import { Brand } from "@pdf-editor/editor-ui/brand";
import { HeroDemo } from "./_components/HeroDemo";
import { ReplaceDemo } from "./_components/ReplaceDemo";
import { EraseDemo } from "./_components/EraseDemo";

const STEPS = [
  {
    icon: <FileUp size={22} aria-hidden />,
    title: "Abre tu PDF",
    text: "Arrástralo a la página o elígelo desde tu equipo. Renglón lo analiza al instante, sin subirlo.",
  },
  {
    icon: <MousePointerClick size={22} aria-hidden />,
    title: "Corrige el renglón",
    text: "Haz clic en la línea que quieres cambiar y escribe. Ajusta tamaño, negrita o color si hace falta.",
  },
  {
    icon: <FileDown size={22} aria-hidden />,
    title: "Descarga",
    text: "Obtienes el mismo PDF con tus correcciones. Antes puedes deshacer o restaurar cualquier cambio.",
  },
];

const FAQ = [
  {
    q: "¿Mi archivo se sube a algún servidor?",
    a: "No. Renglón lee, analiza y modifica el PDF dentro de tu navegador. El archivo nunca viaja a nuestros servidores ni a los de nadie más, por eso sirve para contratos, extractos o documentos confidenciales.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Nada. Puedes abrir, corregir y descargar tus PDF sin pagar y sin crear una cuenta.",
  },
  {
    q: "¿Se mantiene la fuente original?",
    a: "Renglón detecta la fuente de cada línea (nombre, tamaño, negrita, cursiva y color) y escribe tu corrección con la más parecida entre las fuentes estándar de PDF: una sin serifa tipo Helvetica, una con serifa tipo Times o una monoespaciada tipo Courier.",
  },
  {
    q: "¿Puedo editar un PDF escaneado?",
    a: "Todavía no. Un escaneo es una imagen y no tiene texto que se pueda seleccionar. Renglón te avisa cuando detecta páginas así.",
  },
  {
    q: "¿El texto viejo queda escondido en el archivo?",
    a: "En los casos comunes, no: el texto original de cada línea corregida se borra del archivo. Si alguna línea no se puede borrar con seguridad, se tapa y Renglón te avisa cuántas quedaron así al descargar.",
  },
  {
    q: "¿Funciona en el celular?",
    a: "Sí, funciona en el navegador del celular, aunque la experiencia está pensada para la pantalla de un computador.",
  },
];

export default function HomePage() {
  return (
    <div className="home">
      <header className="nav">
        <div className="nav-inner">
          <Brand href="/" />
          <nav aria-label="Secciones">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#privacidad">Privacidad</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <Link href="/editar-pdf" className="btn primary">
            Abrir un PDF
          </Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1 aria-label="Corrige tu PDF renglón por renglón.">
              <span aria-hidden>
                <span className="fix">
                  <span className="fix-old">
                    Rehaz
                    <svg viewBox="0 0 100 12" preserveAspectRatio="none">
                      <path d="M2 7 C 30 3, 65 10, 98 5" pathLength={1} />
                    </svg>
                  </span>
                  <span className="fix-new">
                    corrige
                  </span>
                </span>{" "}
                tu PDF renglón por renglón.
              </span>
            </h1>
            <p className="hero-lede">
              Cambia una fecha, un precio o un nombre en segundos, sin Word y sin rehacer el documento. Todo pasa en tu
              navegador: tu archivo nunca sale de tu equipo.
            </p>
            <div className="hero-cta">
              <Link href="/editar-pdf" className="btn primary lg">
                Abrir un PDF
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/editar-pdf?ejemplo" className="btn lg">
                Probar con un ejemplo
              </Link>
            </div>
            <ul className="hero-trust">
              <li>
                <Check size={15} aria-hidden /> Gratis
              </li>
              <li>
                <Check size={15} aria-hidden /> Sin registro
              </li>
              <li>
                <Check size={15} aria-hidden /> Sin subir archivos
              </li>
            </ul>
          </div>
          <div className="hero-demo">
            <HeroDemo />
          </div>
        </section>

        <section className="steps" id="como-funciona" aria-labelledby="steps-title">
          <h2 id="steps-title">
            Tres pasos.
            <br />
            Cero instalaciones.
          </h2>
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-icon">{s.icon}</span>
                <h3>
                  <span className="step-n">{i + 1}</span>
                  {s.title}
                </h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="feature" aria-labelledby="f-replace">
          <div className="feature-copy">
            <h2 id="f-replace">Cambia un dato en todo el documento de una vez.</h2>
            <p>
              ¿El nombre del cliente aparece en ocho páginas? Búscalo, escribe el nuevo y reemplázalo en todas. Cada
              coincidencia queda resaltada antes de que confirmes.
            </p>
            <p className="feature-try">Pruébalo: cambia el nombre en los campos.</p>
          </div>
          <ReplaceDemo />
        </section>

        <section className="feature feature-flip" aria-labelledby="f-erase">
          <div className="feature-copy">
            <h2 id="f-erase">Borra de verdad. No pone un parche encima.</h2>
            <p>
              Muchos editores tapan el texto viejo con un rectángulo blanco y escriben encima. Se ve bien, pero el dato
              original sigue dentro del archivo. Renglón lo elimina del PDF.
            </p>
            <p className="feature-try">Compara las dos formas con el selector.</p>
          </div>
          <EraseDemo />
        </section>

        <section className="feature" aria-labelledby="f-analysis">
          <div className="feature-copy">
            <h2 id="f-analysis">Entiende tu PDF antes de tocarlo.</h2>
            <p>
              Al abrirlo, Renglón te muestra qué fuentes usa, el tamaño de cada página, sus metadatos y si tiene páginas
              escaneadas que no se pueden editar.
            </p>
          </div>
          <div className="adoc" aria-hidden>
            <div className="adoc-head">
              <ScanSearch size={16} />
              Análisis de <b>cotizacion-cliente.pdf</b>
            </div>
            <dl>
              <dt>Formato</dt>
              <dd>A4 · 210 × 297 mm</dd>
              <dt>Páginas</dt>
              <dd>2</dd>
              <dt>Creado con</dt>
              <dd>Microsoft Word</dd>
            </dl>
            <ul>
              <li>
                <span className="f-sample" style={{ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700 }}>
                  Aa
                </span>
                <span>
                  <b>Helvetica-Bold</b>
                  <small>Sans · negrita · 11 / 14 / 22 pt</small>
                </span>
              </li>
              <li>
                <span className="f-sample" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
                  Aa
                </span>
                <span>
                  <b>Helvetica</b>
                  <small>Sans · 10 / 11 pt</small>
                </span>
              </li>
              <li>
                <span className="f-sample" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                  Aa
                </span>
                <span>
                  <b>Times-Roman</b>
                  <small>Serif · 12 pt</small>
                </span>
              </li>
            </ul>
            <div className="adoc-ok">
              <Check size={14} />
              Sin páginas escaneadas: todo el texto es editable
            </div>
          </div>
        </section>

        <section className="privacy" id="privacidad" aria-labelledby="privacy-title">
          <div className="privacy-copy">
            <h2 id="privacy-title">Tu PDF no sale de tu computador.</h2>
            <p>
              Otros editores en línea suben tu documento a sus servidores para procesarlo. Renglón hace todo el trabajo
              dentro de tu navegador, así que tus contratos, extractos e historias clínicas se quedan contigo.
            </p>
            <ul>
              <li>
                <Lock size={16} aria-hidden /> Sin subir archivos
              </li>
              <li>
                <Check size={16} aria-hidden /> Sin cuentas ni correos
              </li>
              <li>
                <CloudOff size={16} aria-hidden /> Nada que borrar después en la nube
              </li>
            </ul>
          </div>
          <div className="flow" aria-hidden>
            <div className="flow-device">
              <span className="flow-label">Tu navegador</span>
              <div className="flow-row">
                <span className="flow-doc">PDF</span>
                <span className="flow-track">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="flow-engine">Renglón</span>
                <span className="flow-track">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="flow-doc flow-doc-done">PDF</span>
              </div>
            </div>
            <div className="flow-cut">
              <svg viewBox="0 0 24 64">
                <path d="M12 0v64" />
              </svg>
              <span>×</span>
            </div>
            <div className="flow-cloud">
              <CloudOff size={22} />
              Servidores
              <small>Nunca reciben tu archivo</small>
            </div>
          </div>
        </section>

        <section className="faq" id="preguntas" aria-labelledby="faq-title">
          <h2 id="faq-title">Preguntas frecuentes</h2>
          <div className="faq-list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cta">
          <h2>¿Tienes un PDF por corregir?</h2>
          <p>Ábrelo, cambia lo que necesites y descárgalo. Toma menos de un minuto.</p>
          <Link href="/editar-pdf" className="btn lg cta-btn">
            Abrir un PDF
            <ArrowRight size={18} aria-hidden />
          </Link>
        </section>
      </main>

      <footer className="footer">
        <Brand href="/" />
        <nav aria-label="Pie de página">
          <Link href="/editar-pdf">Editar un PDF</Link>
          <a href="#privacidad">Privacidad</a>
          <a href="#preguntas">Preguntas</a>
        </nav>
        <span>© {new Date().getFullYear()} Renglón</span>
      </footer>
    </div>
  );
}
