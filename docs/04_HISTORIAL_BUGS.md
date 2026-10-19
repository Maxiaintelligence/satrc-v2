# SatRC V2.0 — Historial de Bugs Críticos y Soluciones

Este documento registra los bugs estructurales resueltos en Octubre de 2026 (Fase C2c) y durante la Etapa 3 de desarrollo.

## N29 — Inconsistencia entre Sección 0 y Sección II del Reporte
- **Síntoma:** El reporte on-demand mencionaba zonas distintas en la "Decisión Operativa" (Sec 0) y en "Zonas que Requieren Atención" (Sec II).
- **Causa:** Groq interpretaba dos criterios distintos para ambas secciones.
- **Fix:** Se añadió la regla `12.bis` en los prompts exigiendo que ambas secciones mencionen EXACTAMENTE las mismas zonas.

## N33 — El Parser del SMN no detectaba avisos reales
- **Síntoma:** Había avisos de lluvias torrenciales de CONAGUA, pero el sistema decía "Sin aviso".
- **Causa:** El endpoint `/api/smn.js` consultaba un webservice (`method=1`) que solo tiene el pronóstico general, no los avisos.
- **Fix:** Se reescribió `api/smn.js` para hacer scraping a la página principal (`smn.conagua.gob.mx/es/`) buscando patrones reales (ej. "torrenciales") y asignando niveles.

## N34 — Groq alucinaba títulos "Normales" con datos de Emergencia
- **Síntoma:** El runner reportaba 19 localidades en N4 (Emergencia), pero Groq escribía el título "Situación Meteorológica Normal".
- **Causa:** El prompt era ambiguo y la regla de "no mencionar números" hacía que Groq ignorara los conteos.
- **Fix:** Se añadió una `REGLA CRÍTICA DE COHERENCIA` en el prompt del runner: *Si N4>0, el título DEBE decir Emergencia.*

## N27 — Mojibake (Doble Encoding UTF-8)
- **Síntoma:** La bitácora y los reportes mostraban caracteres como `Ã³` o `Ã­` en lugar de `ó` o `í`.
- **Causa Raíz:** El runtime de GitHub Actions (al usar `@vercel/blob`) guarda los strings con doble encoding.
- **Fix (Parche):** Se implementó la función `repararMojibake()` en `/api/sara.js` y `/api/reporte-ondemand.js` para limpiar el texto **en la lectura**, antes de enviarlo al frontend.
- **Deuda Técnica:** La causa raíz en el runner no está resuelta. Los datos en el Blob siguen con mojibake, pero el frontend los ve limpios.

## N30/N31 — Fricción en On-Demand y Falta de Sección 0 en TXT
- **Síntoma:** Si fallaban zonas, el operador debía reintentar manualmente. Además, el TXT descargable no incluía la Decisión Operativa.
- **Fix:** Se añadió un reintento automático (2 intentos) en `SatRCOperativo.jsx` y se agregó la sección 0 al generador del TXT.

## N35 — El Parser del SMN (Resuelto)
- **Síntoma:** El SMN emitió alerta de Lluvias Torrenciales, pero el sistema decía "Sin aviso".
- **Causa:** El endpoint consultaba un webservice equivocado.
- **Fix:** Se reescribió `api/smn.js` para hacer scraping a la página principal del SMN, buscando patrones de texto ("torrenciales", "hidalgo", "puebla") y asignando nivel 3.

## N36 — Groq alucinaba "Situación Normal" con N4=19 (Resuelto)
- **Síntoma:** El runner reportó 19 emergencias, pero Groq escribió "Situación Meteorológica Normal".
- **Causa:** El prompt era ambiguo y la regla de "no mencionar números" hacía que Groq ignorara el contexto.
- **Fix:** Se añadió la `REGLA CRÍTICA DE COHERENCIA` en el prompt del runner y se le pasó el nivel del SMN en el `userPrompt`.

## N37 — Sección 0 no aparecía en el TXT descargable (Resuelto)
- **Síntoma:** El operador descargaba el TXT y no veía la "Decisión Operativa".
- **Fix:** Se añadió `DECISIÓN OPERATIVA DEL DÍA:` al generador de TXT en `SatRCOperativo.jsx`.


## N26 — Cobertura de zonas en el runner (Resuelto en Etapa 3)

- **Síntoma:** el runner (`scripts/ejecutar_sara_autonomo.mjs`) reportaba `zonas_ok = 9/14` en días de alta latencia de Open-Meteo. 5 zonas quedaban sin datos, y sus 405 localidades se marcaban como `sin_datos_regionales: true` → Nivel 1 (falso negativo).
- **Causa:** la función `cargarSeriesRegionales()` disparaba 14 fetches con un stagger de 200ms, pero **las 14 quedaban en vuelo simultáneamente**. Con `TIMEOUT_FETCH_MS = 30000` y 2 reintentos por zona, se acumulaban hasta 14 conexiones concurrentes a Open-Meteo. Open-Meteo comenzaba a rechazar o demorar algunas.
- **Fix (Etapa 3):** se replicó el patrón de **lotes de 4** que ya funcionaba en `src/engine/reportesRegionales.js` (frontend).
  - Cada lote dispara 4 fetches en vuelo.
  - `Promise.allSettled(lote)` espera a que los 4 terminen (con o sin éxito).
  - Delay de 500ms entre lotes.
  - Reintentos internos de `consultarZonaConReintentos()` no cambian (2 intentos × 30s por zona).
- **Verificación:** corrida de GitHub Actions (run `39067735652`) con `zonas_ok = 14/14` en 2.7s.
- **Commit:** `3ee8253` (fix), `da696cc` (restauración de `repararMojibake` eliminada por error en `3ee8253`).
- **Estado:** ✅ Cerrado en Etapa 3.

## H-MOTOR-02 — Parser SMN del runner (Resuelto en Etapa 3)

- **Síntoma:** el runner consultaba `smn.conagua.gob.mx/tools/GUI/webservices/index.php?method=1`, que devuelve solo el pronóstico general, **no los avisos**. La `alertaSMN` que se pasaba a Groq y al motor quedaba casi siempre en `null`.
- **Causa:** N33 se arregló en `api/smn.js` (scraping de la página principal) pero **nunca se replicó en el runner**.
- **Fix (Etapa 3):** se reescribió la sección `// --- 1. Aviso SMN ---` del runner con la misma lógica de scraping de `api/smn.js`:
  - Consulta `https://smn.conagua.gob.mx/es/` con `AbortSignal.timeout(10000)`.
  - Detecta 6 patrones: torrenciales, intensas, fuertes, chubascos, frente frío, ciclón.
  - Detecta 3 estados: HGO, PUE, VER.
  - Genera `alertaSMN` con `activo`, `nivel`, `severidad` (antes no tenía estos campos).
- **Verificación:** corrida `39305464029` detectó `Aviso Severo del SMN (Lluvias Torrenciales) para VER.` con `14/14 zonas OK`. El semáforo cambió de N4=19 a N4=38 (ver H-MOTOR-06).
- **Commit:** `2cb3231`.
- **Estado:** ✅ Cerrado en Etapa 3.

## H-MOTOR-06 — Aplicación indiscriminada del aviso SMN (Resuelto en Etapa 3)

- **Síntoma:** después de H-MOTOR-02, el semáforo cambió de N4=19/N3=51 a N4=38/N3=96. El aviso era **solo para VER** (Veracruz), pero **todas las zonas de Sierra subieron**.
- **Causa:** en `riskEvaluator.js` y en el runner, `lluviaEfectiva24h` aplicaba el piso de `alertaSMN.rango_lluvia_min_mm` a **todas las localidades en zonas de Sierra**, sin verificar si la localidad estaba en un estado afectado por el aviso.
- **Fix (Etapa 3):** se agregó verificación de `estados_afectados` antes de aplicar el piso:
  - **`riskEvaluator.js`** (frontend): se agregó `veracruz` al filtro `bajoAvisoFederalSierra` (solo PUE y HGO estaban contemplados). Se cambió el fallback de `|| 75` a `|| 0`.
  - **`ejecutar_sara_autonomo.mjs`** (runner): se agregó la constante `estadoAfectado` que verifica `HGO`, `PUE`, `VER` contra `loc.estado`. Solo si la localidad está en un estado afectado, se aplica el piso.
- **Verificación:** corrida `39307266292` con `14/14 zonas OK`, `Aviso Severo del SMN (Lluvias Torrenciales) para VER`, y semáforo `N4=4, N3=24, N2=249, N1=128` (antes de H2c era N4=38, N3=96).
- **Commit:** `12375d0` (fix), `df3f7ad` (docs).
- **Estado:** ✅ Cerrado en Etapa 3.


## H-API-07 — `api/glm.js` era código muerto (Resuelto en Etapa 3)

- **Síntoma:** el endpoint `api/glm.js` existía pero **ningún `.jsx` lo consumía**. `SatelliteViewer.jsx` usa `/api/latest-gif` para todos los productos (incluido GLM).
- **Causa:** el endpoint se creó para GLM, pero al generalizar `latest-gif.js` para los 5 productos NOAA (geocolor, glmFed, fireTemperature, sandwich, airMass), `glm.js` quedó huérfano.
- **Impacto:** consumía una función serverless de Vercel (cuota, cold start, mantenimiento). Además, tenía fallbacks rotos (apuntaba a GOES-16, satélite viejo, y a un timestamp hardcodeado que no se actualizaba). Eso era H-API-08 y H-API-09.
- **Fix (Etapa 3):** se eliminó `api/glm.js` del repositorio.
- **Verificación:** `/api/glm` devuelve 404, `/api/sara`, `/api/smn`, `/api/latest-gif` siguen funcionando OK.
- **Commit:** `840c671` (eliminación), `107834b` (docs).
- **Estado:** ✅ Cerrado en Etapa 3. H-API-08 y H-API-09 también quedan cerrados (eliminados con el archivo).


## H-MOTOR-04 — Fallback del frontend con 1 solo nodo (Resuelto en Etapa 3)

- **Síntoma:** cuando el Blob fallaba, `SatRCOperativo.jsx` → `ejecutarEvaluacionRealEnVivo()` usaba solo el nodo Huauchinango para las 405 localidades. Eso es el bug ADR-001 reintroducido en el fallback (el runner ya usaba 14 nodos, pero el frontend no).
- **Causa:** el fallback se escribió antes de ADR-001 y nunca se actualizó.
- **Impacto:** si el Blob falla, el frontend vuelve a sobreclasificar N2 en zonas secas (44% de falsos positivos, el mismo síntoma que motivó ADR-001).
- **Fix (Etapa 3):** se reescribió `ejecutarEvaluacionRealEnVivo()` con la lógica del runner:
  - Usa `seleccionarNodosRegionales()` (importado de `reportesRegionales.js`).
  - Hace 14 fetches en lotes de 4 (mismo patrón que `reportesRegionales.js`).
  - Construye un objeto `seriesPorZona` con la serie de consenso de cada zona.
  - Evalúa cada localidad con la serie de su zona.
- **Verificación funcional pendiente en H7a (Vitest con mock de `fetch`).** Verificación actual: `npm run build` OK, sin `nodoSierra` en el archivo.
- **Commit:** `9a05052` (fix), `b7c037f` (docs).
- **Estado:** ✅ Cerrado en Etapa 3.


## H-FUNC-01 — Funciones duplicadas (Resuelto en Etapa 3, sub-hito H6)

- **Síntoma:** durante la auditoría de Etapa 3, se detectaron 14 copias de 7 funciones utilitarias esparcidas en múltiples archivos:
  - `formatearTimestamp`: 2 copias (`MonitorPublico.jsx`, `SatRCOperativo.jsx`).
  - `TextoEnriquecido`: 1 copia interna en `ReporteCuerpo.jsx` (no exportada).
  - `seleccionarNodosRegionales`: 2 copias (`reportesRegionales.js`, `ejecutar_sara_autonomo.mjs`).
  - `repararMojibake`: 4 copias (`api/sara.js`, `api/reporte-ondemand.js`, `scripts/reportes/reporteDiario.mjs`, `scripts/ejecutar_sara_autonomo.mjs`).
  - `repararObjeto`: 1 copia en `api/sara.js` (no exportada).
  - `normalizarDatosRegionales`: 2 copias (`api/reporte-ondemand.js`, `scripts/reportes/reporteDiario.mjs`).
  - `construirBloqueRegional`: 2 copias (mismos 2 archivos).

- **Causa:** evolución incremental del proyecto. Cada feature nueva agregaba funciones utilitarias copiadas de otro archivo, en vez de importarlas.

- **Impacto:**
  - Un cambio en una de las copias no se reflejaba en las demás (divergencia).
  - Ejemplo detectado: `normalizarDatosRegionales` en `reporteDiario.mjs` tenía el campo `lluvia_manana_24h_mm` (ventana 72h), pero la copia en `api/reporte-ondemand.js` no (ventana 48h). Las 2 versiones se habían separado sin que nadie lo documentara.
  - Riesgo de bugs sutiles: arreglar una función en un archivo y olvidar las otras.

- **Fix (Etapa 3, sub-hito H6):** se crearon 5 módulos compartidos en `src/lib/compartido/`:
  - **`fechas.js`** → `formatearTimestamp`.
  - **`markdown.jsx`** → `TextoEnriquecido`.
  - **`nodos.js`** → `seleccionarNodosRegionales`.
  - **`mojibake.js`** → `repararMojibake`, `repararObjeto`.
  - **`regionales.js`** → `normalizarDatosRegionales`, `construirBloqueRegional`.

  **14 copias eliminadas. 7 funciones ahora viven en 5 módulos compartidos.**

  **Nota sobre `normalizarDatosRegionales`:** se unificó agregando el campo `lluvia_manana_24h_mm` (que antes solo existía en `reporteDiario.mjs`). En `api/reporte-ondemand.js`, el campo llega como `null` (ventana 48h), lo cual es inocuo porque el prompt de Groq no menciona ese campo.

- **Verificación:** `npm run build` OK, `/api/sara` sigue respondiendo 200, `/api/reporte-ondemand` sigue respondiendo 405 al GET, el runner de GitHub Actions corre con `14/14 zonas OK`, la bitácora conserva sus 181 entradas, el título del dictamen sigue sin mojibake.

- **Commits:**
  - H6.1: `742ead5` — `formatearTimestamp` → `fechas.js`.
  - H6.2: `<hash>` — `TextoEnriquecido` → `markdown.jsx`.
  - H6.3: `e81da8d` — `seleccionarNodosRegionales` → `nodos.js`.
  - H6.4.1: `39049be` — Crea `mojibake.js`.
  - H6.4.2: `9d9dd40` — `reporteDiario.mjs` migrado.
  - H6.4.3: `<hash>` — `ejecutar_sara_autonomo.mjs` migrado.
  - H6.4.4a: `<hash>` — `api/reporte-ondemand.js` migrado.
  - H6.4.4b: `<hash>` — `api/sara.js` migrado.
  - H6.5: `<hash>` — `normalizarDatosRegionales` + `construirBloqueRegional` → `regionales.js`.

- **Estado:** ✅ Cerrado en Etapa 3 (sub-hito H6).