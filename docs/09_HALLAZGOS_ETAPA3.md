# SatRC V2.0 — Hallazgos de Etapa 3

**Fecha:** Octubre 2026
**Total:** 36 hallazgos (5 🔴 Alta, 17 🟡 Media, 13 🟢 Baja, 1 ⚠️ Documentación)
**Estado:** Documentados. Los resueltos en Etapa 3 se marcan con ✅. Los que van a V3.0 se marcan con ⏸️.

> Este documento es el registro completo de deuda técnica detectada durante la auditoría previa a la Etapa 3.
> **No todos los hallazgos se resuelven en Etapa 3.** Los de V3.0 quedan documentados para no seguir arrastrando pendientes.

---

## Resumen por severidad

| Severidad | Cantidad | IDs |
|---|---|---|
| 🔴 Alta | 5 | H-MOTOR-01, H-MOTOR-02, H-MOTOR-04, H-MOTOR-05, H-TEST-01 |
| 🟡 Media | 17 | H-MOTOR-03, H-SEG-01, H-API-07, H-UI-01, H-UI-02, H-UI-03, H-UI-08, H-UI-13, H-UI-14, H-UI-22, H-DIAG-01, H-DIAG-04, H-TEST-02, H-TEST-03, H-ENV-01, H-FUNC-01, N18 |
| 🟢 Baja | 13 | H-API-02, H-API-05, H-API-08, H-API-09, H-UI-04, H-UI-07, H-UI-09, H-UI-10, H-UI-11, H-UI-19, H-UI-23, H-INFRA-01, H-NOM-01 |
| ⚠️ Documentación | 1 | H-API-01 |

---

## 🔴 Alta prioridad (5)

### H-MOTOR-01 — Runner duplica el motor inline (divergente del frontend)

- **Síntoma:** `scripts/ejecutar_sara_autonomo.mjs` tiene su propia copia inline de las 6 reglas. No importa `src/engine/riskEvaluator.js`.
- **Causa:** Replicación manual durante la migración a 14 nodos (ADR-001). Se copió para evitar problemas de `import` en GitHub Actions.
- **Divergencias detectadas:**
  - **Regla 4 (inundación fluvial):** el runner siempre asigna N4. El frontend gradúa (N3 o N4 según `lluvia >= 65mm || poblacionAguasArriba >= 50000`).
  - **`poblacionAguasArriba`:** el runner no lo usa.
  - **`tiempos.inicio`, `tiempos.picoMaximo`, `tiempos.crestaImpacto`:** el runner los hardcodea (`"En curso"`, `"Periodo activo"`). El frontend los calcula con `horaPico`/`horaInicio`.
- **Impacto:** el frontend y el runner pueden clasificar distinto las mismas localidades.
- **Archivos afectados:** `scripts/ejecutar_sara_autonomo.mjs`, `src/engine/riskEvaluator.js`.
- **Propuesta de fix:** H4 (Opción A) extrae `scripts/engine/riskEvaluatorRunner.mjs` como gemelo documentado. **No unificar todavía** (V3.0).
- **Estado:** ✅ Resuelto parcialmente en H4 (commits `a94324c` + `3e702f4`). El gemelo `scripts/engine/riskEvaluatorRunner.mjs` existe y está testeado. La unificación completa (runner + frontend con un solo archivo) va a V3.0.

### H-MOTOR-02 — Parser SMN del runner está ciego

- **Síntoma:** `scripts/ejecutar_sara_autonomo.mjs` consulta `smn.conagua.gob.mx/tools/GUI/webservices/index.php?method=1`, que es el webservice **equivocado**. El aviso real está en la página principal (scraping).
- **Causa:** N33 se arregló en `api/smn.js` pero **NO se replicó en el runner**. El runner sigue usando el método viejo.
- **Impacto:** la `alertaSMN` que el runner pasa a Groq y al motor **puede estar siempre en `null`**. Las reglas N4 que dependen de `lluvia_efectiva` con piso SMN no se activan en el runner.
- **Archivos afectados:** `scripts/ejecutar_sara_autonomo.mjs`.
- **Propuesta de fix:** H2a sincroniza el parser del runner con `api/smn.js`.
- **Estado:** ✅ Se resuelve en H2a.

### H-MOTOR-04 — Fallback del frontend usa 1 solo nodo (Huauchinango)

- **Síntoma:** `SatRCOperativo.jsx` → `ejecutarEvaluacionRealEnVivo` usa solo `nodoSierra = Huauchinango`. Es el **bug ADR-001 reintroducido** en el fallback en vivo.
- **Causa:** el fallback se escribió antes de ADR-001 y no se actualizó.
- **Impacto:** si el Blob falla, el frontend vuelve a sobreclasificar 44% en N2 (el bug original).
- **Archivos afectados:** `src/views/SatRCOperativo.jsx`.
- **Propuesta de fix:** H3 usa los 14 nodos en el fallback.
- **Estado:** ✅ Se resuelve en H3.

### H-MOTOR-05 — Sobreclasificación N2 en zonas húmedas

- **Síntoma:** incluso con 14 nodos, el motor sigue sobreclasificando N2 en XIC (61.9%), HUA (52.4%), ZAC (45.2%). Son las 3 zonas más húmedas (600+ mm en 90 días).
- **Causa:** el umbral de 30mm de saturación para N2 es demasiado bajo para zonas de alta pluviosidad. El umbral de 65mm para N3/N4 casi nunca se cruza (solo 6 días en 90 días en las 14 zonas).
- **Impacto:** el motor sigue dando "vigilancia" cuando debería estar "normal". Es un falso positivo estructural en zonas húmedas.
- **Archivos afectados:** `src/engine/riskEvaluator.js`, `scripts/ejecutar_sara_autonomo.mjs`.
- **Propuesta de fix:** **Requiere re-auditoría de 90 días** (cambio de calibración). **Va a V3.0.**
- **Estado:** ⏸️ Fuera de Etapa 3. Documentado en `06_PENDIENTES.md` como V3.0.

### H-TEST-01 — 2 de 4 tests son dead code; 1 contradice el motor

- **Síntoma:**
  - `test_riesgos.mjs` y `test_sistemico.mjs` usan campos que `riskEvaluator.js` **no devuelve** (`que.evento`, `cuando.inicio_amenaza`, `tamano_impacto.*`). Imprimen `undefined` en casi todos los campos. Como no hay `assert`, siempre "pasan".
  - `test_regresion_fase1.mjs` tiene el test 3 que **contradice la lógica del motor**: Apan tiene `acceso_vial: "CAMINO_TERRACERIA"` y `lluvia: 1.3mm` con `alertaSMN 75mm`. Por Regla 5 (corte vial N3), debería dar N3. El test espera N1.
  - `test_consenso.mjs` espera `detalle_modelos.temp.ecmwf` que el motor no genera (imprime `undefined`).
- **Causa:** los tests se escribieron para una versión anterior de `riskEvaluator.js`. Nunca se actualizaron.
- **Impacto:** el "CI Gate" del proyecto es falso. No detecta regresiones.
- **Archivos afectados:** `test_*.mjs` (4), `src/engine/riskEvaluator.js`.
- **Propuesta de fix:** H7a reescribe los tests con Vitest y fixtures reales. H7b migra el resto.
- **Estado:** ✅ Resuelto en H7a (36 tests con Vitest, CI en GitHub Actions).

---

## 🟡 Media prioridad (17)

### H-MOTOR-03 — Reporte diario exige 216h, runner filtra 192h

- **Síntoma:** `reporteDiario.mjs` exige `serie >= 216h` para usar una zona. El runner ya filtró a `MIN_HORAS_REQUERIDAS = 192`. Una zona con 200h se descarta del reporte diario aunque el semáforo la haya usado.
- **Impacto:** reportes diarios "parciales" artificiales.
- **Propuesta de fix:** H4b (parte del motor unificado). Ajustar el criterio a 216h coherente con 192h del runner. Documentar.
- **Estado:** ⏸️ Se documenta en H4b. Fix real en V3.0 si es aceptado.

### H-SEG-01 — `/api/sara` sin token expone bitácora y evaluaciones

- **Síntoma:** `GET /api/sara` sin `?forzar=true` devuelve `bitacora` y `evaluaciones` completas. Cualquiera puede consumirlo.
- **Impacto:** enumeración de comunidades y bitácora histórica pública.
- **Propuesta de fix:** requiere rediseño de contrato (tocar `api/sara.js`, `SatRCOperativo.jsx`, `MonitorPublico.jsx`). **Va a V3.0.**
- **Estado:** ⏸️ Fuera de Etapa 3. Documentado.

### H-API-07 — `api/glm.js` es código muerto

- **Síntoma:** ningún `.jsx` usa `api/glm.js`. Solo `SatelliteViewer.jsx` usa `/api/latest-gif`. `glm.js` es redundante.
- **Impacto:** consume una función serverless de Vercel (cuota, cold start, mantenimiento). Tiene fallbacks rotos (H-API-08, H-API-09).
- **Propuesta de fix:** H2b elimina `api/glm.js`.
- **Estado:** ✅ Se resuelve en H2b.

### H-UI-01 — MonitorPublico NO evalúa riesgo

- **Síntoma:** `MonitorPublico.jsx` no importa `evaluarLocalidad` ni consulta el semáforo diocesano. Solo muestra pronóstico de Open-Meteo + reporte vigente (si hay).
- **Causa:** decisión de diseño deliberada. El semáforo es operativo, no público.
- **Impacto:** el público no ve el nivel N1-N4 de su localidad.
- **Propuesta de fix:** decisión de diseño. **Va a V3.0** si el usuario quiere cambio.
- **Estado:** ⏸️ Documentado como decisión. No se toca en Etapa 3.

### H-UI-02 — "Diagnóstico SARA" en MonitorPublico es if/else

- **Síntoma:** el bloque "Diagnóstico de Situación • Agente SARA" usa un `if/else` hardcodeado (`lluvia >= 20mm` → "Vigilancia activa"). No lo genera SARA.
- **Impacto:** atribución engañosa. Cosmético pero institucional.
- **Propuesta de fix:** V3.0. Cambiar el rótulo o conectar a `evaluarLocalidad`.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-UI-03 — Público no ve semáforo N1-N4

- **Síntoma:** el Monitor Público (vista por defecto) no muestra el semáforo diocesano. El público puede ver "sin lluvia en mi localidad" mientras hay 19 N4 en otra zona.
- **Causa:** decisión de diseño (semáforo = operativo).
- **Propuesta de fix:** V3.0 si el usuario quiere.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-UI-08 — Borde de sección 0 siempre verde

- **Síntoma:** `ReporteCuerpo.jsx` usa `reporteVigente.dictamen?.color` para el borde de la sección 0. Pero los reportes on-demand no tienen campo `dictamen`. Siempre cae al fallback `#10B981` (verde).
- **Impacto:** UX menor. El borde siempre es verde, sin importar el estado real.
- **Propuesta de fix:** H6 (refactor de modales) o H4b. Usar `reporteVigente.resumen_severidad` o el dictamen del estado diocesano.
- **Estado:** ⏸️ Fuera de Etapa 3 (cosmético).

### H-UI-13 — Banner SMN sin auto-refresh

- **Síntoma:** `OfficialAlertBanner.jsx` hace `fetch('/api/smn')` **una sola vez al mount**. Si el SMN emite un aviso nuevo, el usuario no lo ve hasta recargar.
- **Impacto:** el banner puede quedar obsoleto durante la sesión.
- **Propuesta de fix:** V3.0. Agregar `setInterval` o `visibilitychange` como en `SatRCOperativo`.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-UI-14 — Banner SMN sin fallback

- **Síntoma:** si `/api/smn` falla, el banner desaparece sin avisar (`if (cargando || !datosSMN) return null`).
- **Impacto:** el usuario no sabe que el aviso no se pudo cargar.
- **Propuesta de fix:** V3.0. Mostrar "No se pudo consultar SMN" con botón de reintento.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-UI-22 — Disclaimer menciona ECMWF; gráfico duplica línea

- **Síntoma:**
  - `DisclaimerModal.jsx` dice "ECMWF IFS de Europa" pero el motor NO usa ECMWF (usa GFS + ICON + GEM).
  - El gráfico de temperatura en `MonitorPublico.jsx` dibuja 3 líneas (`ecmwf`, `gfs`, `icon`). La de `ecmwf` no existe en el motor, así que cae al fallback `temperatura_c` = misma línea que el consenso. Es una línea duplicada visualmente.
- **Impacto:** cosmético pero engañoso.
- **Propuesta de fix:** V3.0. Corregir el disclaimer a "GFS (NOAA), ICON (DWD), GEM (Canadá)". Reemplazar `ecmwf` por `gem` en el gráfico.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-DIAG-01 — `diagnostico_calibracion.ps1` solo simula saturación

- **Síntoma:** el script solo calcula `%días en N2` y `%días en N3` por saturación (`saturacion >= 30` o `>= 65`). **NO simula las 6 reglas del motor.**
- **Impacto:** no sirve para validar regresiones si se toca `riskEvaluator.js`.
- **Propuesta de fix:** H7a cubre esto con Vitest. El script queda como herramienta auxiliar.
- **Estado:** ✅ Resuelto en H7a (Vitest cubre las 6 reglas con 16 tests en `riskEvaluator.test.js`).

### H-DIAG-04 — Motor no calibrado para XIC/HUA/ZAC

- **Síntoma:** el diagnóstico de 90 días revela que XIC (61.9%), HUA (52.4%), ZAC (45.2%) pasan más de la mitad del tiempo en N2 por saturación. Es sobreclasificación estructural.
- **Causa:** umbrales fijos (30mm, 65mm) no se ajustan a zonas de 600+ mm en 90 días.
- **Impacto:** falso positivo estructural en zonas húmedas.
- **Propuesta de fix:** V3.0. Requiere re-auditoría de 90 días para cambiar umbrales.
- **Estado:** ⏸️ Fuera de Etapa 3. Documentado en `06_PENDIENTES.md`.

### H-TEST-02 — `test_regresion_fase1.mjs` declara schema Zod local

- **Síntoma:** el test declara un `EstadoDiocesanoSchema` local en el archivo. Existe `src/schemas/estadoDiocesanoSchema.js` que no se usa.
- **Impacto:** duplicación y divergencia. El schema del test no refleja el real.
- **Propuesta de fix:** H7a importa el schema real.
- **Estado:** ✅ Resuelto en H7a.3 (`regresionFase1.test.js` importa el schema real de `src/schemas/estadoDiocesanoSchema.js`).

### H-TEST-03 — No hay script `"test"` en `package.json`

- **Síntoma:** `package.json` tiene `dev`, `build`, `lint`, `preview`. **No hay `"test"`.**
- **Impacto:** los tests existen pero no se ejecutan. Un dev nuevo no los va a correr.
- **Propuesta de fix:** H7a agrega `"test": "vitest run"`.
- **Estado:** ✅ Resuelto en H7a.1 (`package.json` tiene `"test": "vitest run"` y `"test:watch": "vitest"`).

### H-ENV-01 — Credenciales locales no documentadas

- **Síntoma:** el dev no tiene `GROQ_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `GITHUB_PAT` en su sesión de PowerShell. No puede correr el runner completo en local.
- **Impacto:** no se puede verificar N26 en local. **Decisión de Etapa 3: la verificación funcional es 100% en GitHub Actions.**
- **Propuesta de fix:** H1 documenta cómo se verifica en GitHub Actions (UI o API con `CRON_SECRET`). No se agrega `--dry-run`.
- **Estado:** ✅ Se resuelve en H1 (documentación).

### H-FUNC-01 — Funciones duplicadas

- **Síntoma:** 14 copias de 7 funciones utilitarias esparcidas en `api/`, `scripts/` y `src/`:
  - `formatearTimestamp`: 2 copias.
  - `TextoEnriquecido`: 1 copia interna.
  - `seleccionarNodosRegionales`: 2 copias.
  - `repararMojibake`: 4 copias.
  - `repararObjeto`: 1 copia interna.
  - `normalizarDatosRegionales`: 2 copias.
  - `construirBloqueRegional`: 2 copias.
- **Causa:** evolución incremental. Cada feature nueva copiaba funciones en vez de importarlas.
- **Impacto:** divergencia entre copias (ej. `normalizarDatosRegionales` en `reporteDiario.mjs` tenía `lluvia_manana_24h_mm`, la copia en `api/reporte-ondemand.js` no).
- **Propuesta de fix:** H6 extrae las 7 funciones a 5 módulos en `src/lib/compartido/`.
- **Estado:** ✅ Se resuelve en H6.

### N18 — `consensusEngine.js` no lee visibilidad real

- **Síntoma:** `const vis = (datosHorarios["visibility"]?.[i] ?? 10000) / 1000;` — le falta `visibility_gfs_seamless`. El runner sí lo tiene arreglado.
- **Impacto:** el frontend nunca detecta niebla densa (regla N2 por visibilidad <= 2km).
- **Propuesta de fix:** H5. Fix de 1 línea.
- **Estado:** ✅ Resuelto (H7a.2). El código ya leía `visibility_gfs_seamless` desde H7a.2, pero nadie lo documentó. En H5.1 se agregó un test de blindaje del fallback triple (`_gfs_seamless` → `visibility` → 10000m) para evitar regresiones. Commit `6becdf9`.

---

## 🟢 Baja prioridad (13)

### H-API-02 — `disparar-workflow.js` no loguea IP/UA
- **Síntoma:** no hay log del origen del disparo.
- **Propuesta:** V3.0. Agregar `console.log` con IP y User-Agent.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-API-05 — `latest-gif.js` regex asume patrón NOAA fijo
- **Síntoma:** la regex `/href="(\d{11}-\d{11}-[^"]*-1000x1000\.gif)"/g` falla si NOAA cambia el sufijo.
- **Propuesta:** V3.0. Agregar fallback y telemetría.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-API-08 — Fallback de `glm.js` apunta a GOES-16
- **Síntoma:** el fallback hardcodeado apunta a `GOES16-MEX-GEOCOLOR` (satélite viejo, path obsoleto).
- **Propuesta:** H2b elimina `glm.js` completo.
- **Estado:** ✅ Se resuelve en H2b (eliminación).

### H-API-09 — Fallback de `glm.js` hardcodea timestamp
- **Síntoma:** el fallback hardcodea `20262761041-20262761456-...`, que no se actualiza.
- **Propuesta:** H2b elimina `glm.js`.
- **Estado:** ✅ Se resuelve en H2b (eliminación).

### H-UI-04 — `formatearTimestamp` duplicada
- **Síntoma:** idéntica en `MonitorPublico.jsx` y `SatRCOperativo.jsx`.
- **Propuesta:** H6 extrae a `src/lib/compartido/fechas.js`.
- **Estado:** ✅ Se resuelve en H6.

### H-UI-07 — Secciones I-VI sin guard de contenido
- **Síntoma:** `ReporteCuerpo.jsx` muestra títulos sin cuerpo si el reporte no tiene esa sección.
- **Propuesta:** V3.0. Agregar guard.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-UI-09 — `TextoEnriquecido` no maneja markdown completo
- **Síntoma:** no maneja `# headers`, `_cursivas_`, `[links]()`.
- **Propuesta:** V3.0.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-UI-10 — `TextoEnriquecido` no exportado
- **Síntoma:** está dentro de `ReporteCuerpo.jsx`. Si otro componente lo necesita, hay que duplicar.
- **Propuesta:** H6 extrae a `src/lib/compartido/markdown.jsx`.
- **Estado:** ✅ Se resuelve en H6.

### H-UI-11 — Print CSS del modal operativo
- **Síntoma:** imprime fondo oscuro al hacer "Imprimir / PDF".
- **Propuesta:** V3.0. Revisar estilos `print:*`.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-UI-19 — `parseNoaaStamp` no valida rangos
- **Síntoma:** no valida `diaJuliano 1-366`, `horas 0-23`, `minutos 0-59`.
- **Propuesta:** H7b. Tests + validación.
- **Estado:** ✅ Se resuelve parcialmente en H7b (tests).

### H-UI-23 — `DisclaimerModal` código muerto
- **Síntoma:** rama `else` con `abierto === undefined` nunca se ejecuta.
- **Propuesta:** V3.0. Eliminar código muerto.
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-INFRA-01 — No hay `vercel.json`
- **Síntoma:** deploy por autodetección.
- **Propuesta:** V3.0. Agregar `vercel.json` explícito (región, memoria, timeout).
- **Estado:** ⏸️ Fuera de Etapa 3.

### H-NOM-01 — `procesar_datos.cjs` escribe `version: "3.0"`
- **Síntoma:** el JSON de localidades dice `version: "3.0"`. Confunde con "Etapa 3 ≠ V3.0".
- **Propuesta:** V3.0. Cambiar a `"2.0"` o `"2.1"`.
- **Estado:** ⏸️ Fuera de Etapa 3.

---

## ⚠️ Documentación (1)

### H-API-01 — Nomenclatura repo vs carpeta
- **Síntoma:** repo GitHub = `satrc-v2`. Carpeta local = `satrc-v3`.
- **Resolución:** NO es un bug. `disparar-workflow.js` apunta a `satrc-v2` correctamente. **No cambiar a `satrc-v3`.**
- **Estado:** ✅ Documentado en `08_ETAPA3_PLAN.md` sección 2.

---

## Anexo A — Hallazgos resueltos en Etapa 3

| ID | Hito | Estado |
|---|---|---|
| H-MOTOR-02 | H2a | ✅ |
| H-API-07 | H2b | ✅ |
| H-API-08 | H2b (eliminación) | ✅ |
| H-API-09 | H2b (eliminación) | ✅ |
| H-MOTOR-04 | H3 | ✅ |
| H-UI-04 | H6 | ✅ |
| H-UI-10 | H6 | ✅ |
| H-TEST-01 | H7a + H7b | ✅ |
| H-TEST-02 | H7a | ✅ |
| H-TEST-03 | H7a | ✅ |
| H-DIAG-01 | H7a | ✅ |
| H-MOTOR-01 | H4 (parcial) | ✅ |
| N18 | H5 | ✅ |
| H-ENV-01 | H1 (documentación) | ✅ |
| H-FUNC-01 (Funciones Duplicadas) | H6 | ✅ |

## Anexo B — Hallazgos diferidos a V3.0

| ID | Motivo |
|---|---|
| H-MOTOR-05 | Requiere re-auditoría de 90 días (calibración). |
| H-SEG-01 | Requiere rediseño de contrato (auth real). |
| H-UI-01, H-UI-02, H-UI-03 | Decisión de diseño (Monitor no evalúa riesgo). |
| H-UI-07, H-UI-08, H-UI-09, H-UI-11, H-UI-19, H-UI-23 | Cosmético o de bajo impacto. |
| H-UI-13, H-UI-14, H-UI-22 | Cosmético / UI. |
| H-API-02, H-API-05 | Bajo impacto. |
| H-DIAG-04 | Requiere re-auditoría. |
| H-MOTOR-01 (unificación total) | Rediseño. |
| H-MOTOR-03 | Coherencia menor. |
| H-INFRA-01 | Bajo impacto. |
| H-NOM-01 | Cosmético. |

---

**Fin del registro de hallazgos.**