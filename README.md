# Gastos

Web app para registrar gastos diarios y exportarlos a CSV. Sin backend, sin dependencias y sin paso de build: HTML + CSS + JavaScript (módulos ES). Pensada primero para iPhone, se puede agregar a la pantalla de inicio.

## Funcionalidades

- **Registrar**: fecha (por defecto hoy), concepto/referencia (con autocompletado de conceptos ya usados) e importe. Acepta `1.250,50`, `1250,5`, `1.500` o `1250.50`.
- **Resumen**: total del día, del mes y promedio diario del mes.
- **Movimientos**: filtro por Día / Mes / Rango / Todo, búsqueda por concepto, agrupado por día con subtotales. Tocar un gasto permite editarlo o eliminarlo (con *Deshacer*).
- **Exportar CSV** por día, mes, rango a elección o todo:
  - Formato *Excel Argentina* (`;` y coma decimal) o *Estándar* (`,` y punto decimal).
  - Columnas `Fecha;Concepto;Importe` + fila `TOTAL`. Incluye BOM UTF‑8 para que Excel respete tildes y ñ.
  - En iPhone, el botón *Compartir* manda el archivo a Archivos, Mail, WhatsApp, etc.
- **Copia de seguridad**: descarga/restaura un JSON con todos los gastos.

> Los datos se guardan en `localStorage`: quedan **solo en ese dispositivo y navegador**. Usá la copia de seguridad para no perderlos o pasarlos a otro equipo.

## Estructura

Todos los archivos van en la raíz del repo (sin carpetas):

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la UI (3 pestañas + diálogo de edición) |
| `styles.css` | Estética emebe: Plus Jakarta Sans, marino #012E4A, celeste #C5DCEA |
| `app.js` | UI: eventos y render |
| `store.js` | Persistencia, filtros por período, agrupado |
| `csv.js` | Generación de CSV y nombres de archivo |
| `format.js` | Parseo de importes, fechas y formato de moneda |
| `plus-jakarta-sans.woff2` | Tipografía (licencia OFL, ver `OFL-LICENSE.txt`) |
| `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Íconos |
| `manifest.webmanifest` | Instalable como app |
| `logic.test.mjs` | Tests de la lógica (`node --test logic.test.mjs`) |
| `vercel.json` | Headers de seguridad y caché |

Los importes se guardan como **centavos enteros** para evitar errores de redondeo.

## Desarrollo local

```bash
python3 -m http.server 8000      # o: npx serve .
# abrir http://localhost:8000
```

(Hace falta un servidor: los módulos ES no cargan abriendo el archivo con doble clic.)

## Tests

```bash
node --test logic.test.mjs     # Node 18+
```

## Deploy en Vercel

1. Subir esta carpeta a un repo de GitHub.
2. En Vercel: **Add New → Project → Import** el repo.
3. Framework Preset: **Other**. Sin build command ni output directory.
4. Deploy. Cada `git push` a `main` vuelve a publicar.
