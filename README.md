# Editor PDF

Editor de PDF que corre 100 % en el navegador: analiza el documento y permite editar su texto en línea. Ningún archivo se sube a un servidor. Publicado como **Renglón** en https://renglonpdf.online, con cuentas de usuario y planes pagos (ver [Cuentas y pagos](#cuentas-y-pagos)).

## Estructura

Monorepo con [pnpm workspaces](https://pnpm.io/workspaces) y [Turborepo](https://turborepo.com):

```
apps/
  web/              Next.js (App Router): portada en /, editor en /editar-pdf, cuentas, precios y pagos
    lib/server/     Base de datos (Drizzle), Better Auth, planes y uso, Wompi
    drizzle/        Migraciones SQL versionadas
packages/
  pdf-core/         Motor: análisis, estado de edición, borrado del texto original y exportación
  editor-ui/        Componentes React del editor (PdfEditor, PageView, Sidebar…) y sus estilos
  config/           tsconfig base compartido
```

- **`@pdf-editor/pdf-core`** no depende de React ni del DOM, así puede reutilizarse en una API, un SDK o una app de escritorio. Lo que necesita el navegador (render en canvas, colores leídos de los píxeles, medir texto, descargar) vive en `@pdf-editor/pdf-core/browser`. pdf.js se inyecta con `configurePdfjs()`: en el navegador lo hace `setupBrowserPdfjs()` y en Node se pasa el build `pdfjs-dist/legacy`. El chequeo de tipos compila el núcleo sin los tipos del DOM para que no se cuele una dependencia del navegador.
- **`@pdf-editor/editor-ui`** exporta `<PdfEditor assetsUrl sampleUrl autoLoadSample homeHref />` y `styles.css`.
- **`apps/web`** monta el editor como componente solo de cliente (`next/dynamic` con `ssr: false`). Antes de `dev` y `build`, `scripts/copy-pdfjs-assets.mjs` copia a `public/pdfjs` el worker de pdf.js y sus fuentes estándar, cmaps, wasm e ICC (de la misma versión de `pdfjs-dist` que usa el núcleo), y a `public/ejemplo.pdf` el PDF de ejemplo del corpus.

Los paquetes se consumen como código TypeScript fuente (Next los transpila con `transpilePackages`), así que no tienen paso de build propio.

## Comandos

Requiere Node 22 o superior y pnpm (la versión está fijada en `packageManager`; con Corepack: `corepack enable pnpm`).

```bash
pnpm install
```

```bash
pnpm dev
```

Abre http://localhost:5173 (o http://renglon.localhost:5173 si vas a probar pagos, ver [Probar en local](#probar-en-local)). La portada enlaza al editor (`/editar-pdf`); ahí arrastra un PDF o pulsa **Probar con un ejemplo** (`/editar-pdf?ejemplo` lo abre directamente).

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo de la app web en el puerto 5173. |
| `pnpm build` | Build de producción de todo el monorepo (Turborepo cachea lo que no cambió). |
| `pnpm test` | Pruebas de `pdf-core` y de la web (planes, límites, firmas de Wompi, idempotencia, cuentas) con Vitest. |
| `pnpm typecheck` | Chequeo de tipos de todos los paquetes. |
| `pnpm sample` | Regenera `packages/pdf-core/tests/corpus/ejemplo.pdf`. |

Para trabajar en un solo paquete: `pnpm --filter @pdf-editor/pdf-core test:watch`, `pnpm --filter @pdf-editor/web dev`, etc.

Cambios en la base de datos: edita `apps/web/lib/server/db/schema.ts` y genera la migración con `pnpm --filter @pdf-editor/web db:generate`. Se aplica sola al arrancar el servidor.

## Pruebas

Las pruebas del motor viven en `packages/pdf-core/tests` y corren en Node con el build legacy de pdf.js:

- `analyze.test.ts`: metadatos y agrupación de fragmentos en líneas (columnas separadas por un espacio ancho, celdas de tabla, párrafos).
- `editor.test.ts`: historial (aplicar, deshacer, rehacer) y buscar/reemplazar.
- `export.test.ts`: exportar → reabrir → comprobar con `getTextContent` que el texto editado aparece, que el original se borró del archivo y que el resto de la línea sigue intacto.
- `corpus.test.ts`: prueba de humo sobre cada PDF de `tests/corpus/`.

```bash
pnpm test
```

```bash
pnpm --filter @pdf-editor/pdf-core test:watch
```

Para sumar PDFs reales (anonimizados) al corpus, ver [`packages/pdf-core/tests/corpus/README.md`](packages/pdf-core/tests/corpus/README.md).

Las de la web viven en `apps/web/tests` y usan un Postgres en memoria ([PGlite](https://pglite.dev)) con las migraciones reales, así que no necesitan Docker:

- `billing.test.ts`: permisos por plan, límites diarios (incluidas descargas simultáneas), pagos que extienden la vigencia, webhook firmado e idempotencia.
- `wompi.test.ts`: firma de integridad y verificación de eventos con los ejemplos de la documentación de Wompi.
- `auth.test.ts`: registro, inicio de sesión y sesión con Better Auth sobre el esquema de Drizzle.

La CI (`.github/workflows/ci.yml`) instala, chequea tipos, corre las pruebas y hace el build en cada push a `main` y en cada pull request.

## Despliegue

Producción corre en un VPS con Docker Compose (`deploy/`):

| Servicio | Qué hace |
| --- | --- |
| `caddy` | Único que publica puertos (80/443). Saca el certificado HTTPS solo, redirige `www` al dominio principal y hace de proxy hacia la web. |
| `web` | Next.js en modo `standalone` (`deploy/Dockerfile`), solo en la red interna de Docker. Al arrancar aplica las migraciones pendientes. |
| `db` | Postgres 17 con su volumen `pg_data`, solo en la red interna (`expose`, sin `ports`). |

Los puertos que publica Docker se saltan `ufw`: no agregues `ports:` a otros servicios; usa `expose:`.

Primera vez, en el servidor:

```bash
git clone https://github.com/darkounus90/pdf-editor.git ~/renglon
cd ~/renglon/deploy
cp .env.example .env   # completar DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD y BETTER_AUTH_SECRET
docker compose up -d --build
bash install-daily-jobs.sh   # copia de seguridad diaria y avisos de vencimiento
```

Para actualizar a la última versión de `main`:

```bash
~/renglon/deploy/update.sh
```

### Anuncios y contacto

Los anuncios de Google AdSense solo se cargan en las páginas públicas (portada, guías, legales), que viven en el grupo `apps/web/app/(sitio)`. El editor queda fuera de ese grupo a propósito: ningún script de terceros debe tener acceso al documento que se está editando.

Se configuran en `deploy/.env` y se fijan al compilar la imagen:

| Variable | Qué hace |
| --- | --- |
| `ADSENSE_CLIENT` | Identificador de editor (`ca-pub-…`). Activa el script de AdSense y genera `/ads.txt`. |
| `ADSENSE_SLOT` | Id de un bloque de anuncios adaptable; muestra los espacios manuales. |
| `CONTACT_EMAIL` | Correo que aparece en Privacidad y Términos. |

Después de cambiarlas: `cd ~/renglon/deploy && docker compose up -d --build`. En local, `ADS_PREVIEW=1` muestra recuadros de prueba en lugar de anuncios.

### Despliegue automático

`deploy/auto-update.sh` corre por cron cada 5 minutos en el servidor: si `main` avanzó en GitHub y la CI de ese commit terminó en verde, ejecuta `update.sh`. Si la CI falló, no despliega ese commit. El servidor solo lee de GitHub, así que no hay llaves del servidor guardadas en el repositorio.

Instalarlo (una vez, en el servidor):

```bash
bash ~/renglon/deploy/install-auto-update.sh
```

Ver qué ha desplegado: `tail ~/renglon-deploy.log`.

Para probar la salida de producción sin Docker: `NEXT_OUTPUT=standalone pnpm --filter @pdf-editor/web build`.

## Cuentas y pagos

Renglón es freemium: el plan gratis no pide cuenta y tiene un límite diario de descargas (y de páginas); los planes pagos quitan los límites y los anuncios.

| Plan | Vigencia por pago | Precio por defecto (COP) | Variable |
| --- | --- | --- | --- |
| Gratis | — | $0 | `FREE_DAILY_DOWNLOADS` (3), `FREE_DAILY_PAGES` (60) |
| Pase semanal | 7 días | $7.900 | `PRICE_WEEKLY_COP` |
| Pro mensual | 30 días | $16.900 | `PRICE_PRO_MONTHLY_COP` |
| Pro anual | 365 días | $129.000 | `PRICE_PRO_YEARLY_COP` |

### Cómo funciona

- **Base de datos**: Postgres con [Drizzle](https://orm.drizzle.team) (`apps/web/lib/server/db`). Tablas de Better Auth (`user`, `session`, `account`, `verification`) más `subscription` (vigencia del plan pago, una fila por usuario), `payment` (cada intento de pago), `payment_event` (eventos de Wompi recibidos) y `daily_usage` (descargas y páginas por día, hora de Colombia). Sin `DATABASE_URL`, en desarrollo se usa PGlite guardado en `apps/web/.data/pglite`.
- **Cuentas**: [Better Auth](https://www.better-auth.com) en `/api/auth/*` con correo y contraseña. El enlace mágico y «olvidé mi contraseña» se activan con `SMTP_URL`; Google, con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Páginas: `/registro`, `/ingresar`, `/recuperar`, `/restablecer` y `/cuenta` (plan, uso del día, pagos, cerrar sesión y eliminar la cuenta).
- **Permisos**: `GET /api/cuenta/funciones` devuelve el plan, la vigencia, si hay anuncios y los límites (`?uso=1` agrega el uso de hoy). Antes de cada descarga el editor llama a `POST /api/uso/descarga` con el número de páginas; el servidor comprueba el límite y suma el uso en una sola sentencia (dos descargas simultáneas no se pasan del límite) y responde 429 con el mensaje para pasarse a Pro. Sin sesión, el uso se cuenta con un hash de la IP. Si ese servicio falla, el editor deja descargar: el PDF nunca sale del navegador y el límite es solo comercial.
- **Anuncios**: las páginas públicas consultan el plan y solo cargan AdSense (y muestran `<Ad />`) si el plan los incluye.
- **Pagos con Wompi**: Wompi no tiene suscripciones nativas (solo [fuentes de pago](https://docs.wompi.co/docs/colombia/fuentes-de-pago/) tokenizadas para cobrar desde el servidor), así que cada plan es un pago único que extiende la vigencia; si se paga antes de vencer, el tiempo se suma. `/precios` llama a `POST /api/pagos/checkout`, que crea el pago y devuelve la URL del [Web Checkout](https://docs.wompi.co/docs/colombia/widget-checkout-web/) con la firma de integridad (SHA-256 de referencia + monto en centavos + moneda + fecha de expiración + secreto). Wompi avisa el resultado a `POST /api/pagos/wompi`: se verifica el checksum del [evento](https://docs.wompi.co/docs/colombia/eventos/) con el secreto de eventos, se compara el monto y la moneda con el pago y se aplica. El plan se extiende una sola vez por pago aunque el evento llegue repetido o la página de retorno (`/cuenta/pago`, que consulta la transacción en la API de Wompi) lo aplique al mismo tiempo.
- **Avisos de vencimiento**: «Mi cuenta» y el editor muestran el aviso unos días antes (1 día el pase semanal, 3 el mensual, 7 el anual). Con SMTP, `deploy/send-reminders.sh` (cron diario) llama a `GET /api/cron/avisos`, que envía un correo por vigencia.

### Probar en local

Sin Docker: `pnpm dev` crea la base PGlite y aplica las migraciones. Copia `apps/web/.env.example` a `apps/web/.env.local` y:

1. Abre el sitio en **http://renglon.localhost:5173** y pon `BETTER_AUTH_URL=http://renglon.localhost:5173`. El firewall de Wompi rechaza el checkout si la URL de retorno es `localhost` o `127.0.0.1` (con esas, la app la omite y Wompi muestra su propio resultado).
2. Pon las llaves de **Sandbox** de Wompi. En el checkout de pruebas, la tarjeta `4242 4242 4242 4242` (cualquier fecha futura y CVC) se aprueba y la `4111 1111 1111 1111` se rechaza.
3. Wompi no puede llamar al webhook en tu PC: la página de retorno `/cuenta/pago` consulta la transacción y activa el plan igual. Para probar el webhook, expón el puerto con un túnel y registra esa URL en el panel de Sandbox.

Sin SMTP, los correos (enlace mágico, recuperar contraseña) se imprimen en la consola de `pnpm dev`. Con Docker también puedes usar Postgres: `docker compose -f deploy/docker-compose.dev.yml up -d` y `DATABASE_URL=postgres://renglon:renglon@127.0.0.1:5433/renglon`.

### Configurar Wompi en producción

1. Crea la cuenta de comercio en [comercios.wompi.co](https://comercios.wompi.co) y completa la verificación para habilitar el ambiente de Producción.
2. En el panel, en la sección de desarrolladores (según la versión, **Desarrolladores** o **Mi cuenta → Secretos para integración técnica**), copia las cuatro llaves del ambiente de Producción: la pública (`pub_prod_…`), la privada (`prv_prod_…`), el secreto de integridad (`prod_integrity_…`) y el de eventos (`prod_events_…`). Sandbox tiene su propio juego (`pub_test_…`, `prv_test_…`, `test_integrity_…`, `test_events_…`).
3. En la misma sección, en **URL de eventos**, registra `https://renglonpdf.online/api/pagos/wompi` para Producción. Si vas a probar con Sandbox en el sitio publicado, registra la misma URL también en Sandbox (cada ambiente firma con su propio secreto de eventos, así que solo funciona el ambiente cuyas llaves estén en `deploy/.env`).
4. En el servidor, pon las cuatro llaves en `deploy/.env` (`WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`) y reinicia la web: `cd ~/renglon/deploy && docker compose up -d`. Con llaves `pub_test_…` la página de precios muestra el aviso de «Modo de pruebas».
5. Haz una compra real pequeña (por ejemplo bajando `PRICE_WEEKLY_COP` un momento) y revisa que el pago aparezca **Aprobado** en `/cuenta` y en `docker compose logs web | grep wompi`.

Si un evento llega con firma inválida, la ruta responde 401 y lo registra en el log; si falla la base, responde 500 y Wompi lo reintenta (30 minutos, 3 horas y 24 horas después).

### Copias de seguridad

`deploy/backup-db.sh` guarda un `pg_dump` diario en `~/renglon-backups` (se conservan 14 días) y `deploy/install-daily-jobs.sh` lo programa en cron junto con los avisos. Para restaurar una copia:

```bash
cd ~/renglon/deploy
docker compose exec -T db pg_restore -U renglon -d renglon --clean --if-exists < ~/renglon-backups/renglon-AAAA-MM-DD-HHMM.dump
```

Conviene copiar esa carpeta fuera del VPS de vez en cuando (por ejemplo con `rsync` o `scp` a tu PC).

## Qué hace

- **Análisis**: metadatos, versión, tamaño de página (A4, Carta, Oficio…), campos de formulario, conteo de líneas y palabras, fuentes reales (nombre, negrita/cursiva, tamaños) y detección de páginas sin texto (escaneos que necesitarían OCR).
- **Edición en línea**: clic en cualquier línea para cambiar el texto, la fuente, el tamaño, negrita/cursiva y el color, moverla (arrastrando el asa ⠿) o eliminarla.
- **Agregar texto** en cualquier punto de la página.
- **Buscar y reemplazar** en todo el documento.
- **Historial** con deshacer/rehacer (Ctrl+Z / Ctrl+Y) y lista de cambios con opción de restaurar.
- **Descargar** el PDF editado (`nombre-editado.pdf`). El texto original de las líneas editadas o eliminadas se borra del archivo, no solo se tapa.

## Cómo funciona

Las rutas son relativas a `packages/pdf-core/src`.

| Etapa | Archivo | Detalle |
| --- | --- | --- |
| Lectura y render | `analyze.ts`, `browser.ts` | pdf.js extrae los fragmentos de texto con su posición y los agrupa en líneas (misma fuente, tamaño y línea base; los huecos grandes separan columnas y celdas). Al renderizar cada página se lee la fuente real y se estima el color del texto y del fondo a partir de los píxeles. |
| Estado | `editor.ts` | Las ediciones se guardan como diferencias sobre el bloque original, con historial. |
| Borrado del original | `contentStream.ts`, `eraseText.ts` | Se decodifica el flujo de contenido de cada página editada, se tokeniza (cadenas, arreglos, imágenes en línea) y se sigue el estado gráfico y de texto (`q`/`Q`/`cm`, `BT`, `Tm`, `Td`, `TD`, `T*`, `TL`, `Tf`, `Tc`, `Tw`, `Tz`, `Ts`, `Tr`) calculando la caja de cada glifo con los anchos de la fuente. Los glifos que caen por completo dentro del rectángulo de un bloque editado se cambian por un desplazamiento `TJ` equivalente, así el resto de la línea no se mueve aunque esté en el mismo operador. El flujo viejo se elimina del archivo. |
| Exportación | `export.ts` | Con pdf-lib se escribe el texto nuevo con la fuente estándar equivalente (Helvetica, Times o Courier). Los bloques que no se pudieron borrar se tapan, como respaldo, con un rectángulo del color de fondo. |

## Limitaciones conocidas

- El texto original se borra del archivo en los casos comunes (PDFs de pdf-lib, Word o navegadores: fuentes Type1/TrueType con `/Widths`, las 14 estándar y Type0 `Identity-H`). Una línea **solo se tapa y su original sigue dentro del archivo** cuando no se puede borrar con seguridad: texto dentro de Form XObjects, fuentes Type3 o con CMaps distintos de `Identity-H`, texto invisible (capas OCR) o en modo de recorte, glifos que quedan a medias sobre el borde del bloque, PDFs cifrados o flujos con filtros no soportados. Al descargar se avisa cuántas líneas quedaron así.
- El borrado no toca `/ActualText` de contenido marcado ni el texto de anotaciones: algunos extractores podrían seguir mostrando ese texto alternativo.
- Las ediciones usan las 14 fuentes estándar de PDF, no la fuente original (que suele estar incrustada como subconjunto y no tiene todos los glifos). Los caracteres fuera de WinAnsi (por ejemplo emojis o alfabetos no latinos) se reemplazan por `?`.
- La edición es por línea; no reacomoda párrafos.
- Solo se edita texto horizontal en páginas sin rotar.
- Los PDFs escaneados no tienen texto: requieren OCR (no incluido).
- En las líneas que solo se pueden tapar, si el fondo es una imagen o un degradado el parche es de un color plano.
