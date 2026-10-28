# SatRC V2.0 — Pendientes, deuda técnica y riesgos

> **Versión del documento:** 2.7 (28/10/2026)
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
| **H-MOTOR-05** | **Sobreclasificación de N2 en zonas húmedas (XIC 61.9 %, HUA 52.4 %, ZAC 45.2 %).** Bajo DEC-011, los falsos positivos conocidos son la máxima prioridad. Requiere re-auditoría de 90 días. | 🔴 | Alto | Abierta, V3.0 | Etapa 3 |
| **H-DIAG-04** | **Motor no calibrado para XIC, HUA y ZAC.** Misma causa raíz que H-MOTOR-05. Se tratan juntos. | 🔴 | Alto | Abierta, V3.0 | Etapa 3 |
| H-SMN-WS | El scraping del SMN depende del HTML de la página oficial, que puede cambiar sin aviso. Migrar al servicio oficial de CONAGUA. | 🟠 | Medio | Abierta | `03` §2.4 |
| H-BITACORA-02 | Concurrencia entre los cuatro escritores de bitácora (`ejecutar_sara_autonomo.mjs`, `reporteDiario.mjs`, `api/reporte-ondemand.js` y `api/sara.js`). Si dos corren al mismo tiempo, el último en hacer `put` pisa la cadena del otro. Requiere un mecanismo de bloqueo optimista o cola (V3.0). | 🟡 | Alto | Abierta | Análisis de H-BITACORA-01 |
| H-CONV-02 | `convectiveEvaluator.js` mide `shearMax` como diferencia escalar de velocidades, sin dirección. Falsos negativos de downburst/supercélula posibles con cambio de dirección. Corregir requiere agregar `wind_direction_10m` y `wind_direction_700hPa` al fetcher y al consenso. | 🟡 | Alto | Abierta | `03` §7.1 |
| H-ENCODING-01 | El runner sigue guardando cadenas con doble codificación UTF-8. El adaptador de Google Drive no lo repara al leer; se sigue parcheando con `repararObjeto` en la API. | 🟡 | Medio | Abierta, V3.0 | `02` §9 |
| DEU-29 | Parser SMN duplicado entre `api/smn.js` y `scripts/ejecutar_sara_autonomo.mjs`. ~60 líneas idénticas de scraping y clasificación de fenómenos. Viola DRY (ADR-004). Relacionado con H-SMN-WS. | 🟡 | Medio | Abierta | `api/smn.js` |
| H-MOTOR-01 | Gemelo del runner distinto del motor canónico. | 🟡 | Alto | Abierta, V3.0 | `03` §3 |
| H-ORQ-07 | Coeficientes γ y mapeo a nivel del orquestador distintos de la especificación original. El código es la referencia. | 🟡 | Bajo | Documental | `03` §9 |
| H-MOTOR-03 | El reporte diario exige 216 h de serie; el runner usa 192 h. | 🟢 | Bajo | Abierta | `03` §3 |
| H-CONV-01 | Unidades erróneas en la especificación convectiva (umbrales de 50 000 a 150 000). El código usa 100 y 150. | 🟢 | Bajo | Documental | `03` §7.3 |
| **H-VIENTO-02** | Inconsistencia de contrato entre evaluadores: el hidrológico expone `diagnostico.tipoAmenaza` (camelCase, anidado) mientras viento, térmico y convectivo exponen `vector_dominante` (snake_case, top-level). El orquestador maneja ambos casos y funciona, pero el contrato no es uniforme. | 🟢 | Bajo | Abierta, V3.0 | Análisis 28/10/2026 |

### 2.3 Interfaz

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| H-UI-22 | El disclaimer menciona ECMWF y el gráfico lee un campo `ecmwf` que el motor no consulta. Verificar el origen de ese campo. | 🟡 | Bajo | Pendiente de verificación |
| **H-UI-02** | **Parcialmente cerrado.** El bloque 'Síntesis de Situación Comunitaria' (componente separado del semáforo principal, en `MonitorPublico.jsx` L457-477) sigue usando `if/else` con `lluviaTotalDia >= 20`. El semáforo principal (N1-N4) y el desglose por vector ya consumen el motor (H6.6 cerrado); lo que queda es el texto secundario. | 🟡 | Bajo | Abierta (parcial) |
| H-UI-07 | Las secciones I a VI no tienen guardas para contenido vacío. | 🟢 | Bajo | Abierta |
| H-UI-08 | El borde de la sección 0 siempre se muestra en verde. | 🟢 | Bajo | Abierta |
| H-UI-09 | `TextoEnriquecido` no maneja todo el markdown. | 🟢 | Bajo | Abierta |
| H-UI-11 | Estilos de impresión del modal operativo incompletos. | 🟢 | Bajo | Abierta |
| H-UI-13 | El banner del SMN no se actualiza solo. | 🟢 | Bajo | Abierta |
| H-UI-14 | El banner del SMN no tiene respaldo si `/api/smn` falla. | 🟢 | Bajo | Abierta |
| H-UI-23 | `DisclaimerModal` tiene una rama que nunca se ejecuta (`abierto === undefined`). | 🟢 | Bajo | Abierta |

### 2.4 Arquitectura, operación y almacenamiento

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| **H-REPORTE-02** | `scripts/reportes/reporteDiario.mjs` sigue usando `@vercel/blob` (`put`, `list`) para escribir el reporte diario. Como `BLOB_READ_WRITE_TOKEN` no está configurado en `sara_cron.yml`, el reporte falla silenciosamente al escribir y el try/catch del runner lo absorbe. Debe migrarse al adaptador `googleDrive.js`. **(Reemplaza al mal nombrado H-RUNNER-01).** | 🔴 | Medio | Abierta | Análisis 28/10/2026 |
| **H-DRIVE-01** | `googleDrive.escribirJSONBlob` devuelve `null` en caso de fallo sin propagar el error. El runner no verifica el valor devuelto y siempre imprime `✅ Publicación exitosa`. Un fallo de Drive (Apps Script devolviendo HTML, timeout, etc.) queda invisible. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-DRIVE-05** | Vercel recibe HTTP 401 al intentar escribir en Drive (Apps Script). Ocurre porque Node.js hace un POST con `Content-Type: application/json` y Google responde con un redirect 302 que rompe la autenticación. Solución: cambiar el `Content-Type` a `text/plain` en el adaptador `googleDrive.js` para evitar el preflight/redirect. | 🔴 | Bajo | Abierta | Logs de Vercel 28/10/2026 |
| **H-DRIVE-04** | `googleDrive.js` no valida el formato de `GOOGLE_SCRIPT_URL`. Si el usuario ingresa una URL redirigida (`script.googleusercontent.com`) en lugar de la canónica (`script.google.com/macros/s/.../exec`), las peticiones fallan silenciosamente. Debe lanzar un error claro al inicio si la URL no cumple el patrón. | 🟠 | Bajo | Abierta | Incidente 28/10/2026 |
| **H-ONDEMAND-01** | `tokenConsolaValido()` en `reporte-ondemand.js`: `if (!esperado) return true`. Si alguien configura `SARA_ONDEMAND_TOKEN` en Vercel, el endpoint **rompe todos los reportes on-demand** porque el frontend nunca lo envía. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-05** | `TIMEOUT_GROQ_MS = 8000` es demasiado alto. Con 2 reads + 1 Groq (8s) + 2 writes a Drive, se supera fácilmente el timeout de 10s de Vercel Hobby. Debe bajarse a 6000 o dividir la operación. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-SARA-01** | El fallback de `api/sara.js` produce `"SITUACION_NORMAL"` + `"Situación Diocesana de Calma"` cuando `req.body` está vacío (que es siempre, porque es GET). Viola DEC-011: en un día con emergencia real, si el archivo de Drive falla, el sistema diría "Calma". | 🔴 | Medio | Abierta | Análisis 28/10/2026 |
| **H-SARA-03** | El fallback de `sara.js` **escribe la bitácora en cada lectura** con `origen_evento: "PROGRAMADO_CRON"` (falso). Cada usuario que refresca el monitor poluciona la bitácora con entradas falsas. | 🔴 | Medio | Abierta | Análisis 28/10/2026 |
| **H-SARA-04** | El fallback de `sara.js` **llama a Groq en cada lectura**. Cada usuario × cada refresco consume cuota de Groq con `TIMEOUT_GROQ_MS = 10000`. Explica los 429 y los timeouts de Vercel. | 🔴 | Medio | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-03** | `escribirJSONBlob('reporte_diocesano_vigente.json')` no verifica el retorno. `guardadoEnBlob = true` se asigna siempre, incluso si Drive falló. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-DRIVE-02** | El runner escribe `estado_ligero.json` sin validarlo con Zod. El paquete ligero puede contener `evaluaciones: []` o `null`. Debe agregarse un `EstadoDiocesanoLigeroSchema`. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-SARA-05** | `bitacoraLeida = true` en el `else` de `sara.js`: si `leerJSONBlob` falla transitoriamente, el código marca la bitácora como "leída" y **sobrescribe la cadena con historial vacío**. Rompe el `prev_hash`. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-04** | `escribirJSONBlob('bitacora_sara.json')` no verifica el retorno. Devuelve `bitacora_actualizada` como si hubiera guardado. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-06** | `max_completion_tokens: 2500` en el on-demand (vs. 4096 en el diario) puede cortar el JSON en reportes complejos. Debe unificarse a 4096. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-07** | `esParcialReal` se calcula del payload del cliente. El backend confía en el frontend. Si un cliente envía `zonas_ok: 14` con 5 zonas reales, se guarda como completo. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-08** | Si falla `leerJSONBlob('bitacora_sara.json')`, `bitacoraHistorial = []` y `hashUltimo = BLOQUE_GENESIS` → **reinicia la cadena SHA-256**. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-09** | Si escribe el reporte OK pero falla la bitácora, hay inconsistencia. No hay rollback. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-DRY-01** | `generarHashSHA256` + `siguienteIdBitacora` reimplementados en 3 archivos en lugar de importar `calcularNuevaEntradaBitacora`. Viola ADR-004. | 🟡 | Medio | Abierta | Análisis 28/10/2026 |
| **H-API-06** | `api/auth-operativo.js` valida la clave contra una variable de entorno sin un sistema de sesiones. Cada petición que requiera autenticación de la Sala debe validar la clave de nuevo. | 🟡 | Medio | Abierta, V3.0 | Migración 27/10/2026 |
| H-ARCH-01 | Agregar un quinto evaluador exige tocar siete archivos. Propuesta: registro declarativo. | 🟡 | Medio | Abierta, V3.0 | `02` §10 |
| DEU-19 | Dependencia de planes gratuitos (Groq, Vercel, Open-Meteo, cron-job.org) sin plan de contingencia. Ahora se suma Google Drive (Apps Script). | 🟡 | Medio | Sin documentar | |
| DEU-28 | El test de regresión del runner verifica imports en código fuente en vez de ejecutarlo. Requiere refactor para permitir `dryRun`. | 🟡 | Medio | Abierta | |
| DEU-22 | Constante `TAMANO_LOTE = 4` declarada en tres archivos. | 🟢 | Bajo | Abierta | `02` §4 |
| H-INFRA-01 | No existe `vercel.json`; el despliegue usa detección automática. | 🟢 | Bajo | Abierta, V3.0 | `02` §10 |
| H-NOM-01 | `procesar_datos.cjs` escribe `version: "3.0"`, y `package.json` se llama `satrc-v3`. | 🟢 | Bajo | Abierta | Revisión documental |
| H-API-02 | `disparar-workflow.js` no registra IP ni agente de usuario de las peticiones. | 🟢 | Bajo | Abierta | |
| H-API-05 | `latest-gif.js` no tiene respaldo si NOAA cambia el patrón de nombres. | 🟢 | Bajo | Abierta | |
| DEU-30 | `normalizarDatosRegionales` cae a `14` con `||` si `zonas_totales` es `0`, ocultando problemas reales. | 🟢 | Bajo | Abierta | |
| **H-CRON-01** | `sara_cron.yml` no tiene un pre-check explícito de `GROQ_API_KEY` y `GOOGLE_SCRIPT_URL` antes de ejecutar el runner. **`BLOB_READ_WRITE_TOKEN` ya no aplica** (el runner migró a Drive). | 🟢 | Bajo | Abierta | |
| H-CI-01 | `tests.yml` no corre `npm run build`. Si se rompe un import en un componente React, `npm test` no lo detecta. | 🟢 | Bajo | Abierta | |

### 2.5 Pruebas y calidad

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| DEU-16 | La regla de `node --check` antes del commit no se aplica en CI. | 🟡 | Bajo | Abierta |
| DEU-17 | `tests.yml` solo ejecuta Vitest; no valida `api/` ni `scripts/*.mjs`. | 🟡 | Bajo | Abierta |
| H-TEST-07 | Los módulos que emiten valores continuos deben documentar su rango `[mín, máx]`. La deuda de H-TERM-01 vino de no cumplirlo. | 🟡 | — | Lección; H-TERM-01 ya cerrado aplicándola |
| H-TEST-11 | `datos_disponibles_por_vector` no tiene cobertura en `estadoDiocesanoSchema.test.js`. | 🟡 | Bajo | Abierta |
| DEU-18 | Conteo de pruebas inconsistente entre documentos. Se resuelve documentando el conteo oficial al ejecutar `npm test`. | 🟢 | Bajo | Documental |
| H-TEST-06 | Las pruebas nuevas deben verificar la aritmética del escenario antes de asumir un error de código. | 🟢 | — | Lección |
| H-ORQ-08 | `determinarVectorDominante()` usa `prioridad.indexOf(a)` sobre un array en mutación durante el `sort`. Anti-patrón frágil. | 🟢 | Bajo | Abierta |
| H-SCHEMA-01 | `EstadoDiocesanoBlobSchema` tiene `schema_version` con `.default("2.1.0")`, pero el runner no emite el campo. | 🟢 | Bajo | Abierta |

### 2.6 Prompts de SARA

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| **H-PROMPT-06** | El `systemPrompt` del diario **no tiene la regla de control de emergencias**. Bajo DEC-011, es crítico: el diario podría generar lenguaje de emergencia cuando el motor indica N1/N2. | 🔴 | Medio | Abierta | Análisis 28/10/2026 |
| **H-PROMPT-09** | El `systemPrompt` del on-demand **no tiene la regla 12.bis** (coherencia Sección 0 ↔ Sección II). Riesgo de reintroducir el bug N29. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-PROMPT-05** | El dictamen del runner llama a Groq sin `max_completion_tokens`. Puede devolver JSON truncado o timeouts. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-PROMPT-08** | `promptsMultivector.js` implementa solo R17. Faltan R18 (acciones operativas), R19 (Sección V condicional), R20 (subtipos). | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-PROMPT-10** | R17 no menciona `acciones_operativas`. El modelo recibe las acciones pero no tiene instrucción de usarlas. Parte de H-PROMPT-08. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| H-PROMPT-03 | No hay pruebas automáticas de los prompts (campos recibidos y cumplimiento de reglas). | 🟡 | Medio | Abierta | `05` §8 |
| **H-PROMPT-07** | La regla 10 del prompt (`<40 / 40-59 / ≥60`) usa umbrales más bajos que el motor (`45/65/90 +5 altitud`). Desfase de 5 a 30 km/h. | 🟢 | Bajo | Abierta | Análisis 28/10/2026 |
| H-PROMPT-04 | El prompt no incluye el aviso de "suspender actividades" si el semáforo está en N1/N2. Se solucionó con una regla temporal (Regla 17) en `api/reporte-ondemand.js`, pero falta consolidarlo en `promptsMultivector.js`. | 🟡 | Bajo | Abierta | Crisis 27/10/2026 |

### 2.7 Motor multifactor

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-MULTI-06 | El respaldo en vivo de la Sala Operativa usa solo el motor hidrológico. | 🟡 | Medio | Abierta | Verificación §2.7 |

### 2.8 Calidad del código (verificación del 28/10/2026)

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| DEU-24 | `npm run lint` reporta 47 advertencias y 0 errores. Hay imports y variables sin uso, incluidos `altitud` y `esMarginacionAlta` en `riskEvaluator.js`, y `esModoEmergencia` en `reporte-ondemand.js`. | 🟢 | Bajo | Abierta | Lint local |
| DEU-25 | Código muerto en `reportesRegionales.js`: `TIMEOUT_FETCH_MS` y `STAGGER_MS` sin uso. | 🟡 | Bajo | Abierta | Lint local |

### 2.9 Deudas documentales

| ID | Deuda | Sev. | Estado | Fuente |
|---|---|---|---|---|
| H-DOC-HVIENTO-01 | **H-VIENTO-01** está declarado cerrado en `03_MOTOR_RIESGO.md` y en `06_PENDIENTES.md` §3, pero **no aparece en `04_HISTORIAL.md`**. Falta el registro formal del cierre. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-H6.6 | `04_HISTORIAL.md` L188 y L403 mencionan H6.6 como "abierto" en dos notas históricas, mientras `06_PENDIENTES.md` y `02_ARQUITECTURA.md` §3.1 lo declaran cerrado. Inconsistencia cruzada. | 🟠 | Abierta | Análisis 28/10/2026 |
| H-DOC-REF-02 | `03_MOTOR_RIESGO.md` L352 referenciaba `02_ARQUITECTURA.md §8`, que no existía tras el commit `cd68564`. Ya resuelto en los bloques 2.6 de `02` y 2.7 de `03`. | 🟢 | Cerrado | Análisis 28/10/2026 |
| H-DOC-MOJI-02 | Posible mojibake en `02` y `03`. **Probablemente falso positivo de PowerShell** (UTF-8 mal decodificado en consola). Verificar en editor UTF-8. | 🟢 | Pendiente de verificar | Análisis 28/10/2026 |
| H-DOC-GIT-01 | `salida_lint.txt` y `salida_npm_test.txt` no están en `.gitignore`. | 🟡 | Abierta | Análisis 28/10/2026 |
| H-DOC-ASSETS-01 | `src/assets/` contiene 3 archivos sin referencias en el código (`hero.png`, `react.svg`, `vite.svg`). Residuos de Vite. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-TEST-01 | Carpetas vacías: `src/lib/__tests__/` y `test/`. Purgar o poblar. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-PS1-01 | `scripts/diagnostico/*.ps1` son 10 scripts de diagnóstico histórico. Decidir si archivar o eliminar. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-EXT-01 | `12_E4_THERMAL_EVALUATOR.MD` tiene extensión en mayúsculas. Renombrar a `.md`. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-README-01 | `README.md` menciona los docs `00`-`08` pero no `09` ni `VERIFICACION_MULTIFACTOR.md`. Tiene mojibake pendiente. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-PUBLIC-01 | `public/` (manifest, service worker, íconos PWA) no estaba documentado en el doc 09 v1.0. Ya agregado en v2.0. | 🟢 | Cerrado | Análisis 28/10/2026 |
| H-DOC-DIAGEXT-01 | `diagnostico_externo/` no estaba documentado en el doc 09 v1.0. Ya agregado en v2.0. | 🟢 | Cerrado | Análisis 28/10/2026 |

### 2.10 Re-auditoría de invierno pendiente

En la verificación del 27/10/2026, las 405 localidades tenían `niveles_por_vector.termico = 1.0` (no hay frío en octubre). El impacto del fix de H-TERM-01 en el semáforo se medirá en la primera corrida de invierno que dispare el térmico. Si la subida de N3 supera el 30 %, evaluar recalibración del peso (commit B2 separado).

---

## 3. Cerrados recientes

Los siguientes se cerraron y su detalle está en `04_HISTORIAL.md`. No se mantienen aquí.

- **Etapas 3, 4 y 5:** cerradas.
- **H-MULTI-01..05, H-PROMPT-01, H-PROMPT-02, H6.6, H-UI-01, H-UI-03:** cerrados (2026).
- **H-TERM-01, H-VIENTO-01, H-SMN (falso positivo):** cerrados (24/10/2026).
- **H-BITACORA-01 y H-REPORTE-01:** cerrados el 24/10/2026 (commit `d3b0c1c`).
- **H-MOTOR-07 y H-CONV-03:** cerrados el 27/10/2026 (commit `d248fdb`).
- **R-01, R-02, R-04 y DEU-21:** cerrados el 27/10/2026 (commits `0110708`, `aaea7e6`).
- **H-VERCEL-01 (Timeout/Suspensión de Blob):** cerrado el 27/10/2026. Se migró todo el almacenamiento a Google Drive (Apps Script).
- **N22/N27 (Mojibake en Blob):** cerrado el 27/10/2026. Al migrar a Google Drive, el problema de codificación doble en el Blob desaparece.
- **H-RUNNER-01:** Renombrado a **H-REPORTE-02**. El runner ya usa Drive; el que falla es `reporteDiario.mjs`.
- **H-SARA-02:** Cerrado el 28/10/2026 (commit `2a3e3e8`). El runner ya no envía `evaluaciones: null` en días tranquilos, envía `[]`.
- **H-DRIVE-02 (Zod schema):** Cerrado el 28/10/2026 (commit `3053e29`). El esquema Zod acepta arreglos vacíos en días tranquilos.
- **Incidente de producción 28/10/2026:** Cerrado. Causa raíz: URL de Vercel mal copiada + Zod estricto + runner enviando null. Resuelto. Detalle en `VERIFICACION_MULTIFACTOR.md`.

---

## 4. Prioridades propuestas

Estas prioridades están propuestas, no aprobadas. Se confirman antes de comenzar el trabajo.

1. **Inmediato (requiere código):** **H-REPORTE-02**. Migrar `reporteDiario.mjs` a `googleDrive.js`. Sin esto, el reporte diario nunca se guarda.
2. **Inmediato (requiere código):** **H-DRIVE-01 + H-DRIVE-05**. El adaptador de Drive silencia errores y falla con 401 al escribir desde Vercel. Es crítico para la integridad de la bitácora.
3. **Inmediato (requiere código):** **H-SARA-01 + H-SARA-03 + H-SARA-04**. El fallback actual miente en días tranquilos, poluciona la bitácora y consume Groq.
4. **Corto plazo:** R-03 (auth en `/api/sara`).
5. **Corto plazo:** **H-ONDEMAND-01, H-ONDEMAND-05, H-ONDEMAND-06**. Estabilizar reporte on-demand.
6. **Corto plazo:** **H-MOTOR-05 + H-DIAG-04** (críticas bajo DEC-011). Re-auditoría de calibración en zonas húmedas.
7. **Mediano plazo:** **H-DRY-01, H-SARA-05, H-ONDEMAND-03/04/07/08/09**. Consolidar la bitácora y las validaciones de Drive.
8. **Mediano plazo:** H-CONV-02, H-SMN-WS, H-MULTI-06, DEU-19.
9. **V3.0:** autenticación real, H-MOTOR-01, H-ARCH-01, **H-VIENTO-02**, nuevos vectores.

---

## 5. Reglas para agregar pendientes

1. Un ítem nuevo entra aquí con identificador, severidad, estado y fuente.
2. Un bug resuelto no entra aquí: va a `04_HISTORIAL.md`.
3. Una decisión de diseño no entra aquí: va a `08_DECISIONES.md`.
4. Si un ítem depende de una decisión que no ha tomado la coordinación, se marca "Abierta, decisión de diseño" y no se trabaja sin confirmación.
5. Si un identificador se refiere a un hito de una etapa, se escribe la etapa cuando haya riesgo de confusión.