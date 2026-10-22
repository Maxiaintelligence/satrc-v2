# SatRC V2.0 — Historial de Bugs Críticos y Soluciones

> **Versión:** 2.3.0 (Cierre de Etapa 4)
> **Última actualización:** 22 de octubre de 2026.
> Este documento registra los bugs estructurales resueltos en Octubre de 2026: Fase C2c (bugs iniciales), Etapa 3 (H0–H9) y Etapa 4 (H6.1–H6.7).

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

### H9 — Cierre de Etapa 3
- **Acciones:** actualización de `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `08_ETAPA3_PLAN.md` y `10_HANDOVER.md`.
- **Tag:** `etapa-3-cerrada`.
- **Estado:** ✅ **Etapa 3 completada.**

---

## Etapa 4 (Hitos H6.1–H6.7)

### H-ORQ-01 — Test 1 del orquestador con aserción incompatible con la sigmoide (Resuelto en Etapa 4, H5)

- **Síntoma:** El Test 1 ("Calma Total") del `crossThreatOrchestrator.test.js` fallaba con `expected 1.12 to be 1` en línea 86.
- **Causa:** La aserción `expect(niveles_por_vector.convectivo).toBe(1.0)` contradecía el diseño documentado de la sigmoide anti-parpadeo de `convectiveEvaluator.js` (§2.1 de `13_E4_CONVECTIVE_EVALUATOR.md`). Para CAPE=500, la sigmoide devuelve 1.118 → 1.12.
- **Fix:** Se ajustó la aserción a `toBeGreaterThanOrEqual(1.0)` + `toBeLessThan(2.0)` (rango N1 continuo, coherente con el diseño).
- **Verificación:** 7/7 tests del orquestador, 112/112 tests de la suite completa, CI en verde.
- **Commit:** `29230c1`.
- **Nota:** este hallazgo destrabó el commit de `crossThreatOrchestrator.js` + su test (untracked desde el bloqueo del equipo anterior). Desbloquea H6-E4.

### H-E4-01 — Variables E4 no verificadas empíricamente en Open-Meteo (Resuelto en Etapa 4, H6.0)

- **Síntoma:** los scripts `diagnostico_calibracion.ps1`, `simulacion_nodos.ps1` y `simulacion_nodos_v2.ps1` solo verificaron 4 variables hidrológicas (`precipitation`, `temperature_2m`, `wind_speed_10m`, `wind_gusts_10m`). Las 8 variables E4 nunca se verificaron con PowerShell contra Open-Meteo real.
- **Causa:** el equipo anterior asumió que las variables existían porque la documentación de Open-Meteo las menciona. No se verificó empíricamente.
- **Hallazgo (nivel 1):** `verificar_variables_e4.ps1` sobre 14 zonas dio 0/8 variables con datos. Parecía que las variables no existían.
- **Hallazgo (nivel 2):** `verificar_variables_e4_nivel2.ps1` reveló que Open-Meteo devuelve las variables E4 con sufijo `_modelo` (`_gfs_seamless`, `_icon_seamless`, `_gem_seamless`) cuando se piden múltiples modelos. Las 8 variables SÍ existen, pero con sufijo. Además, GEM devuelve `null` en `freezing_level_height`.
- **Fix:** el pipeline H6.1–H6.3 pide las 8 variables con los 3 modelos, consensúa con estrategias específicas (mediana, max, gfs_preferente) y expone los valores sin sufijo.
- **Verificación:** 123/123 tests, `/api/sara` → `VERCEL_BLOB_ACTUALIZADO`, semáforo real sobre 405 localidades.
- **Commits:** `8563829` (docs de cierre H-E4-01) + `b8f34f0` (hallazgo nivel 2).
- **Lección:** documentada en `06_PENDIENTES.md` como metodología extendida. Antes de codificar contra una API externa, verificar con PowerShell.

### H-ORQ-02 — `windEvaluator` emitía nivelContinuo inconsistente (Resuelto en Etapa 4, H6.4a)

- **Síntoma:** En la auditoría H6.4, 47 localidades de Pachuca reportaban N2 falso. El `windEvaluator` emitía `nivel_alerta=1` (Vientos Normales) pero `nivel_alerta_continuo=2.25`. El orquestador usaba el continuo y las trataba como N2.
- **Causa:** las fórmulas de `nivelContinuo` no estaban clampeadas al nivel discreto. Para N1 con `vEqFinal=47.6`, la fórmula lineal supera 2.0 sin que el motor cambie a N2.
- **Fix:** `Math.min(1.99, ...)`, `Math.min(2.99, ...)`, `Math.min(3.99, ...)` en las 3 fórmulas de `windEvaluator.js`.
- **Verificación:** 10/10 tests de `windEvaluator`, 116/116 suite completa. Auditoría H6.4 post-fix: cambio total 2-3% (antes 14.3%).
- **Commit:** `74504c2`.
- **Lección:** todo campo nuevo en el shape (como `nivel_alerta_continuo`) debe tener al menos un test que verifique su rango esperado, no solo el nivel discreto. Documentado como H-TEST-05.

### H-ORQ-03 — `mapearANivel` desalineado con el diseño de los módulos (Resuelto en Etapa 4, H6.4a)

- **Síntoma:** En la auditoría H6.4, 47 localidades de Pachuca seguían reportando N2 falso incluso después del clamp del `windEvaluator`.
- **Causa:** `mapearANivel` usaba umbrales `>= 1.5 → 2`, `>= 2.5 → 3`, `>= 3.5 → 4`. Pero los 4 módulos emiten `nivelContinuo` entre `[nivel, nivel+0.99]`. Un N1 con `nivelContinuo=1.69` disparaba N2 global. El clamp del `windEvaluator` a 1.99 no era suficiente.
- **Fix:** `mapearANivel` ahora usa umbrales `>= 2.0 → 2`, `>= 3.0 → 3`, `>= 4.0 → 4`. Alineado con el rango de cada nivel.
- **Verificación:** 7/7 tests de `crossThreatOrchestrator`, 116/116 suite completa. Auditoría H6.4 post-fix: cambio total ~2-3%.
- **Commit:** `74504c2`.
- **Lección:** documentada como H-TEST-07.

### H-ORQ-04 — Adaptador de shape en el runner (Resuelto en Etapa 4, H6.4+H6.5)

- **Síntoma:** `evaluarMultiamenaza` devuelve `nivel_alerta_global`, pero Zod (`EstadoDiocesanoBlobSchema`) y el frontend esperan `nivel_alerta`. Sin adaptador, Zod rechazaría el `paqueteMaestro`.
- **Causa:** el shape del orquestador es distinto al shape del motor viejo.
- **Fix:** adaptador en `ejecutar_sara_autonomo.mjs` (sección 5) que:
  1. Mapea `res.nivel_alerta_global → nivel_alerta` (compatibilidad).
  2. Mantiene los campos del orquestador como aditivos (`nivel_alerta_global`, `riesgo_continuo`, `niveles_por_vector`, `acciones_operativas`, `diagnosticos_por_vector`).
  3. Incluye `try/catch` con fallback al motor viejo (`evaluarLocalidadRunner`) si el orquestador falla para una localidad puntual.
- **Además (H6.5):** se extendió `EstadoDiocesanoBlobSchema` con 5 campos opcionales y se agregó `.passthrough()` al campo `diagnostico` para aceptar `acoplamiento`.
- **Verificación:** 123/123 tests, CI en verde, `/api/sara` → `VERCEL_BLOB_ACTUALIZADO`, semáforo real sobre 405 localidades.
- **Commit:** `caae110`.

### H6.7 — Tests con fixture real de Open-Meteo (Resuelto en Etapa 4, H6.7)

- **Síntoma:** los 26 tests de Etapa 4 usaban mocks sintéticos que inyectaban campos que la API real no devuelve (con nombres planos, no con sufijo `_modelo`). Si la consensuación se rompía, los tests no lo detectaban.
- **Causa:** los mocks no reflejaban el formato real de Open-Meteo.
- **Fix:** se creó `src/engine/__tests__/fixtures/openmeteo_sample.json` (240 h de datos reales de Pachuca) y se agregaron 7 tests que procesan el fixture real:
  - 3 en `consensusEngine.test.js` (incluye fallback GFS para `freezing_level_height`).
  - 1 en `windEvaluator.test.js`.
  - 1 en `thermalEvaluator.test.js`.
  - 1 en `convectiveEvaluator.test.js` (verifica que GEM null no rompe).
  - 1 en `crossThreatOrchestrator.test.js`.
- **Hallazgo:** los tests detectaron que `consensusEngine` produce array de objetos pero los evaluadores esperan objeto de arrays. La conversión se hace en `crossThreatOrchestrator`. Los tests de los evaluadores ahora replican esa conversión.
- **Verificación:** 123/123 tests, CI en verde.
- **Commits:** `6fdc414` (fixture) + `2b86e47` (tests con conversión).
- **Lección:** documentada como H-TEST-06.

---

## Hito H9 — Cierre Documental de Etapa 3

### H9 — Cierre de Etapa 3
- **Acciones:** actualización de `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `08_ETAPA3_PLAN.md` y `10_HANDOVER.md`.
- **Tag:** `etapa-3-cerrada`.
- **Estado:** ✅ **Etapa 3 completada.**

---

## Hito de Cierre Documental de Etapa 4

### Cierre de Etapa 4 — 22 de octubre de 2026

- **Acciones:** actualización de `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `10_HANDOVER.md` y creación de `HANDOVER_SESION_2026-10-22.md`.
- **Tag:** `etapa-4-cerrada` (en commit `29009fe`).
- **Estado:** ✅ **Etapa 4 completada a nivel funcional (H6.1–H6.7). Deuda aceptada: H6.6 (frontend), H7 (prompts SARA), H-ARCH-01 (extensibilidad del pipeline).**

## Etapa 5 — Integración Multivectorial (H5.0)

### H-ORQ-05 — N1 debe ser SIN_AMENAZA

- **Síntoma:** 114 CONVECTIVO N1 falsos positivos + 35 VIENTO N1, con títulos de vectores que no correspondían al nivel (ej. "CONVECTIVO" en localidad sin amenaza).
- **Causa:** `determinarVectorDominante` elegía un vector por margen ínfimo (1.05 vs 1.00) incluso en N1, donde ningún vector aporta amenaza real.
- **Fix:** si `nivelGlobal === 1`, forzar `vectorDominante = 'SIN_AMENAZA'`.
- **Verificación (22/10/2026):** 142 SIN_AMENAZA en producción, 0 CONVECTIVO N1, 0 VIENTO N1.
- **Commit:** `f9845a6`.

### H-ORQ-06 — Diagnóstico de acoplamiento específico por vector

- **Síntoma:** 30 VIENTO N2 con causa "Vientos Normales" (contradicción nivel N2 vs vector N1) y 11 N3 hidro con "compuesto por acoplamiento (X + otras amenazas)" (verboso).
- **Causa:** el diagnóstico se quedaba con el título del vector dominante, sin reflejar que el nivel subió por acoplamiento con otros vectores.
- **Fix:** cuando `nivelGlobal > floor(nivelDelVectorTop)`:
  - `titulo = "Acoplamiento {vector1} + {vector2} — Nivel {N}"`.
  - `causa = "El nivel {N} se alcanza por acoplamiento entre {vector1} y {vector2}. {causaOriginal}"`.
- **Verificación (22/10/2026):**
  - 11 N3 hidro subido → "Acoplamiento hidrología + viento — Nivel 3". ✅
  - 25 N3 hidro puro → sin cambios. ✅
  - 30 VIENTO N2 → desaparecieron por cambio de clima (viento bajó de 1.99 a 1.93). Pero el test 10 los cubre artificialmente. ✅
- **Commits:** `f9845a6` (test), `85a8013` (fix inicial), `c09d1c6` (Math.floor, intento fallido), `e30c266` (fix final H5.0.2b).

### Nota metodológica

El fix de H5.0.2 requirió 3 iteraciones (H5.0.2 → H5.0.2a con Math.floor → H5.0.2b con vectores específicos). **Lección:** antes de proponer un fix, analizar los datos reales de producción (los 11 casos tenían `hidro=2.94`, no 3.03, lo que el primer fix no consideró). Documentado como H-TEST-08.