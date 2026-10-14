# Corpus de PDFs de prueba

Cada PDF de esta carpeta pasa automáticamente por `tests/corpus.test.ts`: se edita el primer bloque de texto de cada página, se exporta, se vuelve a abrir con pdf.js y se comprueba que:

- el texto nuevo aparece;
- el texto original desapareció del archivo (si el exportador avisó que solo pudo taparlo, se permite que siga);
- ningún otro bloque de texto se perdió ni cambió.

Además, `ejemplo.pdf` tiene pruebas propias en `analyze.test.ts` y `export.test.ts`.

## ejemplo.pdf

Lo genera `scripts/make-sample.mjs` con pdf-lib (fuentes estándar, colores, fondos y una tabla). Para regenerarlo:

```bash
pnpm sample
```

Si cambias el generador, corre `pnpm test` y revisa que las pruebas de `ejemplo.pdf` sigan describiendo el documento. La app web copia este archivo a `apps/web/public/ejemplo.pdf` en cada `dev`/`build`.

## Agregar PDFs reales

Los PDFs reales (de Word, Google Docs, facturadores, bancos, escáneres con OCR…) son los que encuentran los errores. Para sumar uno:

1. **Anonimízalo antes de copiarlo aquí.** El repositorio guarda el archivo completo, incluidos metadatos y texto oculto. Lo más seguro es recrear el documento con datos inventados en la misma herramienta que lo produjo (misma plantilla, mismas fuentes) y exportarlo de nuevo a PDF. Si eso no es posible:
   - reemplaza nombres, números de documento, direcciones, teléfonos, correos, cuentas y valores por datos ficticios;
   - borra los metadatos (Autor, Título, Asunto, Palabras clave, XMP) y las anotaciones o comentarios;
   - ten en cuenta que tapar texto con un rectángulo **no** lo borra: el texto sigue en el archivo. Verifícalo copiando todo el texto del PDF en un visor.
2. Nómbralo según su origen y lo que lo hace interesante, en minúsculas y con guiones: `word-365-tabla-kerning.pdf`, `google-docs-dos-columnas.pdf`, `factura-type0-identity-h.pdf`.
3. Cópialo en esta carpeta y corre las pruebas:

   ```bash
   pnpm --filter @pdf-editor/pdf-core test
   ```

4. Si falla, el PDF encontró un caso que el motor no cubre: corrige el motor o, si el comportamiento es esperado (por ejemplo, texto dentro de un Form XObject que solo se puede tapar), documéntalo aquí abajo. Si el archivo necesita comprobaciones más específicas, agrégale una prueba propia como las de `export.test.ts`.

Mantén cada archivo por debajo de ~1 MB para que el repositorio y la CI sigan siendo rápidos.

## Archivos

| Archivo | Origen | Qué cubre |
| --- | --- | --- |
| `ejemplo.pdf` | `scripts/make-sample.mjs` (pdf-lib) | Fuentes estándar, columnas en una misma línea, tabla, fondos de color, dos páginas. |
