# SatRC V2.0 — Pendientes, deuda técnica y riesgos

> **Versión del documento:** 2.6 (27/10/2026)
> **Propósito:** registro único de lo que falta, lo que se aceptó como deuda y los riesgos abiertos. Es la única lista vigente. Un ítem cerrado sale de aquí y pasa a `04_HISTORIAL.md`.
> **Regla:** cada ítem tiene identificador, severidad, estado y fuente. Ningún otro documento mantiene una lista paralela.

---

## 1. Riesgos activos

Son problemas en producción o en el repositorio que requieren acción fuera de la documentación. Tienen prioridad sobre cualquier otro ítem.

| ID | Riesgo | Dónde | Acción requerida | Responsable |
|---|---|---|---|---|
| R-03 | `GET /api/sara` devuelve bitácora y evaluaciones sin autenticación | `api/sara.js` | Restringir la respuesta o exigir autenticación. Requiere cambio de código. | Coordinación técnica |

**Estado de la documentación:** los valores de claves y los nombres personales fueron retirados de todos los documentos propuestos. Eso no elimina los valores del historial de Git ni del código; sin embargo, las claves fueron rotadas y movidas a variables de entorno el 27/10/2026.

**Decisión tomada (22/10/2026):** el repositorio sigue público. Motivos: las corridas automáticas y el despliegue funcionan igual con repositorio privado, pero el presupuesto es cero y el plan gratuito de GitHub cubre 2 000 minutos al mes para repositorios privados. Condiciones: (a) rotar las claves antes de publicar cambios de documentación; (b) confirmar que la duración de las corridas de `sara_cron.yml` mantiene el uso por debajo de ese límite; (c) la validación de la Sala Operativa y las claves de operador se atienden en código.

---

## 2. Deuda técnica activa

Severidad: 🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja. El esfuerzo es una estimación.

### 2.1 Seguridad y exposición

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| H-SEC-02 | El endpoint `/api/auth-operativo` no tiene rate-limiting (límite de intentos). Un atacante podría intentar adivinar la clave de la Sala Operativa haciendo fuerza bruta. | 🟡 | Medio | Abierta, V3.0 |

### 2.2 Motor y datos

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-ORQ-07 | Coeficientes γ y mapeo a nivel del orquestador distintos de la especificación original. El código es la referencia. | 🟡 | Bajo | Documental | `03` §9 |
| H-CONV-01 | Unidades erróneas en la especificación convectiva (umbrales de 50 000 a 150 000). El código usa 100 y 150. | 🟢 | Bajo | Documental | `03` §7.3 |
| H-CONV-02 | `convectiveEvaluator.js` mide `shearMax` como diferencia escalar de velocidades, sin dirección. Falsos negativos de downburst/supercélula posibles con cambio de dirección. Corregir requiere agregar `wind_direction_10m` y `wind_direction_700hPa` al fetcher y al consenso. | 🟡 | Alto | Abierta | `03` §7.1 |
| H-BITACORA-02 | Concurrencia entre los cuatro escritores de bitácora (`ejecutar_sara_autonomo.mjs`, `reporteDiario.mjs`, `api/reporte-ondemand.js` y `api/sara.js`). Si dos corren al mismo tiempo, el último en hacer `put` pisa la cadena del otro. Requiere un mecanismo de bloqueo optimista o cola (V3.0). | 🟡 | Alto | Abierta | Análisis de H-BITACORA-01 |
| DEU-29 | Parser SMN duplicado entre `api/smn.js` y `scripts/ejecutar_sara_autonomo.mjs`. ~60 líneas idénticas de scraping y clasificación de fenómenos. Viola DRY (ADR-004). Relacionado con H-SMN-WS. | 🟡 | Medio | Abierta | `api/smn.js` |
| H-MOTOR-05 | Sobreclasificación de N2 en zonas húmedas (XIC 61.9 %, HUA 52.4 %, ZAC 45.2 %). Requiere re-auditoría de 90 días. | 🟡 | Alto | Abierta, V3.0 | Etapa 3 |
| H-MOTOR-03 | El reporte diario exige 216 h de serie; el runner usa 192 h. | 🟢 | Bajo | Abierta | `03` §3 |
| H-MOTOR-01 | Gemelo del runner distinto del motor canónico. | 🟡 | Alto | Abierta, V3.0 | `03` §3 |
| H-DIAG-04 | Motor no calibrado para XIC, HUA y ZAC. Se trata junto con H-MOTOR-05. | 🟡 | Alto | Abierta, V3.0 | Etapa 3 |
| H-SMN-WS | El scraping del SMN depende del HTML de la página oficial, que puede cambiar sin aviso. Migrar al servicio oficial de CONAGUA. | 🟠 | Medio | Abierta | `03` §2.4 |
| H-RUNNER-01 | El script `ejecutar_sara_autonomo.mjs` (GitHub Actions) sigue intentando guardar y leer desde Vercel Blob. Debe migrarse al adaptador de Google Drive (`src/lib/compartido/googleDrive.js`) para que el cron autónomo funcione de nuevo. | 🟠 | Medio | Abierta | Migración 27/10/2026 |
| H-ENCODING-01 | El runner sigue guardando cadenas con doble codificación UTF-8. El adaptador de Google Drive no lo repara al leer; se sigue parcheando con `repararObjeto` en la API. | 🟡 | Medio | Abierta, V3.0 | `02` §9 |

### 2.3 Interfaz

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| H-UI-02 | El "Diagnóstico de Situación • Agente SARA" en el Monitor Público usa `if/else` hardcodeado (`lluviaTotalDia >= 20`). No consulta el motor. Atribución engañosa. | 🟡 | Bajo | Abierta |
| H-UI-22 | El disclaimer menciona ECMWF y el gráfico lee un campo `ecmwf` que el motor no consulta. Verificar el origen de ese campo. | 🟡 | Bajo | Pendiente de verificación |
| H-UI-07 | Las secciones I a VI no tienen guardas para contenido vacío. | 🟢 | Bajo | Abierta |
| H-UI-08 | El borde de la sección 0 siempre se muestra en verde. | 🟢 | Bajo | Abierta |
| H-UI-09 | `TextoEnriquecido` no maneja todo el markdown. | 🟢 | Bajo | Abierta |
| H-UI-11 | Estilos de impresión del modal operativo incompletos. | 🟢 | Bajo | Abierta |
| H-UI-13 | El banner del SMN no se actualiza solo. | 🟢 | Bajo | Abierta |
| H-UI-14 | El banner del SMN no tiene respaldo si `/api/smn` falla. | 🟢 | Bajo | Abierta |
| H-UI-23 | `DisclaimerModal` tiene una rama que nunca se ejecuta (`abierto === undefined`). | 🟢 | Bajo | Abierta |

### 2.4 Arquitectura y operación

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| DEU-22 | Constante `TAMANO_LOTE = 4` declarada en tres archivos. | 🟢 | Bajo | Abierta | `02` §4 |
| H-ARCH-01 | Agregar un quinto evaluador exige tocar siete archivos. Propuesta: registro declarativo. | 🟡 | Medio | Abierta, V3.0 | `02` §10 |
| H-INFRA-01 | No existe `vercel.json`; el despliegue usa detección automática. | 🟢 | Bajo | Abierta, V3.0 | `02` §10 |
| H-NOM-01 | `procesar_datos.cjs` escribe `version: "3.0"`, y `package.json` se llama `satrc-v3`. | 🟢 | Bajo | Abierta | Revisión documental |
| H-API-02 | `disparar-workflow.js` no registra IP ni agente de usuario de las peticiones. | 🟢 | Bajo | Abierta | |
| H-API-05 | `latest-gif.js` no tiene respaldo si NOAA cambia el patrón de nombres. Hay un `catch` que devuelve 502, pero no un respaldo. | 🟢 | Bajo | Abierta | |
| DEU-19 | Dependencia de planes gratuitos (Groq, Vercel, Open-Meteo, cron-job.org) sin plan de contingencia. Ahora se suma Google Drive (Apps Script). | 🟡 | Medio | Sin documentar | |
| DEU-28 | El test de regresión del runner (`regresionMultifactor.test.js`) verifica los imports en código fuente en vez de ejecutar el runner. Requiere refactor (R3) para permitir `dryRun` y test end-to-end. | 🟡 | Medio | Abierta | |
| DEU-30 | `normalizarDatosRegionales` cae a `14` con `||` si `zonas_totales` es `0` o inválido, ocultando problemas reales del cliente. | 🟢 | Bajo | Abierta | |
| H-CRON-01 | `sara_cron.yml` no tiene un pre-check explícito de `GROQ_API_KEY`, `GOOGLE_SCRIPT_URL` y `BLOB_READ_WRITE_TOKEN` antes de ejecutar el runner. | 🟢 | Bajo | Abierta | |
| H-CI-01 | `tests.yml` no corre `npm run build`. Si se rompe un import en un componente React, `npm test` no lo detecta. | 🟢 | Bajo | Abierta | |
| H-API-06 | `api/auth-operativo.js` valida la clave contra una variable de entorno (`CLAVE_SALA_OPERATIVA`) sin un sistema de sesiones. Cada petición que requiera autenticación de la Sala debe validar la clave de nuevo. | 🟡 | Medio | Abierta, V3.0 | Migración 27/10/2026 |

### 2.5 Pruebas y calidad

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| DEU-16 | La regla de `node --check` antes del commit no se aplica en CI. | 🟡 | Bajo | Abierta |
| DEU-17 | `tests.yml` solo ejecuta Vitest; no valida `api/` ni `scripts/*.mjs`. | 🟡 | Bajo | Abierta |
| DEU-18 | Conteo de pruebas inconsistente entre documentos. Se resuelve documentando el conteo oficial al ejecutar `npm test`. | 🟢 | Bajo | Documental |
| H-TEST-06 | Las pruebas nuevas deben verificar la aritmética del escenario antes de asumir un error de código. La especificación del adaptador tenía un ejemplo que no cuadraba. | 🟢 | — | Lección |
| H-TEST-07 | Los módulos que emiten valores continuos deben documentar su rango `[mín, máx]`. La deuda de H-TERM-01 vino de no cumplirlo. | 🟡 | — | Lección; H-TERM-01 ya cerrado aplicándola |
| H-TEST-11 | `datos_disponibles_por_vector` no tiene cobertura en `estadoDiocesanoSchema.test.js`. Un campo nuevo en el contrato sin test de valor y rango viola H-TEST-05. | 🟡 | Bajo | Abierta |
| H-ORQ-08 | `determinarVectorDominante()` usa `prioridad.indexOf(a)` sobre un array en mutación durante el `sort`. Funciona por casualidad en V8 moderno, pero es un anti-patrón frágil. | 🟢 | Bajo | Abierta |
| H-SCHEMA-01 | `EstadoDiocesanoBlobSchema` tiene `schema_version` con `.default("2.1.0")`, pero el runner no emite el campo. Si alguien implementa migraciones basadas en ese campo, no funcionará. | 🟢 | Bajo | Abierta |

### 2.6 Prompts de SARA

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-PROMPT-03 | No hay pruebas automáticas de los prompts (campos recibidos y cumplimiento de reglas). | 🟡 | Medio | Abierta | `05` §8 |
| H-PROMPT-04 | El prompt no incluye el aviso de "suspender actividades" si el semáforo está en N1/N2. Se solucionó con una regla temporal (Regla 17) en `api/reporte-ondemand.js`, pero falta consolidarlo en `promptsMultivector.js`. | 🟡 | Bajo | Abierta | Crisis 27/10/2026 |

### 2.7 Motor multifactor

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-MULTI-06 | El respaldo en vivo de la Sala Operativa usa solo el motor hidrológico. | 🟡 | Medio | Abierta | Verificación §2.7 |

### 2.8 Calidad del código (verificación del 27/10/2026)

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| DEU-24 | `npm run lint` reporta 51 advertencias y 0 errores. Hay imports y variables sin uso, incluidos `altitud` y `esMarginacionAlta` en `riskEvaluator.js`, y `esModoEmergencia` en `reporte-ondemand.js`. | 🟢 | Bajo | Abierta | Lint local |
| DEU-25 | Código muerto en `reportesRegionales.js`: `TIMEOUT_FETCH_MS` y `STAGGER_MS` sin uso. | 🟡 | Bajo | Abierta | Lint local |

**Resultados confirmados el 27/10/2026:** `npm test` pasa 167 de 167 pruebas en 17 archivos. `npm run build` verde. `node --check api/sara.js` sin errores. Lint: 51 advertencias, 0 errores.

### 2.9 Re-auditoría de invierno pendiente

En la verificación del 27/10/2026, las 405 localidades tenían `niveles_por_vector.termico = 1.0` (no hay frío en octubre). El impacto del fix de H-TERM-01 en el semáforo se medirá en la primera corrida de invierno que dispare el térmico. Si la subida de N3 supera el 30 %, evaluar recalibración del peso (commit B2 separado).

---

## 3. Cerrados recientes

Los siguientes se cerraron y su detalle está en `04_HISTORIAL.md`. No se mantienen aquí.

- **Etapas 3, 4 y 5:** cerradas.
- **H-MULTI-01..05, H-PROMPT-01, H-PROMPT-02, H6.6, H-UI-01, H-UI-03:** cerrados (2026).
- **H-TERM-01, H-VIENTO-01, H-SMN (falso positivo):** cerrados (24/10/2026).
- **H-BITACORA-01 y H-REPORTE-01:** cerrados el 24/10/2026 (commit `d3b0c1c`).
- **H-MOTOR-07 y H-CONV-03:** cerrados el 27/10/2026 (commit `d248fdb`).
- **R-01, R-02, R-04 y DEU-21:** cerrados el 27/10/2026 (commits `0110708`, `aaea7e6`). Las claves se movieron a `SATRC_OPERADORES_JSON`, la clave de la Sala Operativa se valida en backend, y se eliminó el token `VITE_` expuesto.
- **H-VERCEL-01 (Timeout/Suspensión de Blob):** cerrado el 27/10/2026. Se migró todo el almacenamiento a Google Drive (Apps Script), eliminando los límites de Vercel Hobby y el error 500.
- **N22/N27 (Mojibake en Blob):** cerrado el 27/10/2026. Al migrar a Google Drive, el problema de codificación doble en el Blob desaparece.

---

## 4. Prioridades propuestas

Estas prioridades están propuestas, no aprobadas. Se confirman antes de comenzar el trabajo.

1. **Inmediato (requiere código):** H-RUNNER-01. Migrar `scripts/ejecutar_sara_autonomo.mjs` a Google Drive. Sin esto, el cron autónomo no publicará el estado.
2. **Corto plazo (requiere código):** R-03. Restringir los datos de `/api/sara`.
3. **Corto plazo (requiere código):** H-API-06 y H-SEC-02 (Rate limiting y sesión en la Sala Operativa).
4. **Mediano plazo:** H-CONV-02, H-SMN-WS, H-MULTI-06, DEU-19.
5. **V3.0:** autenticación real, H-MOTOR-01, H-MOTOR-05, H-ARCH-01, nuevos vectores.

---

## 5. Reglas para agregar pendientes

1. Un ítem nuevo entra aquí con identificador, severidad, estado y fuente.
2. Un bug resuelto no entra aquí: va a `04_HISTORIAL.md`.
3. Una decisión de diseño no entra aquí: va a `08_DECISIONES.md`.
4. Si un ítem depende de una decisión que no ha tomado la coordinación, se marca "Abierta, decisión de diseño" y no se trabaja sin confirmación.
5. Si un identificador se refiere a un hito de una etapa, se escribe la etapa cuando haya riesgo de confusión.


---

## 6. Hallazgos de la sesión 28/10/2026 (pendiente de integración)

> **Nota de proceso:** esta sección es un registro temporal de los hallazgos identificados durante la auditoría de documentación y código del 28/10/2026. Los ítems aquí listados deben integrarse en las secciones 1 (riesgos activos) y 2 (deuda técnica) en la siguiente edición detallada. No sustituye la estructura existente; es un acumulador de trabajo.

### 6.1 Deudas nuevas — requieren cambio de código

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| **H-REPORTE-02** | `scripts/reportes/reporteDiario.mjs` sigue usando `@vercel/blob` (`put`, `list`) para escribir el reporte diario. Como `BLOB_READ_WRITE_TOKEN` no está configurado en `sara_cron.yml`, el reporte falla silenciosamente al escribir y el try/catch del runner lo absorbe. Debe migrarse al adaptador `googleDrive.js`. **Reemplaza al mal nombrado H-RUNNER-01.** | 🔴 | Medio | Abierta | Análisis 28/10/2026 (G1, S13, S14, S15, S25, S26) |
| **H-DRIVE-01** | `googleDrive.escribirJSONBlob` devuelve `null` en caso de fallo sin propagar el error. El runner no verifica el valor devuelto y siempre imprime `✅ Publicación exitosa`. Un fallo de Drive (Apps Script devolviendo HTML, timeout, etc.) queda invisible. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 (código de `googleDrive.js` + runner) |
| **H-DRIVE-02** | El runner escribe `estado_ligero.json` sin validarlo con Zod. El paquete ligero puede contener `evaluaciones: null` (cuando no hay N3/N4), lo que dispara el fallback de `sara.js` en días tranquilos. Debe agregarse un `EstadoDiocesanoLigeroSchema`. | 🟠 | Medio | Abierta | Análisis 28/10/2026 (S16, S17, S18) |
| **H-SARA-01** | El fallback de `api/sara.js` produce `"SITUACION_NORMAL"` + `"Situación Diocesana de Calma"` cuando `req.body` está vacío (que es siempre, porque es GET). Viola DEC-011 (precisión sobre cobertura): en un día con emergencia real, si el archivo de Drive falla, el sistema diría "Calma". | 🔴 | Medio | Abierta | Análisis 28/10/2026 (A6 + código `sara.js`) |
| **H-SARA-02** | `estado_ligero.json` con `evaluaciones: null` dispara el fallback de `sara.js` **todos los días tranquilos**. Consecuencia: el endpoint devuelve `RESPUESTA_EN_VIVO` en lugar de `GOOGLE_DRIVE_ACTUALIZADO` la mayor parte del tiempo. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 (S16 + código `sara.js`) |
| **H-SARA-03** | El fallback de `sara.js` **escribe la bitácora en cada lectura** con `origen_evento: "PROGRAMADO_CRON"` (falso). Cada usuario que refresca el monitor poluciona la bitácora con entradas falsas. | 🔴 | Medio | Abierta | Análisis 28/10/2026 (código `sara.js`) |
| **H-SARA-04** | El fallback de `sara.js` **llama a Groq en cada lectura**. Cada usuario × cada refresco consume cuota de Groq con `TIMEOUT_GROQ_MS = 10000`. Explica los 429 y los timeouts de Vercel documentados en `05_PROMPT_SARA.md` §7. | 🔴 | Medio | Abierta | Análisis 28/10/2026 (código `sara.js`) |
| **H-SARA-05** | `bitacoraLeida = true` en el `else` de `sara.js`: si `leerJSONBlob` falla transitoriamente, el código marca la bitácora como "leída" y **sobrescribe la cadena con historial vacío**. Rompe el `prev_hash` de toda la cadena posterior. Variante del mismo patrón de H-BITACORA-01. | 🟠 | Medio | Abierta | Análisis 28/10/2026 (código `sara.js`) |
| **H-ONDEMAND-01** | `tokenConsolaValido()` en `reporte-ondemand.js`: `if (!esperado) return true`. Si alguien configura `SARA_ONDEMAND_TOKEN` en Vercel, el endpoint **rompe todos los reportes on-demand** porque el frontend nunca lo envía. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 (código `reporte-ondemand.js`) |
| **H-ONDEMAND-03** | `escribirJSONBlob('reporte_diocesano_vigente.json')` no verifica el retorno. `guardadoEnBlob = true` se asigna siempre, incluso si Drive falló. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-04** | `escribirJSONBlob('bitacora_sara.json')` no verifica el retorno. Devuelve `bitacora_actualizada` como si hubiera guardado. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-05** | `TIMEOUT_GROQ_MS = 8000` es demasiado alto. Con 2 reads + 1 Groq (8s) + 2 writes a Drive, se supera fácilmente el timeout de 10s de Vercel Hobby. Debe bajarse a 6000 o dividir la operación. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-06** | `max_completion_tokens: 2500` en el on-demand (vs. 4096 en el diario) puede cortar el JSON en reportes complejos. Debe unificarse a 4096. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-07** | `esParcialReal` se calcula del payload del cliente. El backend confía en el frontend para decidir si un reporte es parcial o completo. Si un cliente envía `zonas_ok: 14` con 5 zonas reales, se guarda como completo. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-08** | Si falla `leerJSONBlob('bitacora_sara.json')`, `bitacoraHistorial = []` y `hashUltimo = BLOQUE_GENESIS` → **reinicia la cadena SHA-256**. Mismo patrón que H-SARA-05. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-09** | Si escribe el reporte OK pero falla la bitácora, hay inconsistencia (reporte vigente sin entrada de auditoría). No hay rollback. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-DRY-01** | `generarHashSHA256` + `siguienteIdBitacora` reimplementados en 3 archivos (`api/sara.js`, `api/reporte-ondemand.js`, `scripts/ejecutar_sara_autonomo.mjs`) en lugar de importar `calcularNuevaEntradaBitacora` de `src/lib/compartido/bitacora.js`. Viola ADR-004. | 🟡 | Medio | Abierta | Análisis 28/10/2026 (D12 + código) |
| **H-VIENTO-02** | Inconsistencia de contrato entre evaluadores: el hidrológico expone `diagnostico.tipoAmenaza` (camelCase, anidado) mientras viento, térmico y convectivo exponen `vector_dominante` (snake_case, top-level). El orquestador maneja ambos casos y funciona, pero el contrato no es uniforme. | 🟢 | Bajo | Abierta, V3.0 | Análisis 28/10/2026 (T10, T12, T13, T14, T17) |

### 6.2 Reclasificaciones bajo DEC-011 (precisión sobre cobertura)

| ID | Deuda | Sev. anterior | Sev. nueva | Justificación |
|---|---|---|---|---|
| **H-MOTOR-05** | Sobreclasificación de N2 en zonas húmedas (XIC 61.9 %, HUA 52.4 %, ZAC 45.2 %) | 🟡 Media | 🔴 **Crítica** | Bajo DEC-011, los falsos positivos conocidos son la máxima prioridad. Este ítem genera exactamente el tipo de ruido que el nuevo principio busca eliminar. |
| **H-DIAG-04** | Motor no calibrado para XIC, HUA y ZAC | 🟡 Media | 🔴 **Crítica** | Misma causa raíz que H-MOTOR-05. Se tratan juntos. |

### 6.3 Ítems a eliminar de la lista (ya cerrados)

| ID | Motivo del cierre | Estado actual |
|---|---|---|
| **H6.6** | Monitor Público **ya consume** `niveles_por_vector` y `acciones_operativas` del orquestador. Verificado por T14 (28/10/2026). Ya está registrado como cerrado en §3 "Cerrados recientes" (L127), pero §2.4 lo tenía como deuda en versiones anteriores. La edición detallada debe eliminar cualquier residuo. | **Cerrado** |
| **H-RUNNER-01** | Renombrado a **H-REPORTE-02**. El runner (`ejecutar_sara_autonomo.mjs`) **ya usa Drive**. El que sigue usando Blob es `reporteDiario.mjs`. El nombre anterior era engañoso. | **Renombrado** |
| **H-VERCEL-01** | Ya está en §3 "Cerrados recientes". Sin cambios. | **Cerrado (27/10/2026)** |

### 6.4 Reformulaciones de ítems existentes

| ID | Redacción actual | Redacción propuesta |
|---|---|---|
| **H-UI-02** | *"El 'Diagnóstico de Situación • Agente SARA' en el Monitor Público usa `if/else` hardcodeado..."* | *"El bloque **'Síntesis de Situación Comunitaria'** (componente separado del semáforo principal, en `MonitorPublico.jsx` L457-477) sigue usando `if/else` con `lluviaTotalDia >= 20`. **El semáforo principal (N1-N4) y el desglose por vector ya consumen el motor (H6.6 cerrado)**; lo que queda es el texto secundario. H-UI-02 queda **parcialmente cerrado**."* |
| **H-CRON-01** | *"...no tiene un pre-check explícito de `GROQ_API_KEY`, `GOOGLE_SCRIPT_URL` y `BLOB_READ_WRITE_TOKEN`..."* | *"...no tiene un pre-check explícito de `GROQ_API_KEY` y `GOOGLE_SCRIPT_URL` antes de ejecutar el runner. **`BLOB_READ_WRITE_TOKEN` ya no aplica**: el runner migró a Drive; el token solo lo consume `reporteDiario.mjs` (ver H-REPORTE-02)."* |

### 6.5 Deudas documentales detectadas

| ID | Deuda | Sev. | Fuente |
|---|---|---|---|
| **H-DOC-HVIENTO-01** | **H-VIENTO-01** está declarado cerrado en `03_MOTOR_RIESGO.md` (3 menciones) y en `06_PENDIENTES.md` §3, pero **no aparece en `04_HISTORIAL.md`**. Falta el registro formal del cierre con síntoma, causa y verificación. | 🟢 | Análisis 28/10/2026 (T5, T5b) |
| **H-DOC-H6.6** | `04_HISTORIAL.md` L188 y L403 mencionan H6.6 como "abierto" en dos notas históricas, mientras `06_PENDIENTES.md` L127 y `02_ARQUITECTURA.md` §3.1 lo declaran cerrado. **Inconsistencia cruzada de docs**. Verificado por T14 que H6.6 está cerrado en código. | 🟠 | Análisis 28/10/2026 (T5b + T14) |
| **H-DOC-REF-02** | `03_MOTOR_RIESGO.md` L352 referenciaba `02_ARQUITECTURA.md §8`, que no existía tras el commit `cd68564`. Ya resuelto en el bloque 2.6 de `02` (restaura §8) y en el bloque 2.7 de `03`. Verificar en `03` aplicado. | 🟢 | Análisis 28/10/2026 (T5, T16, T19) |
| **H-DOC-MOJI-02** | El documento `02_ARQUITECTURA.md` y `03_MOTOR_RIESGO.md` tenían mojibake UTF-8 (`Ã³`, `Ã¡`, `Ã`). Corregido en los bloques 2.6 y 2.7. Aplicar en la edición final. | 🟢 | Análisis 28/10/2026 (S1, S2, T17, T9) |

### 6.6 Prioridades actualizadas (propuesta)

> **Nota:** estas prioridades son una propuesta en revisión. Se confirman antes de ejecutar trabajo. Sustituirán a la sección 4 en la siguiente edición detallada.

1. **Inmediato (requiere código):** **H-REPORTE-02** (ex H-RUNNER-01). Migrar `reporteDiario.mjs` a `googleDrive.js`. Sin esto, el reporte diario nunca se guarda.
2. **Inmediato (requiere código):** **H-DRIVE-01 + H-DRIVE-02 + H-SARA-02**. El fallback actual miente en días tranquilos y oculta fallos de Drive. Bajo DEC-011 es crítico.
3. **Inmediato (requiere código):** **H-SARA-03 + H-SARA-04**. Detener la polución de bitácora y el consumo de Groq desde lecturas HTTP.
4. **Corto plazo:** R-03 (auth en `/api/sara`), **H-SARA-01** (fallback no debe mentir con "Calma").
5. **Corto plazo:** **H-ONDEMAND-01, H-ONDEMAND-05, H-ONDEMAND-06**. Estabilizar reporte on-demand.
6. **Corto plazo:** **H-MOTOR-05 + H-DIAG-04** (críticas bajo DEC-011). Re-auditoría de calibración en zonas húmedas.
7. **Mediano plazo:** **H-DRY-01, H-SARA-05, H-ONDEMAND-03/04/07/08/09**. Consolidar la bitácora y las validaciones de Drive.
8. **Mediano plazo:** H-CONV-02, H-SMN-WS, H-MULTI-06, DEU-19.
9. **V3.0:** autenticación real, H-MOTOR-01, H-ARCH-01, **H-VIENTO-02**, nuevos vectores.