import type { Metadata } from "next";
import { CONTACT_EMAIL } from "../../../lib/site";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones para usar Renglón, el editor de PDF que funciona en tu navegador.",
  alternates: { canonical: "/terminos" },
};

export default function TermsPage() {
  return (
    <main className="page-wrap">
      <article className="prose">
        <h1>Términos de uso</h1>
        <p className="prose-meta">Última actualización: 16 de octubre de 2026</p>

        <p className="prose-lede">
          Al usar Renglón (renglonpdf.online) aceptas estas condiciones. Son cortas a propósito: léelas antes de
          editar tus documentos.
        </p>

        <section>
          <h2>1. Qué es Renglón</h2>
          <p>
            Renglón es una herramienta para analizar y editar el texto de archivos PDF directamente en tu navegador.
            Tus documentos se procesan en tu equipo y no se suben a nuestros servidores, como se explica en la política
            de privacidad. Puedes usarla gratis, con un límite diario de descargas, o con un plan pago sin ese límite.
          </p>
        </section>

        <section>
          <h2>2. Cuentas y planes pagos</h2>
          <p>
            Para comprar un plan necesitas una cuenta con datos verdaderos. Eres responsable de lo que se haga con ella;
            no compartas tu contraseña.
          </p>
          <p>
            El pase semanal y los planes Pro mensual y anual son pagos únicos que se cobran en pesos colombianos a través
            de Wompi, con los precios publicados en la página de precios al momento de pagar. Cada pago te da acceso por
            el periodo indicado (7, 30 o 365 días) y no se renueva solo. Si pagas antes de que venza tu plan, el tiempo
            nuevo se suma al que te queda. Mientras tu plan está vigente descargas sin el límite diario y no ves
            anuncios.
          </p>
          <p>
            Si tienes un problema con un pago o con la activación de tu plan, escríbenos y lo revisaremos. Podemos
            cambiar los precios o los límites del plan gratis; los cambios no afectan el tiempo que ya pagaste.
          </p>
        </section>

        <section>
          <h2>3. Uso responsable</h2>
          <p>Eres responsable de los documentos que editas y del uso que les das. Te comprometes a no usar Renglón para:</p>
          <ul>
            <li>
              Alterar documentos con el fin de engañar a otras personas o entidades, como falsificar facturas,
              certificados, extractos, documentos de identidad o cualquier documento oficial.
            </li>
            <li>Modificar documentos sobre los que no tienes derecho o autorización.</li>
            <li>Cometer fraudes o cualquier actividad contraria a la ley.</li>
          </ul>
          <p>La falsedad en documentos es un delito en Colombia y en la mayoría de países.</p>
        </section>

        <section>
          <h2>4. Resultados y revisión</h2>
          <p>
            Renglón intenta conservar el aspecto original de cada línea que corriges, pero la fuente, el espaciado o la
            posición del texto nuevo pueden variar respecto al original. Revisa siempre el PDF descargado antes de
            usarlo o enviarlo.
          </p>
        </section>

        <section>
          <h2>5. Sin garantías</h2>
          <p>
            El servicio se ofrece «tal como está», sin garantías de ningún tipo. No garantizamos que funcione sin
            interrupciones ni que sea compatible con todos los archivos PDF. Guarda siempre una copia de tus documentos
            originales.
          </p>
        </section>

        <section>
          <h2>6. Limitación de responsabilidad</h2>
          <p>
            En la medida permitida por la ley, Renglón no será responsable por daños derivados del uso o de la
            imposibilidad de usar el servicio, incluida la pérdida de información o los errores en los documentos
            editados.
          </p>
        </section>

        <section>
          <h2>7. Publicidad</h2>
          <p>
            Para mantener el plan gratis, las páginas informativas del sitio pueden mostrar anuncios de terceros. El
            editor no muestra anuncios, y quienes tienen un plan pago no ven anuncios en ninguna parte del sitio.
          </p>
        </section>

        <section>
          <h2>8. Cambios y ley aplicable</h2>
          <p>
            Podemos actualizar estos términos; la versión vigente es la publicada en esta página. Estos términos se rigen
            por las leyes de la República de Colombia.
          </p>
          {CONTACT_EMAIL ? (
            <p>
              Si tienes preguntas, escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          ) : null}
        </section>
      </article>
    </main>
  );
}
