/** Guías prácticas: contenido para quien busca en Google cómo corregir un PDF. */

export interface GuideSection {
  title: string;
  body?: string[];
  steps?: string[];
  tip?: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  updated: string; // ISO
  intro: string[];
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "como-cambiar-la-fecha-de-un-pdf",
    title: "Cómo cambiar la fecha de un PDF sin rehacer el documento",
    description:
      "Corrige la fecha de una cotización, un certificado o una carta en PDF en menos de un minuto, sin Word y sin subir el archivo.",
    updated: "2026-10-14",
    intro: [
      "Te pasa con una cotización que vuelves a enviar, una carta que firmaste hace un mes o un formato que reutilizas cada semestre: todo está bien, salvo la fecha. Rehacer el documento desde cero es lento, y muchas veces ya no tienes el archivo original de Word.",
      "La buena noticia es que casi todos los PDF generados por computador guardan el texto como texto, no como imagen. Eso significa que puedes cambiar solo la línea de la fecha y dejar intacto todo lo demás.",
    ],
    sections: [
      {
        title: "Paso a paso",
        steps: [
          "Abre el editor de Renglón y arrastra tu PDF a la página, o pulsa «Elegir un PDF».",
          "Busca la línea de la fecha y haz clic sobre ella. El texto se vuelve editable en ese mismo lugar.",
          "Escribe la fecha nueva. Si la fecha aparece en varias páginas, usa la pestaña «Buscar» y el botón «Reemplazar todo».",
          "Revisa la pestaña «Cambios» para confirmar qué líneas modificaste. Puedes restaurar cualquiera.",
          "Pulsa «Descargar». Obtienes el mismo PDF con la fecha corregida.",
        ],
      },
      {
        title: "Si la fecha aparece varias veces",
        body: [
          "En contratos y certificados la fecha suele repetirse: en el encabezado, en el cuerpo y junto a la firma. En lugar de buscarla página por página, escribe la fecha vieja en «Buscar», la nueva en «Reemplazar por» y aplica el cambio a todo el documento de una vez. Cada coincidencia queda resaltada antes de que confirmes.",
        ],
        tip: "Busca solo la parte que cambia. Si únicamente pasa de 2026 a 2027, buscar «2026» es más rápido que escribir la fecha completa, pero revisa las coincidencias: el año también puede aparecer en números de factura o referencias.",
      },
      {
        title: "¿Y si no puedo hacer clic en la fecha?",
        body: [
          "Si el PDF es un escaneo o una foto de un documento impreso, no tiene texto que se pueda editar: es una imagen. Renglón te avisa cuando detecta páginas así en la pestaña «Análisis». En ese caso la solución es volver a generar el documento o usar una herramienta de reconocimiento de texto (OCR).",
        ],
      },
    ],
  },
  {
    slug: "como-editar-una-cotizacion-en-pdf",
    title: "Cómo editar los precios de una cotización en PDF",
    description:
      "Actualiza valores, totales y datos del cliente en una cotización en PDF directamente en tu navegador, manteniendo el diseño original.",
    updated: "2026-10-14",
    intro: [
      "Una cotización en PDF suele pasar por varias versiones: cambia un precio, se agrega un descuento o hay que actualizar el total. Si la generaste con una plantilla que ya no tienes a mano, editar el PDF directamente es la forma más rápida de enviar la versión corregida.",
    ],
    sections: [
      {
        title: "Qué puedes cambiar",
        body: [
          "Cualquier línea de texto del documento: el nombre del cliente, la fecha, el valor de cada concepto, el subtotal, el IVA y el total. Renglón detecta la fuente, el tamaño, el color y si el texto está en negrita, y escribe tu corrección con la apariencia más parecida.",
        ],
      },
      {
        title: "Paso a paso",
        steps: [
          "Abre la cotización en el editor.",
          "Haz clic en el valor que quieres cambiar, por ejemplo «$ 2.500.000», y escribe el nuevo.",
          "Corrige también el total. Renglón no recalcula sumas: cambia exactamente el texto que escribes, así que revisa que los números cuadren.",
          "Si necesitas agregar una nota, como un descuento o una condición nueva, usa «Agregar texto» y haz clic donde quieras escribirla.",
          "Descarga el PDF y revísalo antes de enviarlo.",
        ],
        tip: "Las tablas de una cotización suelen tener cada columna como un renglón independiente. Puedes cambiar el valor sin tocar el concepto ni la cantidad de la misma fila.",
      },
      {
        title: "Cuida la consistencia",
        body: [
          "Antes de enviar la nueva versión, revisa tres cosas: que el total coincida con la suma de los conceptos, que la fecha de validez siga vigente y que el consecutivo o número de cotización sea el correcto si tu empresa lo cambia en cada versión.",
        ],
      },
    ],
  },
  {
    slug: "como-cambiar-un-nombre-en-todo-un-pdf",
    title: "Cómo cambiar un nombre en todo un PDF de una sola vez",
    description:
      "Usa buscar y reemplazar para cambiar el nombre de un cliente, una empresa o una persona en todas las páginas de un PDF.",
    updated: "2026-10-14",
    intro: [
      "Reutilizar un contrato, una propuesta o un certificado para otra persona es muy común. El problema es que el nombre aparece en muchos lugares y es fácil que se te escape uno. Buscar y reemplazar resuelve eso: encuentra todas las apariciones y las cambia a la vez.",
    ],
    sections: [
      {
        title: "Paso a paso",
        steps: [
          "Abre el PDF en el editor.",
          "Ve a la pestaña «Buscar» de la barra lateral.",
          "Escribe el nombre actual en «Buscar». Cada coincidencia se resalta en amarillo en el documento y aparece en la lista, con su número de página.",
          "Escribe el nombre nuevo en «Reemplazar por».",
          "Pulsa «Reemplazar todo». Si algo no quedó bien, deshaz con Ctrl+Z.",
        ],
      },
      {
        title: "Mayúsculas, minúsculas y variantes",
        body: [
          "Por defecto la búsqueda no distingue mayúsculas, así que «JUAN PÉREZ» y «Juan Pérez» se encuentran juntos. Si el documento usa ambas formas y quieres respetarlas, activa «Distinguir mayúsculas» y haz un reemplazo para cada variante.",
          "Revisa también las versiones abreviadas, como «Sr. Pérez» o solo el apellido. Búscalas por separado.",
        ],
        tip: "Si el nombre nuevo es mucho más largo que el anterior, revisa que no se monte sobre el texto que tiene al lado. Puedes reducir el tamaño de esa línea desde la barra flotante.",
      },
    ],
  },
  {
    slug: "como-borrar-texto-de-un-pdf-sin-dejar-rastro",
    title: "Cómo borrar texto de un PDF sin que quede escondido en el archivo",
    description:
      "Por qué tapar un dato con un rectángulo blanco no lo elimina de un PDF, y cómo borrarlo de verdad antes de compartir el documento.",
    updated: "2026-10-14",
    intro: [
      "Muchas personas «borran» un dato de un PDF dibujando un rectángulo blanco o negro encima. Visualmente funciona, pero el texto original sigue dentro del archivo: cualquiera puede seleccionarlo, copiarlo o encontrarlo con el buscador del lector de PDF.",
      "Si vas a compartir un documento con información sensible, como un número de cuenta, un precio interno o los datos de otra persona, necesitas que el texto desaparezca del archivo, no solo de la vista.",
    ],
    sections: [
      {
        title: "Tapar no es borrar",
        body: [
          "Un PDF está hecho de capas. Cuando pones un rectángulo encima de un texto, agregas una capa más, pero la de abajo sigue ahí. Por eso es común que se filtren datos de documentos que parecían censurados.",
        ],
      },
      {
        title: "Cómo lo hace Renglón",
        body: [
          "Cuando corriges o eliminas una línea, Renglón quita su texto original del contenido de la página al descargar, y escribe el nuevo en su lugar. Así, quien copie ese renglón del PDF solo obtiene lo que tú escribiste.",
          "En algunos casos no es posible borrarlo con seguridad, por ejemplo si el texto está dentro de una capa de reconocimiento de texto (OCR) o el PDF está cifrado. Entonces la línea se tapa con el color de fondo y, al descargar, Renglón te avisa cuántas líneas quedaron así para que decidas.",
        ],
      },
      {
        title: "Cómo comprobarlo tú mismo",
        steps: [
          "Abre el PDF descargado en tu lector habitual.",
          "Usa la búsqueda del lector (Ctrl+F) y escribe el dato que eliminaste.",
          "Si no aparece ningún resultado, el texto ya no está en el archivo.",
        ],
        tip: "Para documentos legales o con datos personales de terceros, revisa también los metadatos del archivo (título, autor) y las anotaciones o comentarios, que se guardan aparte del texto de la página.",
      },
    ],
  },
  {
    slug: "por-que-no-puedo-editar-un-pdf-escaneado",
    title: "Por qué no puedo editar el texto de un PDF escaneado",
    description:
      "Cómo saber si tu PDF es un escaneo, por qué su texto no se puede editar directamente y qué alternativas tienes.",
    updated: "2026-10-14",
    intro: [
      "Abres un PDF, intentas hacer clic en una palabra y no pasa nada. Lo más probable es que el documento sea un escaneo: una foto de una hoja impresa guardada como PDF. Para el computador, esa página es una imagen, igual que una fotografía.",
    ],
    sections: [
      {
        title: "Cómo saber si tu PDF es un escaneo",
        steps: [
          "Intenta seleccionar una palabra con el ratón en tu lector de PDF. Si no se resalta, es una imagen.",
          "Busca una palabra con Ctrl+F. Si no la encuentra aunque la ves en pantalla, es una imagen.",
          "En Renglón, la pestaña «Análisis» marca las páginas sin texto como posibles escaneos.",
        ],
      },
      {
        title: "Qué alternativas tienes",
        body: [
          "La mejor opción es conseguir el archivo original, el que se exportó desde Word, Excel o el sistema que generó el documento: su texto sí es editable.",
          "Si no existe, una herramienta de reconocimiento óptico de caracteres (OCR) puede convertir la imagen en texto. El resultado depende de la calidad del escaneo y suele requerir revisión, sobre todo en tablas y números.",
          "Para cambios pequeños, como agregar una fecha o una nota, puedes usar «Agregar texto» en Renglón y escribir sobre la página, aunque el texto original de la imagen no cambie.",
        ],
      },
    ],
  },
];

export const findGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);
