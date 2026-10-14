# Editor PDF

Editor de PDF que corre 100 % en el navegador: analiza el documento y permite editar su texto en línea. Ningún archivo se sube a un servidor.

## Estructura

Monorepo con [pnpm workspaces](https://pnpm.io/workspaces) y [Turborepo](https://turborepo.com):

```
apps/
  web/              Next.js (App Router): portada en / y el editor en /editar-pdf
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

Abre http://localhost:5173. La portada enlaza al editor (`/editar-pdf`); ahí arrastra un PDF o pulsa **Probar con un ejemplo** (`/editar-pdf?ejemplo` lo abre directamente).

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo de la app web en el puerto 5173. |
| `pnpm build` | Build de producción de todo el monorepo (Turborepo cachea lo que no cambió). |
| `pnpm test` | Pruebas de `pdf-core` con Vitest. |
| `pnpm typecheck` | Chequeo de tipos de todos los paquetes. |
| `pnpm sample` | Regenera `packages/pdf-core/tests/corpus/ejemplo.pdf`. |

Para trabajar en un solo paquete: `pnpm --filter @pdf-editor/pdf-core test:watch`, `pnpm --filter @pdf-editor/web dev`, etc.

## Pruebas

Las pruebas viven en `packages/pdf-core/tests` y corren en Node con el build legacy de pdf.js:

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

La CI (`.github/workflows/ci.yml`) instala, chequea tipos, corre las pruebas y hace el build en cada push a `main` y en cada pull request.

## Despliegue

Producción corre en un VPS con Docker Compose (`deploy/`):

| Servicio | Qué hace |
| --- | --- |
| `caddy` | Único que publica puertos (80/443). Saca el certificado HTTPS solo, redirige `www` al dominio principal y hace de proxy hacia la web. |
| `web` | Next.js en modo `standalone` (`deploy/Dockerfile`), solo en la red interna de Docker. |

Los puertos que publica Docker se saltan `ufw`: no agregues `ports:` a otros servicios; usa `expose:`.

Primera vez, en el servidor:

```bash
git clone https://github.com/darkounus90/pdf-editor.git ~/renglon
cd ~/renglon/deploy
cp .env.example .env   # completar DOMAIN y ACME_EMAIL
docker compose up -d --build
```

Para actualizar a la última versión de `main`:

```bash
~/renglon/deploy/update.sh
```

Para probar la salida de producción sin Docker: `NEXT_OUTPUT=standalone pnpm --filter @pdf-editor/web build`.

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
