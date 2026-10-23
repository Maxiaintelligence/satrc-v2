# SatRC V2.0 — Registro de Deuda Técnica Aceptada (Post-Etapa 3)

**Fecha:** Octubre 2026
**Estado:** Etapa 3 cerrada. Este documento ha sido transformado para listar **exclusivamente** la deuda técnica que se difiere a la Versión 3.0.
**Motivo:** Los 22 hallazgos resueltos durante la Etapa 3 (H0–H9) fueron migrados a `04_HISTORIAL_BUGS.md` para mantener este documento limpio y enfocado en el futuro.

---

## Resumen de Deuda Diferida (V3.0)

| Severidad Original | Cantidad | IDs |
|---|---|---|
| 🔴 Alta | 1 | H-MOTOR-05 |
| 🟡 Media | 6 | H-MOTOR-03, H-SEG-01, H-UI-01, H-UI-02, H-UI-03, H-DIAG-04 |
| 🟢 Baja | 10 | H-API-02, H-API-05, H-UI-07, H-UI-08, H-UI-09, H-UI-11, H-UI-13, H-UI-14, H-UI-22, H-UI-23, H-INFRA-01, H-NOM-01 |

---

## 🔴 Alta prioridad (1)

### H-MOTOR-05 — Sobreclasificación N2 en zonas húmedas
- **Síntoma:** incluso con 14 nodos, el motor sigue sobreclasificando N2 en XIC (61.9%), HUA (52.4%), ZAC (45.2%). Son las 3 zonas más húmedas (600+ mm en 90 días).
- **Causa:** el umbral de 30mm de saturación para N2 es demasiado bajo para zonas de alta pluviosidad. El umbral de 65mm para N3/N4 casi nunca se cruza (solo 6 días en 90 días en las 14 zonas).
- **Impacto:** falso positivo estructural en zonas húmedas.
- **Propuesta de fix (V3.0):** Requiere re-auditoría de 90 días (cambio de calibración).

---

## 🟡 Media prioridad (6)

### H-MOTOR-03 — Reporte diario exige 216h, runner filtra 192h
- **Síntoma:** `reporteDiario.mjs` exige `serie >= 216h` para usar una zona. El runner ya filtró a `MIN_HORAS_REQUERIDAS = 192`. Una zona con 200h se descarta del reporte diario aunque el semáforo la haya usado.
- **Impacto:** reportes diarios "parciales" artificiales.
- **Propuesta de fix (V3.0):** Ajustar el criterio a 216h coherente con 192h del runner.

### H-SEG-01 — `/api/sara` sin token expone bitácora y evaluaciones
- **Síntoma:** `GET /api/sara` sin `?forzar=true` devuelve `bitacora` y `evaluaciones` completas. Cualquiera puede consumirlo.
- **Impacto:** enumeración de comunidades y bitácora histórica pública.
- **Propuesta de fix (V3.0):** Requiere rediseño de contrato (auth real, JWT) y tocar `api/sara.js`, `SatRCOperativo.jsx` y `MonitorPublico.jsx`.

### H-UI-01 — MonitorPublico NO evalúa riesgo
- **Síntoma:** `MonitorPublico.jsx` no importa `evaluarLocalidad` ni consulta el semáforo diocesano. Solo muestra pronóstico + reporte vigente.
- **Impacto:** el público no ve el nivel N1-N4 de su localidad.
- **Propuesta de fix (V3.0):** Decisión de diseño. Si se quiere cambiar, hay que conectar el semáforo al monitor público.

### H-UI-02 — "Diagnóstico SARA" en MonitorPublico es if/else
- **Síntoma:** el bloque "Diagnóstico de Situación • Agente SARA" usa un `if/else` hardcodeado (`lluvia >= 20mm` → "Vigilancia activa"). No lo genera SARA.
- **Impacto:** atribución engañosa.
- **Propuesta de fix (V3.0):** Cambiar el rótulo o conectar a `evaluarLocalidad`.

### H-UI-03 — Público no ve semáforo N1-N4
- **Síntoma:** el Monitor Público no muestra el semáforo diocesano.
- **Propuesta de fix (V3.0):** Decisión de diseño. Habilitarlo si el usuario lo requiere.

### H-DIAG-04 — Motor no calibrado para XIC/HUA/ZAC
- **Síntoma:** XIC (61.9%), HUA (52.4%), ZAC (45.2%) pasan más de la mitad del tiempo en N2 por saturación.
- **Propuesta de fix (V3.0):** Es el mismo problema que H-MOTOR-05. Requiere re-auditoría.

---

## 🟢 Baja prioridad (12)

### H-API-02 — `disparar-workflow.js` no loguea IP/UA
- **Síntoma:** no hay log del origen del disparo.
- **Propuesta (V3.0):** Agregar `console.log` con IP y User-Agent.

### H-API-05 — `latest-gif.js` regex asume patrón NOAA fijo
- **Síntoma:** la regex `/href="(\d{11}-\d{11}-[^"]*-1000x1000\.gif)"/g` falla si NOAA cambia el sufijo.
- **Propuesta (V3.0):** Agregar fallback y telemetría.

### H-UI-07 — Secciones I-VI sin guard de contenido
- **Síntoma:** `ReporteCuerpo.jsx` muestra títulos sin cuerpo si el reporte no tiene esa sección.
- **Propuesta (V3.0):** Agregar guard de contenido.

### H-UI-08 — Borde de sección 0 siempre verde
- **Síntoma:** `ReporteCuerpo.jsx` usa `reporteVigente.dictamen?.color`, pero los reportes on-demand no tienen `dictamen`. Siempre cae a verde (`#10B981`).
- **Propuesta (V3.0):** Usar `reporteVigente.resumen_severidad` o el dictamen del estado diocesano.

### H-UI-09 — `TextoEnriquecido` no maneja markdown completo
- **Síntoma:** no maneja `# headers`, `_cursivas_`, `[links]()`.
- **Propuesta (V3.0):** Mejorar el parser.

### H-UI-11 — Print CSS del modal operativo
- **Síntoma:** imprime fondo oscuro al hacer "Imprimir / PDF".
- **Propuesta (V3.0):** Revisar estilos `print:*`.

### H-UI-13 — Banner SMN sin auto-refresh
- **Síntoma:** `OfficialAlertBanner.jsx` hace `fetch('/api/smn')` una sola vez al mount.
- **Propuesta (V3.0):** Agregar `setInterval` o `visibilitychange`.

### H-UI-14 — Banner SMN sin fallback
- **Síntoma:** si `/api/smn` falla, el banner desaparece sin avisar.
- **Propuesta (V3.0):** Mostrar "No se pudo consultar SMN" con botón de reintento.

### H-UI-22 — Disclaimer menciona ECMWF; gráfico duplica línea
- **Síntoma:** `DisclaimerModal.jsx` dice "ECMWF IFS de Europa" pero no se usa. El gráfico de temperatura dibuja 3 líneas, la de `ecmwf` duplica la línea de consenso.
- **Propuesta (V3.0):** Corregir el disclaimer a "GFS (NOAA), ICON (DWD), GEM (Canadá)". Reemplazar `ecmwf` por `gem` en el gráfico.

### H-UI-23 — `DisclaimerModal` código muerto
- **Síntoma:** rama `else` con `abierto === undefined` nunca se ejecuta.
- **Propuesta (V3.0):** Eliminar código muerto.

### H-INFRA-01 — No hay `vercel.json`
- **Síntoma:** deploy por autodetección.
- **Propuesta (V3.0):** Agregar `vercel.json` explícito (región, memoria, timeout).

### H-NOM-01 — `procesar_datos.cjs` escribe `version: "3.0"`
- **Síntoma:** el JSON de localidades dice `version: "3.0"`. Confunde con "Etapa 3 ≠ V3.0".
- **Propuesta (V3.0):** Cambiar a `"2.0"` o `"2.1"`.

---

## Anexo Único — Historial de Resolución en Etapa 3 (Referencia)

Los siguientes hallazgos fueron resueltos durante la Etapa 3 y su documentación técnica detallada se encuentra ahora en `04_HISTORIAL_BUGS.md`:

| ID | Hito de Resolución | Descripción del Fix |
|---|---|---|
| H-MOTOR-01 | H4 (parcial) | Extracción del gemelo `riskEvaluatorRunner.mjs`. Unificación total en V3.0. |
| H-MOTOR-02 | H2a | Parser SMN del runner sincronizado. |
| H-MOTOR-04 | H3 | Fallback del frontend expandido a 14 nodos. |
| H-TEST-01 | H7a + H7b | Reemplazo de tests obsoletos por Vitest (79 tests). |
| H-TEST-02 | H7a | Uso del Zod real en tests de regresión. |
| H-TEST-03 | H7a | Creación del script `"test"` en `package.json`. |
| H-API-07 | H2b | Eliminación de `api/glm.js` (código muerto). |
| H-API-08 | H2b | Eliminación de `glm.js`. |
| H-API-09 | H2b | Eliminación de `glm.js`. |
| H-UI-04 | H6 | `formatearTimestamp` extraída a `fechas.js`. |
| H-UI-10 | H6 | `TextoEnriquecido` extraída a `markdown.jsx`. |
| H-DIAG-01 | H7a | Reemplazo por suite de Vitest. |
| H-ENV-01 | H1 | Documentación de verificación en GitHub Actions. |
| H-FUNC-01 | H6 | Extracción de 7 funciones a `src/lib/compartido/`. |
| N18 | H5 | Test de blindaje de visibilidad. |
| H-UI-19 | H7b | Extracción y validación de rangos de `parseNoaaStamp` en `noaa.js`. |
| H-API-01 | H0/H9 | Documentación de la nomenclatura `satrc-v2` vs `satrc-v3`. |

---

**Fin del registro de deuda técnica.**