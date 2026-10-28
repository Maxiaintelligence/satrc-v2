# SatRC V2.0 — Pendientes, deuda técnica y riesgos

> **Versión del documento:** 2.5 (24/10/2026)
> **Propósito:** registro único de lo que falta, lo que se aceptó como deuda y los riesgos abiertos. Es la única lista vigente. Un ítem cerrado sale de aquí y pasa a `04_HISTORIAL.md`.
> **Regla:** cada ítem tiene identificador, severidad, estado y fuente. Ningún otro documento mantiene una lista paralela.

---

## 1. Riesgos activos

Son problemas en producción o en el repositorio que requieren acción fuera de la documentación. Tienen prioridad sobre cualquier otro ítem.

| ID | Riesgo | Dónde | Acción requerida | Responsable |
|---|---|---|---|---|
| R-03 | `GET /api/sara` devuelve bitácora y evaluaciones sin autenticación | `api/sara.js` | Restringir la respuesta o exigir autenticación. Requiere cambio de código. | Coordinación técnica |


**Estado de la documentación:** los valores de claves y los nombres personales fueron retirados de todos los documentos propuestos. Eso no elimina los valores del historial de Git ni del código; R-01 y R-04 siguen abiertos hasta rotarlos.

**Decisión tomada (22/10/2026):** el repositorio sigue público. Motivos: las corridas automáticas y el despliegue funcionan igual con repositorio privado, pero el presupuesto es cero y el plan gratuito de GitHub cubre 2 000 minutos al mes para repositorios privados. Condiciones: (a) rotar las claves de R-01 antes de publicar cambios de documentación; (b) confirmar que la duración de las corridas de `sara_cron.yml` mantiene el uso por debajo de ese límite; (c) R-02 y R-04 se atienden en código, porque su exposición ya existe en el sitio desplegado independientemente de la visibilidad del repositorio.

---

## 2. Deuda técnica activa

Severidad: 🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja. El esfuerzo es una estimación.

### 2.1 Seguridad y exposición

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| DEU-01 | Credenciales en código fuente (ver R-01 y R-04) | 🔴 | Bajo | Abierta |
| DEU-02 | Bitácora pública en `GET /api/sara` (ver R-03) | 🟠 | Medio | Abierta; aceptada para V3.0 |
| DEU-23 | Token de administración en variable `VITE_` (ver R-02) | 🔴 | Medio | Abierta |
| DEU-21 | Nombres personales de terceros en el código público | 🟡 | Bajo | Documentación saneada; código pendiente |
| H-SEC-01 | El modal de clave de operador no valida la clave antes de enviar la petición al backend. Un atacante con el token `VITE_` puede enumerar claves válidas por respuesta 401. | 🟡 | Bajo | Abierta |

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
| N22/N27 | Causa raíz del doble encoding UTF-8 en `@vercel/blob`. El parche de lectura funciona. | 🟡 | Medio | Abierta, V3.0 | `02` §9 |
| H-SMN-WS | El scraping del SMN depende del HTML de la página oficial, que puede cambiar sin aviso. Migrar al servicio oficial de CONAGUA. | 🟠 | Medio | Abierta | `03` §2.4 |

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
| H-API-02 | `disparar-workflow.js` no registra IP ni agente de usuario de las peticiones. | 🟢 | Bajo | Abierta |
| H-API-05 | `latest-gif.js` no tiene respaldo si NOAA cambia el patrón de nombres. Hay un `catch` que devuelve 502, pero no un respaldo. | 🟢 | Bajo | Abierta |
| DEU-19 | Dependencia de planes gratuitos (Groq, Vercel, Open-Meteo, cron-job.org) sin plan de contingencia. | 🟡 | Medio | Sin documentar |
| DEU-28 | El test de regresión del runner (`regresionMultifactor.test.js`) verifica los imports en código fuente en vez de ejecutar el runner. Requiere refactor (R3) para permitir `dryRun` y test end-to-end. | 🟡 | Medio | Abierta |
| DEU-30 | `normalizarDatosRegionales` cae a `14` con `||` si `zonas_totales` es `0` o inválido, ocultando problemas reales del cliente. | 🟢 | Bajo | Abierta |
| H-CRON-01 | `sara_cron.yml` no tiene un pre-check explícito de `GROQ_API_KEY` y `BLOB_READ_WRITE_TOKEN` antes de ejecutar el runner. Si faltan, el runner falla silenciosamente y usa la plantilla estática. | 🟢 | Bajo | Abierta |
| H-CI-01 | `tests.yml` no corre `npm run build`. Si se rompe un import en un componente React, `npm test` no lo detecta. | 🟢 | Bajo | Abierta |
| H-VERCEL-01 | Timeout de Vercel (Hobby Plan) al generar reportes On-Demand. La función serverless tarda más de 10 segundos (por las llamadas a Groq y Blob) y Vercel la mata, devolviendo un Error 500. | 🟠 | Alto | Abierta; requiere refactor. | Verificación del 27/10/2026 |

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

### 2.7 Motor multifactor (verificación del 22/10/2026)

Detalle y evidencia por línea en `VERIFICACION_MULTIFACTOR.md`. H-MULTI-01 a H-MULTI-05 se cerraron el 22 y 23/10/2026 (commits `6a72bdc`, `5c826cd`, `50ebc53`). Solo queda H-MULTI-06.

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-MULTI-06 | El respaldo en vivo de la Sala Operativa usa solo el motor hidrológico. | 🟡 | Medio | Abierta | Verificación §2.7 |

### 2.8 Calidad del código (verificación del 24/10/2026)

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| DEU-24 | `npm run lint` reporta 51 advertencias y 0 errores. Hay imports y variables sin uso, incluidos `altitud` y `esMarginacionAlta` en `riskEvaluator.js`, y `esModoEmergencia` en `reporte-ondemand.js`. | 🟢 | Bajo | Abierta | Lint local |
| DEU-25 | Código muerto en `reportesRegionales.js`: `TIMEOUT_FETCH_MS` y `STAGGER_MS` sin uso. | 🟡 | Bajo | Abierta | Lint local |

**Resultados confirmados el 24/10/2026:** `npm test` pasa 159 de 159 pruebas en 17 archivos. `npm run build` verde. `node --check api/sara.js` sin errores. Lint: 51 advertencias, 0 errores.

### 2.9 Cierre de H-TERM-01 (24/10/2026)

**H-TERM-01 cerrado** (commit `343f80d`). La fórmula del nivel continuo térmico ahora respeta el contrato `[nivel, nivel+0.99]` documentado en ADR-008. Los tests 9 a 14 de `thermalEvaluator.test.js` cubren los casos de nevada, frío N2/N3, calor N2/N3 y frío+calor simultáneos.

**Pendiente de re-auditoría de invierno:** en la verificación del 24/10/2026, las 405 localidades tenían `niveles_por_vector.termico = 1.0` (no hay frío en octubre). El impacto del fix en el semáforo se medirá en la primera corrida de invierno que dispare el térmico. Si la subida de N3 supera el 30 %, evaluar recalibración del peso (commit B2 separado).

---

## 3. Cerrados recientes

Los siguientes se cerraron y su detalle está en `04_HISTORIAL.md`. No se mantienen aquí.

- **Etapa 3** (H0 a H9): cerrada.
- **Etapa 4** (H6.1 a H6.7): cerrada a nivel funcional. Quedan abiertos H6.6 (ya cerrado), H7 (parcial) y H-ARCH-01 (ver §2).
- **Etapa 5** (H5.0 a H5.8): cerrada.
- **H-MULTI-01..05**: cerrados el 22-23/10/2026 (commits `6a72bdc`, `5c826cd`, `50ebc53`).
- **H-PROMPT-01 y H-PROMPT-02**: cerrados el 22/10/2026 (commits `9fc298a`, `62d1fa3`).
- **H6.6 y H-UI-01, H-UI-03**: cerrados el 24/10/2026 (commits `83d8991`, `955b7aa`). El Monitor Público ya muestra semáforo, desglose por vector y acciones operativas.
- **H-TERM-01**: cerrado el 24/10/2026 (commit `343f80d`).
- **H-VIENTO-01**: cerrado como documental. La especificación original incluía suavizado de 3 h y factor de rugosidad; el código nunca los implementó y el principio "el código es la referencia" (DEC-010) aplica.
- **H-SMN (falso positivo por comunicados de prensa)**: corregido; sigue abierto el riesgo de H-SMN-WS.
- **H-BITACORA-01 y H-REPORTE-01**: cerrados el 24/10/2026 (commit `d3b0c1c`). Se centralizó la creación de entradas de bitácora en `bitacora.js`, se eliminó el `put` duplicado del reporte diario, y se protegió el reporte vigente contra sobrescrituras parciales.
- **H-MOTOR-07 y H-CONV-03**: cerrados el 27/10/2026 (commit `d248fdb`). Se corrigió la lectura del viento en la Regla 1 y se agregó un mínimo de CAPE (1000 J/kg) para Downburst. Esto eliminó 29 falsos positivos en el Altiplano (Apan y Almoloya pasaron de N3 a N1/N2).

---

## 4. Prioridades propuestas

Estas prioridades están propuestas, no aprobadas. Se confirman antes de comenzar el trabajo.

1. **Inmediato (sin código):** rotar claves (R-01) y retirar valores de cualquier documento o archivo. Ya saneado en la documentación.
2. **Corto plazo (requiere código):** R-02 y R-03, luego R-04. Son los riesgos de exposición activa.
3. **Corto plazo (requiere código):** H-BITACORA-01 y H-REPORTE-01 juntos (afectan los mismos archivos y comparten causa raíz). **Próximo commit propuesto.**
4. **Corto plazo (requiere código):** H-MOTOR-07 (Regla 1 del Altiplano lee el campo equivocado). Cambia comportamiento en producción; conviene re-auditar después.
5. **Mediano plazo:** H-CONV-02 (requiere expandir el contrato del consenso), H-SMN-WS (fuente oficial del aviso), H-MULTI-06 (respaldo en vivo), DEU-19 (plan de contingencia).
6. **V3.0:** autenticación real, H-MOTOR-01, H-MOTOR-05, H-ARCH-01, nuevos vectores (incendios) y percentiles históricos.

---

## 5. Reglas para agregar pendientes

1. Un ítem nuevo entra aquí con identificador, severidad, estado y fuente.
2. Un bug resuelto no entra aquí: va a `04_HISTORIAL.md`.
3. Una decisión de diseño no entra aquí: va a `08_DECISIONES.md`.
4. Si un ítem depende de una decisión que no ha tomado la coordinación, se marca "Abierta, decisión de diseño" y no se trabaja sin confirmación.
5. Si un identificador se refiere a un hito de una etapa, se escribe la etapa cuando haya riesgo de confusión (por ejemplo, "E3-H5" frente a "E5-H5.0").