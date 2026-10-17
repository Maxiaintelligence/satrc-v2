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