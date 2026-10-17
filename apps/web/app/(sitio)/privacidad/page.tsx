import type { Metadata } from "next";
import { CONTACT_EMAIL } from "../../../lib/site";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo trata Renglón tus documentos y tus datos: los PDF se procesan en tu navegador y nunca se suben a un servidor.",
  alternates: { canonical: "/privacidad" },
};

export default function PrivacyPage() {
  return (
    <main className="page-wrap">
      <article className="prose">
        <h1>Política de privacidad</h1>
        <p className="prose-meta">Última actualización: 16 de octubre de 2026</p>

        <p className="prose-lede">
          Renglón (renglonpdf.online) es un editor de PDF que funciona dentro de tu navegador. Esta política explica qué
          pasa con tus documentos, qué datos se generan cuando visitas el sitio y qué derechos tienes sobre ellos.
        </p>

        <section>
          <h2>1. Tus documentos no salen de tu equipo</h2>
          <p>
            Cuando abres un PDF en el editor, el archivo se lee, se analiza y se modifica únicamente en tu navegador. No
            se envía a nuestros servidores ni a los de terceros, no lo almacenamos y no podemos verlo. Al cerrar la
            pestaña, el documento deja de estar en memoria.
          </p>
          <p>
            La página del editor no carga anuncios ni scripts de publicidad o analítica de terceros, para que ningún
            código externo tenga acceso al contenido que estás editando.
          </p>
        </section>

        <section>
          <h2>2. Datos que se generan al visitar el sitio</h2>
          <p>
            No necesitas crear una cuenta ni darnos tu nombre o correo para usar el plan gratis de Renglón. Como
            cualquier sitio web, el servidor recibe datos técnicos de cada visita, como la dirección IP, el tipo de
            navegador y la página solicitada. Los usamos solo para que el sitio funcione, mantenerlo seguro y detectar
            errores, y no los cruzamos con otra información para identificarte.
          </p>
          <p>
            Para aplicar el límite diario del plan gratis contamos cuántas descargas y páginas generas cada día. Si no
            has iniciado sesión, ese conteo se guarda con un código derivado de tu dirección IP (un resumen
            criptográfico, no la IP) y solo sirve para ese fin. Nunca registramos el contenido ni el nombre de tus
            documentos.
          </p>
        </section>

        <section>
          <h2>3. Cuentas y pagos</h2>
          <p>
            Si creas una cuenta guardamos tu nombre, tu correo y tu contraseña cifrada (o el identificador de tu cuenta
            de Google si entras con Google), además de tus sesiones abiertas (fecha, dirección IP y navegador), tu plan y
            el historial de tus pagos (referencia, plan, valor, estado y fecha). Usamos estos datos para darte acceso,
            activar tu plan, enviarte correos sobre tu cuenta (como un enlace para entrar o un aviso de que tu plan está
            por vencer) y atender tus solicitudes.
          </p>
          <p>
            Los pagos los procesa Wompi (de Bancolombia). Los datos de tu tarjeta o cuenta bancaria los ingresas en el
            sitio de Wompi y nosotros no los recibimos ni los guardamos; Wompi nos informa solo el resultado del pago.
            El tratamiento que hace Wompi de tus datos se rige por su propia política.
          </p>
          <p>
            Puedes eliminar tu cuenta cuando quieras desde «Mi cuenta». Al hacerlo se borran tu perfil, tus sesiones y tu
            plan; los registros de pagos se conservan sin vínculo con tu cuenta por razones contables.
          </p>
        </section>

        <section>
          <h2>4. Publicidad y cookies</h2>
          <p>
            Las páginas informativas del sitio, como la portada y las guías, pueden mostrar anuncios de Google AdSense.
            Google y sus socios pueden usar cookies para mostrar anuncios basados en tus visitas a este y otros sitios,
            o anuncios no personalizados si así lo eliges. Puedes consultar cómo usa Google estos datos en{" "}
            <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer">
              policies.google.com/technologies/partner-sites
            </a>{" "}
            y desactivar la publicidad personalizada en{" "}
            <a href="https://adssettings.google.com" rel="noopener noreferrer">
              adssettings.google.com
            </a>
            .
          </p>
          <p>
            Cuando la ley lo exige, por ejemplo para visitantes del Espacio Económico Europeo y el Reino Unido, te
            pediremos tu consentimiento antes de usar cookies publicitarias. Si tienes un plan pago, no cargamos
            anuncios ni sus scripts.
          </p>
          <p>
            Si inicias sesión, usamos cookies propias, necesarias para mantener tu sesión abierta. No se usan para
            publicidad.
          </p>
        </section>

        <section>
          <h2>5. Tus derechos</h2>
          <p>
            De acuerdo con la Ley 1581 de 2012 de Colombia y sus normas reglamentarias, tienes derecho a conocer,
            actualizar, rectificar y suprimir los datos personales que se traten sobre ti, a solicitar prueba de la
            autorización otorgada y a revocarla, y a presentar quejas ante la Superintendencia de Industria y Comercio.
          </p>
          {CONTACT_EMAIL ? (
            <p>
              Para ejercer estos derechos o hacer cualquier consulta sobre privacidad, escríbenos a{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          ) : null}
        </section>

        <section>
          <h2>6. Cambios a esta política</h2>
          <p>
            Si cambiamos la forma en que tratamos los datos, actualizaremos esta página y la fecha de la parte superior.
            Si el cambio es importante, lo indicaremos de forma visible en el sitio.
          </p>
        </section>
      </article>
    </main>
  );
}
