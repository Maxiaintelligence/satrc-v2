# SatRC V2.0 — Historial de Bugs Críticos y Soluciones

Este documento registra los bugs estructurales resueltos en Octubre de 2026 (Fase C2c) y durante la Etapa 3 de desarrollo.

---

## Fase C2c (Bugs iniciales)

### N29 — Inconsistencia entre Sección 0 y Sección II del Reporte
- **Síntoma:** El reporte on-demand mencionaba zonas distintas en la "Decisión Operativa" (Sec 0) y en "Zonas que Requieren Atención" (Sec II).
- **Causa:** Groq interpretaba dos criterios distintos para ambas secciones.
- **Fix:** Se añadió la regla `12.bis` en los prompts exigiendo que ambas secciones mencionen EXACTAMENTE las mismas zonas.

### N33 / N35 — El Parser del SMN no detectaba avisos reales
- **Síntoma:** Había avisos de lluvias torrenciales de CONAGUA, pero el sistema decía "Sin aviso".
- **Causa:** El endpoint `/api/smn.js` consultaba un webservice (`method=1`) que solo tiene el pronóstico general, no los avisos.
- **Fix:** Se reescribió `api/smn.js` para hacer scraping a la página principal (`smn.conagua.gob.mx/es/`) buscando patrones reales (ej. "torrenciales") y asignando niveles.

### N34 / N36 — Groq alucinaba títulos "Normales" con datos de Emergencia
- **Síntoma:** El runner reportaba 19 localidades en N4 (Emergencia), pero Groq escribía el título "Situación Meteorológica Normal".
- **Causa:** El prompt era ambiguo y la regla de "no mencionar números" hacía que Groq ignorara los conteos.
- **Fix:** Se añadió una `REGLA CRÍTICA DE COHERENCIA` en el prompt del runner: *Si N4>0, el título DEBE decir Emergencia.* Se le pasó el nivel del SMN en el `userPrompt`.

### N27 — Mojibake (Doble Encoding UTF-8)
- **Síntoma:** La bitácora y los reportes mostraban caracteres como `Ã³` o `Ã­` en lugar de `ó` o `í`.
- **Causa Raíz:** El runtime de GitHub Actions (al usar `@vercel/blob`) guarda los strings con doble encoding.
- **Fix (Parche):** Se implementó la función `repararMojibake()` en `/api/sara.js` y `/api/reporte-ondemand.js` para limpiar el texto **en la lectura**, antes de enviarlo al frontend.
- **Deuda Técnica:** La causa raíz en el runner no está resuelta. Los datos en el Blob siguen con mojibake, pero el frontend los ve limpios.

### N30/N31 / N37 — Fricción en On-Demand y Falta de Sección 0 en TXT
- **Síntoma:** Si fallaban zonas, el operador debía reintentar manualmente. Además, el TXT descargable no incluía la Decisión Operativa.
- **Fix:** Se añadió un reintento automático (2 intentos) en `SatRCOperativo.jsx` y se agregó `DECISIÓN OPERATIVA DEL DÍA:` al generador del TXT.

---

## Etapa 3 (Hitos H0–H9)

### N26 — Cobertura de zonas en el runner (Resuelto en Etapa 3, H1)
- **Síntoma:** el runner reportaba `zonas_ok = 9/14`. 5 zonas quedaban sin datos (falso negativo N1).
- **Causa:** 14 fetches en vuelo simultáneo saturaban Open-Meteo.
- **Fix (H1):** se replicó el patrón de **lotes de 4** con `Promise.allSettled` y delay de 500ms.
- **Verificación:** corrida `39067735652` con `14/14 zonas OK`.
- **Commits:** `3ee8253`, `da696cc`.

### H-MOTOR-02 — Parser SMN del runner (Resuelto en Etapa 3, H2a)
- **Síntoma:** el runner consultaba un webservice viejo y la `alertaSMN` quedaba en `null`.
- **Causa:** N33 se arregló en la API pero no en el runner.
- **Fix (H2a):** se replicó la lógica de scraping (6 patrones, 3 estados) en el runner.
- **Commits:** `2cb3231`.

### H-MOTOR-06 — Aplicación indiscriminada del aviso SMN (Resuelto en Etapa 3, H2c)
- **Síntoma:** El aviso era solo para VER, pero todas las zonas de Sierra subieron.
- **Causa:** `lluviaEfectiva24h` aplicaba el piso SMN sin verificar el estado.
- **Fix (H2c):** se agregó verificación de `estados_afectados` (HGO, PUE, VER).
- **Verificación:** corrida `39307266292` con semáforo corregido (N4=4, N3=24).
- **Commits:** `12375d0`.

### H-API-07/08/09 — `api/glm.js` era código muerto (Resuelto en Etapa 3, H2b)
- **Síntoma:** endpoint huérfano con fallbacks rotos (GOES-16, timestamp hardcodeado).
- **Fix (H2b):** se eliminó `api/glm.js`.
- **Commits:** `840c671`.

### H-MOTOR-04 — Fallback del frontend con 1 solo nodo (Resuelto en Etapa 3, H3)
- **Síntoma:** si el Blob fallaba, se usaba solo Huauchinango, sobreclasificando N2.
- **Fix (H3):** se expandió el fallback a los 14 nodos regionales.
- **Commits:** `9a05052`.

### H4 — Runner duplica el motor inline (H-MOTOR-01, Resuelto parcialmente)
- **Síntoma:** el runner tenía una copia inline de las 6 reglas, divergente del frontend.
- **Fix (H4):** se extrajo `scripts/engine/riskEvaluatorRunner.mjs` (~185 líneas) y se crearon 3 tests (shape, zonaSinDatos, paridad).
- **Estado:** Resuelto parcialmente. Unificación total en V3.0.
- **Commits:** `a94324c`, `3e702f4`.

### H5 — `consensusEngine.js` no leía visibilidad real (N18)
- **Síntoma:** el frontend no leía `visibility_gfs_seamless`, fallaba a 10km por defecto.
- **Fix (H5):** el código ya lo tenía resuelto desde H7a.2. Se agregó un test de blindaje del fallback triple.
- **Commits:** `6becdf9`.

### H-FUNC-01 — Funciones duplicadas (Resuelto en Etapa 3, H6)
- **Síntoma:** 14 copias de 7 funciones esparcidas en el código.
- **Fix (H6):** se crearon 5 módulos compartidos en `src/lib/compartido/` (`fechas`, `markdown`, `nodos`, `mojibake`, `regionales`).
- **Commits:** `742ead5`, `e81da8d`, `39049be`, `9d9dd40`, etc.

### H-TEST-04 — Suite de tests con Vitest (Resuelto en Etapa 3, H7a)
- **Síntoma:** 4 tests obsoletos/rotos, sin script `"test"` ni CI.
- **Fix (H7a):** instalación de Vitest, 36 tests iniciales y CI en GitHub Actions.
- **Commits:** `338cc4d`, `d8b59bf`, `734a77b`, `ac5c9ef`, `4bfd241`.

### H7b — Vitest resto + extracción de `parseNoaaStamp` (Resuelto en Etapa 3)
- **Síntoma:** parseo NOAA inline y sin validación de rangos (H-UI-19).
- **Fix (H7b):** tests de `mojibake`, `regionales`, `fechas`. Extracción de `noaa.js` con validación de rangos.
- **Commits:** `4c23f52`, `54f00d0`.

### H8 — Zod activo: validación del contrato (Resuelto en Etapa 3)
- **Síntoma:** el schema Zod existía pero no se usaba. Datos corruptos llegaban al frontend.
- **Fix (H8):** doble schema (`Blob` y `Response`). Validación en `/api/sara` y en el runner.
- **Commits:** `af82f44`, `bd5ca6d`, `c168385`.

### H8.4 / H8.5 — Hotfixes de Zod y Groq (Resuelto en Etapa 3)
- **Síntoma H8.4:** Zod rechazaba la API porque faltaba `hora_local_mexico` en el Response.
- **Fix H8.4:** se hizo el campo opcional en el schema (`862a446`).
- **Síntoma H8.5:** Groq fallaba con HTTP 400 (`json_validate_failed`) porque el JSON de 7 secciones se cortaba antes de cerrar (`max completion tokens reached`). Además, había un paréntesis faltante en el `fetch` del on-demand.
- **Fix H8.5:** se agregó `max_completion_tokens: 4096` y se cerró el paréntesis (`e3cff05`).
- **Verificación:** Reporte on-demand generado exitosamente en producción.

---

## Hito H9 — Cierre Documental

### H9 — Cierre de Etapa 3
- **Acciones:** actualización de `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `08_ETAPA3_PLAN.md` y `10_HANDOVER.md`.
- **Tag:** `etapa-3-cerrada`.
- **Commit:** `<hash-commit-H9>`.
- **Estado:** ✅ **Etapa 3 completada.**