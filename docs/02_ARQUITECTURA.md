# SatRC V2.0 — Arquitectura y Frontend (Nivel Ingeniería)

> **Versión:** 2.3.0 (Cierre de Etapa 4)
> **Última actualización:** 22 de octubre de 2026.
> **Nota:** este documento describe la arquitectura **del frontend y de los módulos compartidos**. Para la arquitectura del motor multiamamenaza (Etapa 4), ver `08_MOTOR_MULTIAMENAZA.md`. Para el estado global del proyecto, ver `09_HANDOVER.md`.

## Índice

1. [El estado en el frontend](#1-el-estado-en-el-frontend)
2. [Módulos compartidos (H6) y Extracciones (H4, H7b)](#2-módulos-compartidos-y-extracciones)
3. [Vistas principales](#3-vistas-principales)
4. [El motor de reportes regionales](#4-el-motor-de-reportes-regionales)
5. [Modales (refactor Octubre 2026)](#5-modales-refactor-octubre-2026)
6. [El problema del encoding UTF-8 (N27)](#6-el-problema-del-encoding-utf-8-n27)
7. [Validación de contratos con Zod (H8 + H6.5)](#7-validación-de-contratos-con-zod-h8--h65)
8. [Motor Multiamenaza (Etapa 4)](#8-motor-multiamenaza-etapa-4)
9. [Adaptador de Shape del Runner (H6.4 + H6.5)](#9-adaptador-de-shape-del-runner-h64--h65)

---

## 1. El estado en el frontend

El frontend **no calcula riesgo complejo en tiempo real**. Su única fuente de verdad es el Blob (`estado_diocesano.json`).

Si el Blob falla, el frontend tiene un **fallback en vivo** que evalúa en el navegador (con los 14 nodos regionales, ver H-MOTOR-04). El fallback usa `evaluarLocalidad` (motor hidrológico, Etapa 3). **No usa el orquestador multiamenaza todavía** (H6.6 diferido a V3.0).

---

## 2. Módulos compartidos y Extracciones

A partir de la Etapa 3, se extrajeron las funciones duplicadas a `src/lib/compartido/` para mantener una única fuente de verdad (H6), y se aislaron los motores para que sean testeables (H4, H7b).

### 2.1 Módulos Compartidos (H6)

| Archivo | Exporta |
|---|---|
| `fechas.js` | `formatearTimestamp` |
| `markdown.jsx` | `TextoEnriquecido` (viñetas y negritas) |
| `nodos.js` | `seleccionarNodosRegionales` |
| `mojibake.js` | `repararMojibake` y `repararObjeto` |
| `regionales.js` | `normalizarDatosRegionales` y `construirBloqueRegional` |
| `noaa.js` | `parseNoaaStamp` y `compararNoaaStamps` (H7b) |

### 2.2 Motores Aislados (H4 + Etapa 4)

| Archivo | Descripción | Etapa |
|---|---|---|
| `src/engine/riskEvaluator.js` | Motor canónico del frontend (las 6 reglas hidrológicas). | Etapa 3 |
| `scripts/engine/riskEvaluatorRunner.mjs` | Gemelo del motor hidrológico para el runner de GitHub Actions (H4). | Etapa 3 |
| `src/engine/hydroAdapter.js` | Adaptador continuo del motor hidrológico (añade `nivel_alerta_continuo`). | Etapa 4 (H4-E4) |
| `src/engine/windEvaluator.js` | Evaluador de viento con densidad del aire y umbral dinámico por altitud. | Etapa 4 (H1-E4 + H6.4a) |
| `src/engine/thermalEvaluator.js` | Evaluador térmico con sigmoides, Grass Minimum y Bulbo Húmedo. | Etapa 4 (H2-E4) |
| `src/engine/convectiveEvaluator.js` | Evaluador convectivo con CAPE, Δh de fusión y Downburst. | Etapa 4 (H3-E4) |
| `src/engine/crossThreatOrchestrator.js` | Orquestador multiamamenaza con acoplamiento de Richardson. | Etapa 4 (H6.4 + H6.5) |

> **Nota:** el motor hidrológico (`riskEvaluator.js`) **es intocable desde Etapa 3**. El orquestador lo envuelve a través de `hydroAdapter.js`. Ver `08_MOTOR_MULTIAMENAZA.md` para el flujo completo.

---

## 3. Vistas principales

### `MonitorPublico.jsx`

- Vista pública.
- Selector de **Zona → Municipio → Localidad**.
- Usa Open-Meteo para las gráficas.
- No tiene botones de exportación.
- **No consume los campos nuevos de Etapa 4** (`nivel_alerta_global`, `niveles_por_vector`). Sigue mostrando solo el pronóstico (deuda H-UI-01/02/03).

### `SatRCOperativo.jsx`

- Sala de mando (protegida por clave).
- Semáforo de 4 niveles (lee `nivel_alerta` del Blob).
- Botón de On-Demand.
- Si el Blob falla, cae a `ejecutarEvaluacionRealEnVivo()` usando 14 nodos.
- **No muestra todavía** el desglose por vector (`niveles_por_vector`) ni `acciones_operativas` (deuda H6.6).

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

**Deuda aceptada para V3.0:** la causa raíz (por qué `@vercel/blob` hace doble encoding en GitHub Actions) no está resuelta. El parche defensivo en lectura funciona. Documentado como N22/N27 en `06_PENDIENTES.md`.

---

## 7. Validación de contratos con Zod (H8 + H6.5)

Para evitar que datos corruptos o incompletos lleguen al frontend, el sistema implementó una validación estricta en los bordes usando **Zod**.

**Archivo:** `src/schemas/estadoDiocesanoSchema.js`

Se dividió en dos esquemas para reflejar las distintas capas:

1. **`EstadoDiocesanoBlobSchema`:** valida el `paqueteMaestro` generado por el runner antes de publicarlo al Blob. Si el motor produce un error (ej. `nivel_alerta: 5`), el runner aborta.
2. **`EstadoDiocesanoResponseSchema`:** valida el objeto final que la API `/api/sara` envía al frontend (incluye campos como `bitacora` y `origen`).

**Extensión de Etapa 4 (H6.5):** el `EvaluacionSchema` se extendió con 5 campos opcionales del orquestador:

- `nivel_alerta_global: z.number().min(1).max(4).optional()`
- `riesgo_continuo: z.number().min(1).max(4).optional()`
- `niveles_por_vector: z.object({ hidrologico, viento, termico, convectivo }).optional()`
- `acciones_operativas: z.array(z.string()).optional()`
- `diagnosticos_por_vector: z.record(z.any()).optional()`

Además, el campo `diagnostico` ahora tiene `.passthrough()` para aceptar el campo `acoplamiento` que agrega el orquestador. Los campos nuevos son opcionales para permitir la transición desde Blobs viejos (pre-H6.4).

**Flujo de validación:**

- El Runner valida → publica al Blob.
- La API lee el Blob → valida → envía al Frontend.
- Si la API detecta que el Blob no cumple el contrato (ej. por un bug futuro), cae automáticamente al **fallback en vivo** (que no se valida) para asegurar que el operador nunca se quede sin datos.

---

## 8. Motor Multiamenaza (Etapa 4)

**Ver `08_MOTOR_MULTIAMENAZA.md` para el detalle completo.**

Resumen de cómo se integra con la arquitectura existente:

1. **`meteoFetcher.js`** pide 15 variables a Open-Meteo (7 hidrológicas + 8 E4).
2. **`consensusEngine.js`** consensúa las 15 variables (mediana + max + gfs_preferente) y produce una serie de objetos.
3. **`crossThreatOrchestrator.js`** (`evaluarMultiamenaza`) recibe la serie + la localidad, y:
   - Convierte la serie de objetos a objeto de arrays (formato que esperan los 4 evaluadores).
   - Llama a `hydroAdapter`, `windEvaluator`, `thermalEvaluator`, `convectiveEvaluator`.
   - Aplica acoplamiento no lineal de Richardson.
   - Devuelve `nivel_alerta_global` + `niveles_por_vector` + `riesgo_continuo` + `acciones_operativas`.
4. **`ejecutar_sara_autonomo.mjs`** (runner) usa `evaluarMultiamenaza` para las 405 localidades y publica el `paqueteMaestro` en Vercel Blob.

**Diagrama de flujo:**

```text
Open-Meteo (15 variables × 3 modelos)
                  ↓
         meteoFetcher.js (fetch)
                  ↓
   consensusEngine.js (consenso → array de 240 objetos)
                  ↓
   crossThreatOrchestrator.js (convierte array → objeto de arrays)
                  ↓
┌─────────┬───────────┬───────────┬──────────────┐
│ hydro   │ wind      │ thermal   │ convective   │
│ Adapter │ Evaluator │ Evaluator │ Evaluator    │
└────┬────┴─────┬─────┴─────┬─────┴──────┬───────┘
     │          │           │            │
     └──────────┴─────┬─────┴────────────┘
                      ↓
        Acoplamiento de Richardson
                      ↓
        { nivel_alerta_global,
          riesgo_continuo,
          niveles_por_vector,
          acciones_operativas }
                      ↓
        Adaptador de shape (ver §9)
                      ↓
        { nivel_alerta, nivel_alerta_global, ... }
                      ↓
        paqueteMaestro → Vercel Blob
                      ↓
        /api/sara → Zod → Frontend
```

---

## 9. Adaptador de Shape del Runner (H6.4 + H6.5)

**Problema:** `evaluarMultiamenaza` devuelve `nivel_alerta_global`, pero Zod y el frontend esperan `nivel_alerta`.

**Solución:** el runner (`scripts/ejecutar_sara_autonomo.mjs`) incluye un adaptador de shape que:

1. Mapea `res.nivel_alerta_global` a `nivel_alerta` (compatibilidad).
2. Mantiene todos los campos del orquestador como aditivos (`nivel_alerta_global`, `riesgo_continuo`, `niveles_por_vector`, `acciones_operativas`, `diagnosticos_por_vector`).
3. Incluye un `try/catch` con fallback al motor viejo (`evaluarLocalidadRunner`) si el orquestador falla para una localidad puntual.

**Código relevante** (en `ejecutar_sara_autonomo.mjs`, sección 5):

```js
const evaluaciones = todasLocalidades.map(loc => {
  const zonaId = loc.zona_id;
  const serieZona = seriesPorZona[zonaId] || [];
  const zonaSinDatos = series[zonaId]?.ok === false;

  try {
    const res = evaluarMultiamenaza(loc, serieZona, { alertaSMN, zonaSinDatos });
    return {
      // Campos requeridos por Zod (compatibilidad):
      localidad_id: res.localidad_id,
      nombre: res.nombre,
      // ...
      nivel_alerta: res.nivel_alerta_global,  // ← mapeo
      // ...
      // Campos nuevos (aditivos):
      nivel_alerta_global: res.nivel_alerta_global,
      riesgo_continuo: res.riesgo_continuo,
      niveles_por_vector: res.niveles_por_vector,
      acciones_operativas: res.acciones_operativas,
      diagnosticos_por_vector: res.diagnosticos_por_vector
    };
  } catch (e) {
    return evaluarLocalidadRunner(loc, serieZona, { alertaSMN, zonaSinDatos });
  }
});
```

**Consecuencia:** cero regresión en el frontend. Los campos nuevos están disponibles para futuras vistas (H6.6).