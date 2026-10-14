/**
 * Configuración del sitio público. Los valores de entorno se leen al compilar
 * (en el servidor vienen de deploy/.env como argumentos de construcción).
 */

export const SITE_URL = "https://renglonpdf.online";

/** Identificador de editor de AdSense, p. ej. «ca-pub-1234567890123456». Vacío = sin anuncios. */
export const ADSENSE_CLIENT = (process.env.ADSENSE_CLIENT ?? "").trim();

/** Bloque de anuncios (data-ad-slot) que se usa en los espacios manuales. */
export const ADSENSE_SLOT = (process.env.ADSENSE_SLOT ?? "").trim();

/** Muestra recuadros de prueba en lugar de anuncios reales (solo para revisar el diseño). */
export const ADS_PREVIEW = process.env.ADS_PREVIEW === "1";

/** Correo de contacto que aparece en las páginas legales. Vacío = no se muestra. */
export const CONTACT_EMAIL = (process.env.CONTACT_EMAIL ?? "").trim();

export const adsEnabled = () => /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);
