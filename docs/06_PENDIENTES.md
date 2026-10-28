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