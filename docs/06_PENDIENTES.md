# SatRC V2.0 — Pendientes, deuda técnica y riesgos

> **Versión del documento:** 2.4 (22/10/2026)
> **Propósito:** registro único de lo que falta, lo que se aceptó como deuda y los riesgos abiertos. Es la única lista vigente. Un ítem cerrado sale de aquí y pasa a `04_HISTORIAL.md`.
> **Regla:** cada ítem tiene identificador, severidad, estado y fuente. Ningún otro documento mantiene una lista paralela.

---

## 1. Riesgos activos

Son problemas en producción o en el repositorio que requieren acción fuera de la documentación. Tienen prioridad sobre cualquier otro ítem.

| ID | Riesgo | Dónde | Acción requerida | Responsable |
|---|---|---|---|---|
| R-01 | Claves de operador en texto plano en el código público | `api/reporte-ondemand.js` | Rotar las claves, moverlas a variables de entorno, retirarlas del código. Las claves que quedaron en el historial de Git se consideran comprometidas. | Coordinación técnica |
| R-02 | Token de la consola de reportes incluido en el código del navegador mediante una variable `VITE_` | `src/views/SatRCOperativo.jsx` | Mover la validación completa al servidor y retirar el token del frontend. Requiere cambio de código. | Coordinación técnica |
| R-03 | `GET /api/sara` devuelve bitácora y evaluaciones sin autenticación | `api/sara.js` | Restringir la respuesta o exigir autenticación. Requiere cambio de código. | Coordinación técnica |
| R-04 | Clave de acceso a la Sala Operativa en el código del frontend | `src/App.jsx` | Sustituir por autenticación en servidor. Está ligado a R-02 y a la autenticación de V3.0. | Coordinación técnica |

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

### 2.2 Motor y datos

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-TERM-01 | Continuo térmico fuera del rango de su nivel discreto (N3 puede dar continuo de 2.64). Confirmado por test en `regresionMultifactor.test.js`. | 🟠 | Medio | Abierta, requiere calibración | `03` §6.2 |
| H-ORQ-07 | Coeficientes γ y mapeo a nivel del orquestador distintos de la especificación original. El código es la referencia. | 🟡 | Bajo | Documental | `03` §9 |
| H-CONV-01 | Unidades erróneas en la especificación convectiva (umbrales de 50 000 a 150 000). El código usa 100 y 150. | 🟢 | Bajo | Documental | `03` §7.3 |
| H-VIENTO-01 | Suavizado de 3 h y factor de rugosidad de la especificación original sin confirmar en el código. | 🟡 | Bajo | Pendiente de verificación | `03` §5.4 |
| H-MOTOR-05 | Sobreclasificación de N2 en zonas húmedas (XIC 61.9 %, HUA 52.4 %, ZAC 45.2 %). Requiere re-auditoría de 90 días. | 🟡 | Alto | Abierta, V3.0 | Etapa 3 |
| H-MOTOR-03 | El reporte diario exige 216 h de serie; el runner usa 192 h. | 🟢 | Bajo | Abierta | `03` §3 |
| H-MOTOR-01 | Gemelo del runner distinto del motor canónico. | 🟡 | Alto | Abierta, V3.0 | `03` §3 |
| H-DIAG-04 | Motor no calibrado para XIC, HUA y ZAC. Se trata junto con H-MOTOR-05. | 🟡 | Alto | Abierta, V3.0 | Etapa 3 |
| N22/N27 | Causa raíz del doble encoding UTF-8 en `@vercel/blob`. El parche de lectura funciona. | 🟡 | Medio | Abierta, V3.0 | `02` §9 |
| H-SMN-WS | El scraping del SMN depende del HTML de la página oficial, que puede cambiar sin aviso. Migrar al servicio oficial de CONAGUA. | 🟠 | Medio | Abierta | `03` §2.4 |

### 2.3 Interfaz

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| H6.6 | La interfaz no consume `nivel_alerta_global`, `niveles_por_vector` ni `acciones_operativas` en el Monitor Climático. | 🟡 | 2–3 h | Abierta, V3.0 |
| H-UI-01 | El Monitor Climático no evalúa riesgo ni muestra el semáforo N1 a N4. | 🟡 | Medio | Abierta, decisión de diseño |
| H-UI-02 | El diagnóstico SARA en el Monitor Climático usa `if/else` en vez del motor. | 🟡 | Medio | Abierta |
| H-UI-03 | El público general no ve el semáforo. Se trata junto con H-UI-01. | 🟡 | Medio | Abierta, decisión de diseño |
| H-UI-22 | El disclaimer menciona ECMWF y el gráfico lee un campo `ecmwf` que el motor no consulta. Verificar el origen de ese campo. | 🟡 | Bajo | Pendiente de verificación |
| H-UI-07 | Las secciones I a VI no tienen guardas para contenido vacío. | 🟢 | Bajo | Abierta |
| H-UI-08 | El borde de la sección 0 siempre se muestra en verde. | 🟢 | Bajo | Abierta |
| H-UI-09 | `TextoEnriquecido` no maneja todo el markdown. | 🟢 | Bajo | Abierta |
| H-UI-11 | Estilos de impresión del modal operativo incompletos. | 🟢 | Bajo | Abierta |
| H-UI-13 | El banner del SMN no se actualiza solo. | 🟢 | Bajo | Abierta |
| H-UI-14 | El banner del SMN no tiene respaldo si `/api/smn` falla. | 🟢 | Bajo | Abierta |
| H-UI-23 | `DisclaimerModal` tiene una rama que nunca se ejecuta (`abierto === undefined`). | 🟢 | Bajo | Abierta |
| H-UI-24 | El Monitor Climático no replica la interfaz multiamenaza. Se trata junto con H6.6. | 🟡 | — | Unificada con H6.6 |

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
| DEU-28 | El test de regresión del runner (`regresionMultifactor.test.js`) verifica los imports en código fuente en vez de ejecutar el runner. Requiere refactor (R3) para permitir `dryRun` y test end-to-end. | 🟡 | Medio | Abierta | Este fix |

### 2.5 Pruebas y calidad

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| DEU-16 | La regla de `node --check` antes del commit no se aplica en CI. | 🟡 | Bajo | Abierta |
| DEU-17 | `tests.yml` solo ejecuta Vitest; no valida `api/` ni `scripts/*.mjs`. | 🟡 | Bajo | Abierta |
| DEU-18 | Conteo de pruebas inconsistente entre documentos. Se resuelve documentando el conteo oficial al ejecutar `npm test`. | 🟢 | Bajo | Documental |
| H-TEST-06 | Las pruebas nuevas deben verificar la aritmética del escenario antes de asumir un error de código. La especificación del adaptador tenía un ejemplo que no cuadraba. | 🟢 | — | Lección |
| H-TEST-07 | Los módulos que emiten valores continuos deben documentar su rango `[mín, máx]`. La deuda de H-TERM-01 viene de no cumplirlo. | 🟡 | — | Lección, aplicar en H-TERM-01 |

---

### 2.6 Prompts de SARA

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-PROMPT-03 | No hay pruebas automáticas de los prompts (campos recibidos y cumplimiento de reglas). | 🟡 | Medio | Abierta | `05` §8 |

---

### 2.7 Motor multifactor (verificación del 22/10/2026)

Detalle y evidencia por línea en `VERIFICACION_MULTIFACTOR.md`.

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-MULTI-06 | El respaldo en vivo de la Sala Operativa usa solo el motor hidrológico. | 🟡 | Medio | Abierta | Verificación §2.7 |

---

### 2.8 Calidad del código (verificación local del 22/10/2026)

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| DEU-24 | `npm run lint` reporta 50 advertencias y 0 errores. Hay imports y variables sin uso, incluidos `altitud` y `esMarginacionAlta` en `riskEvaluator.js`, y `esModoEmergencia` en `reporte-ondemand.js` (la protección del reporte vigente sí está en el backend: `esParcialReal`). | 🟢 | Bajo | Abierta | Lint local |
| DEU-25 | Código muerto en `reportesRegionales.js`: `TIMEOUT_FETCH_MS` y `STAGGER_MS` sin uso. Revisar si la lógica que debían controlar falta o sobra. | 🟡 | Bajo | Abierta | Lint local |

**Resultados confirmados:** `npm test` pasa 143 de 143 pruebas en 16 archivos. `node --check api/sara.js` no reporta errores.

**Advertencia sobre la revisión de secretos:** `git ls-files | Select-String` revisa solo nombres de archivo, no contenido. La revisión de contenido debe hacerse con `git grep` buscando los valores de las claves de operador, la clave de la Sala Operativa y los prefijos de tokens (`gsk_`, `vercel_blob_rw_`, `Bearer`). La lista exacta se entrega aparte, fuera de la documentación. Pendiente.

---

## 3. Cerrados recientes

Los siguientes se cerraron y su detalle está en `04_HISTORIAL.md`. No se mantienen aquí.

- **Etapa 3** (H0 a H9): cerrada.
- **Etapa 4** (H6.1 a H6.7): cerrada a nivel funcional. Quedan abiertos H6.6, H7 y H-ARCH-01 (ver §2).
- **Etapa 5** (H5.0 a H5.8): cerrada.
- **H-E4-01** (variables E4 en Open-Meteo): cerrado.
- **H-ORQ-05 y H-ORQ-06** (N1 como `SIN_AMENAZA` y acoplamiento por vector): cerrados.
- **H-SMN (falso positivo por comunicados de prensa):** corregido; sigue abierto el riesgo de H-SMN-WS.

---

## 4. Prioridades propuestas

Estas prioridades están propuestas, no aprobadas. Se confirman antes de comenzar el trabajo.

1. **Inmediato (sin código):** rotar claves (R-01) y retirar valores de cualquier documento o archivo. Ya saneado en la documentación.
2. **Corto plazo (requiere código):** R-02 y R-03, luego R-04. Son los riesgos de exposición activa.
3. **Corto plazo (requiere código):** H-TERM-01, con una prueba que reproduzca el caso de nevada antes de corregir.
4. **Mediano plazo:** H-SMN-WS (fuente oficial del aviso), H6.6 (desglose en el Monitor Climático), DEU-19 (plan de contingencia).
5. **V3.0:** autenticación real, H-MOTOR-01, H-MOTOR-05, H-ARCH-01, nuevos vectores (incendios) y percentiles históricos.

---

## 5. Reglas para agregar pendientes

1. Un ítem nuevo entra aquí con identificador, severidad, estado y fuente.
2. Un bug resuelto no entra aquí: va a `04_HISTORIAL.md`.
3. Una decisión de diseño no entra aquí: va a `08_DECISIONES.md`.
4. Si un ítem depende de una decisión que no ha tomado la coordinación, se marca "Abierta, decisión de diseño" y no se trabaja sin confirmación.
5. Si un identificador se refiere a un hito de una etapa, se escribe la etapa cuando haya riesgo de confusión (por ejemplo, "E3-H5" frente a "E5-H5.0").
