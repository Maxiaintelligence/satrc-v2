# SatRC V2.0 — Arquitectura y Frontend (Nivel Ingeniería)

## Índice

1. [El estado en el frontend](#1-el-estado-en-el-frontend)
2. [Módulos compartidos (H6) y Extracciones (H4, H7b)](#2-módulos-compartidos-y-extracciones)
3. [Vistas principales](#3-vistas-principales)
4. [El motor de reportes regionales](#4-el-motor-de-reportes-regionales)
5. [Modales (refactor Octubre 2026)](#5-modales-refactor-octubre-2026)
6. [El problema del encoding UTF-8 (N27)](#6-el-problema-del-encoding-utf-8-n27)
7. [Validación de contratos con Zod (H8)](#7-validación-de-contratos-con-zod-h8)

---

## 1. El estado en el frontend

El frontend **no calcula riesgo complejo en tiempo real**. Su única fuente de verdad es el Blob (`estado_diocesano.json`).

Si el Blob falla, el frontend tiene un **fallback en vivo** que evalúa en el navegador (con los 14 nodos regionales, ver H-MOTOR-04).

---

## 2. Módulos compartidos y Extracciones

A partir de la Etapa 3, se extrajeron las funciones duplicadas a `src/lib/compartido/` para mantener una única fuente de verdad (H6), y se aislaron los motores para que sean testeables (H4, H7b).

### Módulos Compartidos (H6)

| Archivo | Exporta |
|---|---|
| `fechas.js` | `formatearTimestamp` |
| `markdown.jsx` | `TextoEnriquecido` (viñetas y negritas) |
| `nodos.js` | `seleccionarNodosRegionales` |
| `mojibake.js` | `repararMojibake` y `repararObjeto` |
| `regionales.js` | `normalizarDatosRegionales` y `construirBloqueRegional` |
| `noaa.js` | `parseNoaaStamp` y `compararNoaaStamps` (H7b) |

### Motores Aislados (H4)

| Archivo | Descripción |
|---|---|
| `src/engine/riskEvaluator.js` | Motor canónico del frontend (las 6 reglas). |
| `scripts/engine/riskEvaluatorRunner.mjs` | Gemelo del motor para el runner de GitHub Actions (H4). |

---

## 3. Vistas principales

### `MonitorPublico.jsx`

- Vista pública.
- Selector de **Zona → Municipio → Localidad**.
- Usa Open-Meteo para las gráficas.
- No tiene botones de exportación.

### `SatRCOperativo.jsx`

- Sala de mando (protegida por clave).
- Semáforo de 4 niveles.
- Botón de On-Demand.
- Si el Blob falla, cae a `ejecutarEvaluacionRealEnVivo()` usando 14 nodos.

---

## 4. El motor de reportes regionales

**Archivo:** `src/engine/reportesRegionales.js`

- **`seleccionarNodosRegionales()`:** importado desde `src/lib/compartido/nodos.js`.
- **`construirResumenesRegionales()`:** *crítico*. Hace 14 fetches a Open-Meteo con límite de lotes concurrentes (`TAMANO_LOTE = 4`).

  > ⚠️ **Advertencia:** si se hacen más de 4 peticiones concurrentes, el navegador colapsa por límite de conexiones.

- **`invalidarCache()`:** borra la caché de 30 minutos. Se usa cuando el operador reintenta.

---

## 5. Modales (refactor Octubre 2026)

Antes había un solo modal gigante en `SatRCOperativo.jsx`. Se dividió en 3:

| Componente | Descripción | Uso |
|---|---|---|
| `ReporteCuerpo.jsx` | El HTML de las 7 secciones. 100% reutilizable. | Base de los otros dos. |
| `ReporteModalOperativo.jsx` | Cuerpo + botones (WhatsApp, Descargar, Imprimir). | Solo operadores. |
| `ReporteModalPublico.jsx` | Cuerpo, sin botones. | Solo el Monitor Público. |

---

## 6. El problema del encoding UTF-8 (N27)

`@vercel/blob` en el runner guarda strings con **doble encoding** (ej. `ó` se guarda como `Ã³`).

**El frontend no tiene la culpa.** El endpoint `/api/sara.js` lee el Blob y ejecuta `repararObjeto()` (importado de `mojibake.js`) antes de enviarlo al frontend.

---

## 7. Validación de contratos con Zod (H8)

Para evitar que datos corruptos o incompletos lleguen al frontend, el sistema implementó una validación estricta en los bordes usando **Zod**.

**Archivo:** `src/schemas/estadoDiocesanoSchema.js`

Se dividió en dos esquemas para reflejar las distintas capas:
1. **`EstadoDiocesanoBlobSchema`**: Valida el `paqueteMaestro` generado por el runner antes de publicarlo al Blob. Si el motor produce un error (ej. `nivel_alerta: 5`), el runner aborta.
2. **`EstadoDiocesanoResponseSchema`**: Valida el objeto final que la API `/api/sara` envía al frontend (incluye campos como `bitacora` y `origen`).

**Flujo de validación:**
- El Runner valida -> Publica al Blob.
- La API lee el Blob -> Valida -> Envía al Frontend.
- Si la API detecta que el Blob no cumple el contrato (ej. por un bug futuro), cae automáticamente al **fallback en vivo** (que no se valida) para asegurar que el operador nunca se quede sin datos.