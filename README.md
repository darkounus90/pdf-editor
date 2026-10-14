# Editor PDF

Editor de PDF que corre 100 % en el navegador: analiza el documento y permite editar su texto en línea. Ningún archivo se sube a un servidor.

## Uso

```bash
npm install
npm run dev
```

Abre http://localhost:5173, arrastra un PDF o pulsa **Probar con un ejemplo** (`public/ejemplo.pdf`, se regenera con `npm run sample`).

## Qué hace

- **Análisis**: metadatos, versión, tamaño de página (A4, Carta, Oficio…), campos de formulario, conteo de líneas y palabras, fuentes reales (nombre, negrita/cursiva, tamaños) y detección de páginas sin texto (escaneos que necesitarían OCR).
- **Edición en línea**: clic en cualquier línea para cambiar el texto, la fuente, el tamaño, negrita/cursiva y el color, moverla (arrastrando el asa ⠿) o eliminarla.
- **Agregar texto** en cualquier punto de la página.
- **Buscar y reemplazar** en todo el documento.
- **Historial** con deshacer/rehacer (Ctrl+Z / Ctrl+Y) y lista de cambios con opción de restaurar.
- **Descargar** el PDF editado (`nombre-editado.pdf`). El texto original de las líneas editadas o eliminadas se borra del archivo, no solo se tapa.

## Cómo funciona

| Etapa | Archivo | Detalle |
| --- | --- | --- |
| Lectura y render | `src/pdf/analyze.ts` | pdf.js extrae los fragmentos de texto con su posición y los agrupa en líneas (misma fuente, tamaño y línea base; los huecos grandes separan columnas y celdas). Al renderizar cada página se lee la fuente real y se estima el color del texto y del fondo a partir de los píxeles. |
| Estado | `src/state/editor.ts` | Las ediciones se guardan como diferencias sobre el bloque original, con historial. |
| Borrado del original | `src/pdf/contentStream.ts`, `src/pdf/eraseText.ts` | Se decodifica el flujo de contenido de cada página editada, se tokeniza (cadenas, arreglos, imágenes en línea) y se sigue el estado gráfico y de texto (`q`/`Q`/`cm`, `BT`, `Tm`, `Td`, `TD`, `T*`, `TL`, `Tf`, `Tc`, `Tw`, `Tz`, `Ts`, `Tr`) calculando la caja de cada glifo con los anchos de la fuente. Los glifos que caen por completo dentro del rectángulo de un bloque editado se cambian por un desplazamiento `TJ` equivalente, así el resto de la línea no se mueve aunque esté en el mismo operador. El flujo viejo se elimina del archivo. |
| Exportación | `src/pdf/export.ts` | Con pdf-lib se escribe el texto nuevo con la fuente estándar equivalente (Helvetica, Times o Courier). Los bloques que no se pudieron borrar se tapan, como respaldo, con un rectángulo del color de fondo. |

## Limitaciones conocidas

- El texto original se borra del archivo en los casos comunes (PDFs de pdf-lib, Word o navegadores: fuentes Type1/TrueType con `/Widths`, las 14 estándar y Type0 `Identity-H`). Una línea **solo se tapa y su original sigue dentro del archivo** cuando no se puede borrar con seguridad: texto dentro de Form XObjects, fuentes Type3 o con CMaps distintos de `Identity-H`, texto invisible (capas OCR) o en modo de recorte, glifos que quedan a medias sobre el borde del bloque, PDFs cifrados o flujos con filtros no soportados. Al descargar se avisa cuántas líneas quedaron así.
- El borrado no toca `/ActualText` de contenido marcado ni el texto de anotaciones: algunos extractores podrían seguir mostrando ese texto alternativo.
- Las ediciones usan las 14 fuentes estándar de PDF, no la fuente original (que suele estar incrustada como subconjunto y no tiene todos los glifos). Los caracteres fuera de WinAnsi (por ejemplo emojis o alfabetos no latinos) se reemplazan por `?`.
- La edición es por línea; no reacomoda párrafos.
- Solo se edita texto horizontal en páginas sin rotar.
- Los PDFs escaneados no tienen texto: requieren OCR (no incluido).
- En las líneas que solo se pueden tapar, si el fondo es una imagen o un degradado el parche es de un color plano.
