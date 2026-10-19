# SatRC V2.0 — Historial de Bugs Críticos y Soluciones

Este documento registra los bugs estructurales resueltos en Octubre de 2026 (Fase C2c).

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
- **Commit:** `<hash>` (pendiente de pushear).
- **Estado:** ✅ Cerrado en Etapa 3.


## H-API-07 — `api/glm.js` era código muerto (Resuelto en Etapa 3)

- **Síntoma:** el endpoint `api/glm.js` existía pero **ningún `.jsx` lo consumía**. `SatelliteViewer.jsx` usa `/api/latest-gif` para todos los productos (incluido GLM).
- **Causa:** el endpoint se creó para GLM, pero al generalizar `latest-gif.js` para los 5 productos NOAA (geocolor, glmFed, fireTemperature, sandwich, airMass), `glm.js` quedó huérfano.
- **Impacto:** consumía una función serverless de Vercel (cuota, cold start, mantenimiento). Además, tenía fallbacks rotos (apuntaba a GOES-16, satélite viejo, y a un timestamp hardcodeado que no se actualizaba). Eso era H-API-08 y H-API-09.
- **Fix (Etapa 3):** se eliminó `api/glm.js` del repositorio.
- **Verificación:** `/api/glm` devuelve 404, `/api/sara`, `/api/smn`, `/api/latest-gif` siguen funcionando OK.
- **Commit:** `<hash>` (pendiente de pushear).
- **Estado:** ✅ Cerrado en Etapa 3. H-API-08 y H-API-09 también quedan cerrados (eliminados con el archivo).