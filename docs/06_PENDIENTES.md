# SatRC V2.0 — Pendientes, deuda técnica y riesgos

> **Versión del documento:** 2.9 (29/10/2026)
> **Propósito:** registro único de lo que falta, lo que se aceptó como deuda y los riesgos abiertos. Es la única lista vigente. Un ítem cerrado sale de aquí y pasa a `04_HISTORIAL.md`.
> **Regla:** cada ítem tiene identificador, severidad, estado y fuente. Ningún otro documento mantiene una lista paralela.
> **Cambios de esta versión (Opción A / H-CONV-02, 29/10/2026):**
> - **H-CONV-02 cerrada.** Cizalladura vectorial (u,v en m/s) y gate convectivo (`showers >= 0.5` o `precipitation >= 0.5`) implementados. Commits `7df06d7` y `b6f7b60`.
> - **PEND-11 abierta.** Calibración del umbral mínimo de precipitación convectiva con eventos reales (difiere a primavera 2026).
> - **Baseline actualizado:** 195 → 206 pass, 18 → 19 archivos. `consensusEngine.vector.test.js` nuevo (7 tests). Tests 14/15 en `crossThreatOrchestrator.test.js` nuevos (2 tests). Tests de reproducción H-CONV-02 en `convectiveEvaluator.test.js` (2 tests).
>
> **Cambios de esta versión (Sesión de cierre del 29/10/2026):**
> - **Motor y Calidad:** Cierre de N-MOTOR-09 (ADR-011), N-MOTOR-06 (+bis), N-MOTOR-36 y N-FETCH-01. Actualización del baseline a **179 pass + 0 rojos** (H-DOC-BASELINE-01 cerrado).
> - **Infraestructura:** Reparación del token en `cron-job.org` (soluciona error 401) y creación del Watchdog en GitHub Actions (Capa 3).
> - **Resiliencia:** Cierre de N-RESILIENCIA-429 (blindaje de Groq contra errores 429/413 reduciendo max_tokens y agregando retry).
> - **Integración:** Se conserva la auditoría empírica P0–P12 de la sesión anterior.

---

## 1. Riesgos activos

Son problemas en producción o en el repositorio que requieren acción fuera de la documentación. Tienen prioridad sobre cualquier otro ítem.

| ID | Riesgo | Dónde | Acción requerida | Responsable |
|---|---|---|---|---|
| R-03 | `GET /api/sara` devuelve bitácora y evaluaciones sin autenticación. **Confirmado por lectura de producción el 29/10/2026** (ver §7 P5b): la bitácora completa y las evaluaciones N3/N4 viajan sin auth. | `api/sara.js` | Restringir la respuesta o exigir autenticación. Requiere cambio de código. | Coordinación técnica |

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

> **Reformulación crítica (29/10/2026):** la auditoría empírica P9–P12 demostró que **la causa raíz de H-MOTOR-05 no es "el motor está mal calibrado"**. Es que **la Regla 6 dispara N2 por niebla nocturna habitual** en 8 zonas de montaña, usando `Math.min(ventana 24 h)` sobre una variable (visibilidad) que solo provee GFS. 217 de 227 N2 del 28/10/2026 tienen `lluvia=0`, `saturación<30 mm` y `visibilidad ≤ 2 km`. La causa raíz está desagregada en N-MOTOR-11, N-MOTOR-13, N-MOTOR-14 y N-MOTOR-15.

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| **H-MOTOR-05** | ~~Sobreestimación crónica de N2 por niebla.~~ **CERRADA el 29/10/2026 (DEC-012, commits `6fd6120`, `aabdd30`, `4204b80`, `03a91a6`).** La niebla deja de disparar nivel. Se expone como `contexto.niebla`. Impacto real verificado: N2 bajó de 227 a 18. | 🔴 | Alto | ✅ **Cerrada** | P9+P10 del 29/10/2026 |
| **H-DIAG-04** | ~~Causa raíz desagregada.~~ **CERRADA el 29/10/2026 (DEC-012).** Las 4 causas raíz (N-MOTOR-11, N-MOTOR-13, N-MOTOR-14, N-MOTOR-15) quedan cerradas porque el criterio `min(24h)` deja de disparar nivel. | 🔴 | Alto | ✅ **Cerrada** | P9–P12 del 29/10/2026 |
| **N-MOTOR-09** | ~~Acoplamiento hidro-térmico contado dos veces.~~ **CERRADA el 29/10/2026 (ADR-011, commit `95bb853`).** Se eliminó `TERMICO_HIDRO=0.10`. El acoplamiento efectivo pasa de 0.25 a 0.15. P2 verificado: `riesgo_continuo` bajó de 3.9 a 3.53. | 🟠 | Bajo | ✅ **Cerrada** | P2 del 29/10/2026 |
| **N-MOTOR-06** | ~~Defensa contra null en convectivo.~~ **CERRADA el 29/10/2026 (commit `426cc7e`).** Se filtra null en `humedad_700hpa` y `nivel_congelacion_m`, usando 100 y null como fallback seguro. Se agregaron 3 tests. | 🟠 | Bajo | ✅ **Cerrada** | Sesión 29/10/2026 |
| **N-MOTOR-36** | ~~Texto de diagnóstico de viento incoherente.~~ **CERRADA el 29/10/2026 (commit `b343165`).** Ahora muestra la ráfaga real y la equivalente a nivel del mar. | 🟡 | Bajo | ✅ **Cerrada** | Sesión 29/10/2026 |
| **N-FETCH-01** | ~~Blindaje de alineación midnight.~~ **CERRADA el 29/10/2026 (commit `c41fd0c`).** Se agregó test con fixture real y `console.warn` en producción si Open-Meteo cambia la política. | 🟡 | Bajo | ✅ **Cerrada** | Sesión 29/10/2026 |
| **N-MOTOR-11** | **La visibilidad no se consensúa porque ICON y GEM no la proveen.** Open-Meteo devuelve `visibility_gfs_seamless` con 240 valores válidos y `visibility_icon_seamless`/`visibility_gem_seamless` con 240 `null`. Confirmado con P11 en Xicotepec (28/10/2026): GFS `min=60 m, max=24,140 m, prom=18,338 m`; ICON y GEM todos `null`. **La variable que dispara 95.6 % de las alertas N2 depende de un único modelo**, contra ADR-002 (consenso determinista). | 🟠 | Medio | Abierta, **crítica bajo DEC-011** | P11 del 29/10/2026 |
| **N-MOTOR-13** | **Regla 6 usa `Math.min(ventana 24 h)` sin persistencia.** Un solo valor `visibilidad ≤ 2 km` en cualquier hora de las próximas 24 dispara N2 para toda la zona. Confirmado con P12 en Xicotepec: hoy la niebla ocurrió a las 00:00–01:00 (0.2 y 0.5 km), el resto del día >6 km, y el sistema sigue emitiendo "Vigilancia por Niebla Densa" a las 19:00. **Causa raíz principal de H-MOTOR-05.** Absorbe la hipótesis previa N-MOTOR-10. | 🔴 | Medio | Abierta, **crítica bajo DEC-011** | P12 del 29/10/2026 |
| **N-MOTOR-14** | **El motor no distingue evento actual de evento futuro.** La ventana de 24 h incluye horas ya pasadas y horas futuras indistintamente. La alerta de niebla pierde sentido cuando el evento ocurrió hace 19 horas. Bajo DEC-011, una alerta debe ser accionable en el momento de la consulta. | 🟠 | Medio | Abierta | P12 del 29/10/2026 |
| **N-MOTOR-15** | **Regla 6 usa OR sin contexto agravante.** `lluvia >= 8 OR saturación >= 30 OR visibilidad <= 2`. A diferencia de las reglas 2-5 que exigen combinación (pendiente + saturación + lluvia), la Regla 6 dispara N2 con una sola señal. Para eventos severos (N3/N4) es aceptable; para vigilancia N2 es demasiado laxo bajo DEC-011. | 🟠 | Bajo | Abierta | P12 del 29/10/2026 |
| H-SMN-WS | El scraping del SMN depende del HTML de la página oficial, que puede cambiar sin aviso. Migrar al servicio oficial de CONAGUA. | 🟠 | Medio | Abierta | `03` §2.4 |
| H-BITACORA-02 | Concurrencia entre los cuatro escritores de bitácora (`ejecutar_sara_autonomo.mjs`, `reporteDiario.mjs`, `api/reporte-ondemand.js` y `api/sara.js`). Si dos corren al mismo tiempo, el último en hacer `put` pisa la cadena del otro. **No se ha manifestado en 2 días de producción; verificado íntegro 23/23 eslabones el 29/10/2026.** Riesgo latente. | 🟡 | Alto | Abierta | Análisis de H-BITACORA-01 + P6 |
| **H-CONV-02** | ~~`convectiveEvaluator.js` mide `shearMax` como diferencia escalar de velocidades, sin dirección.~~ **CERRADA el 29/10/2026 (Opción A, commits `7df06d7` y `b6f7b60`).** Cizalladura vectorial + gate convectivo implementados. `wind_direction_10m` y `wind_direction_700hPa` propagados desde el fetcher hasta el evaluador. Ver `03_MOTOR_RIESGO.md` §7.2. | ✅ **Cerrada** | — | ✅ **Cerrada** |
| H-ENCODING-01 | El runner sigue guardando cadenas con doble codificación UTF-8. El adaptador de Google Drive no lo repara al leer; se sigue parcheando con `repararObjeto` en la API. | 🟡 | Medio | Abierta, V3.0 | `02` §9 |
| DEU-29 | Parser SMN duplicado entre `api/smn.js` y `scripts/ejecutar_sara_autonomo.mjs`. ~60 líneas idénticas de scraping y clasificación de fenómenos. Viola DRY (ADR-004). Relacionado con H-SMN-WS. | 🟡 | Medio | Abierta | `api/smn.js` |
| H-MOTOR-01 | Gemelo del runner distinto del motor canónico. | 🟡 | Alto | Abierta, V3.0 | `03` §3 |
| H-ORQ-07 | Coeficientes γ y mapeo a nivel del orquestador distintos de la especificación original. El código es la referencia. | 🟡 | Bajo | Documental | `03` §9 |
| H-MOTOR-03 | El reporte diario exige 216 h de serie; el runner usa 192 h. | 🟢 | Bajo | Abierta | `03` §3 |
| H-CONV-01 | Unidades erróneas en la especificación convectiva (umbrales de 50 000 a 150 000). El código usa 100 y 150. | 🟢 | Bajo | Documental | `03` §7.3 |
| H-VIENTO-02 | Inconsistencia de contrato entre evaluadores: el hidrológico expone `diagnostico.tipoAmenaza` (camelCase, anidado) mientras viento, térmico y convectivo exponen `vector_dominante` (snake_case, top-level). El orquestador maneja ambos casos y funciona, pero el contrato no es uniforme. | 🟢 | Bajo | Abierta, V3.0 | Análisis 28/10/2026 |

**Hipótesis refutadas en la auditoría del 29/10/2026:**

- **N-MOTOR-10** (Regla 6 dispara por niebla habitual): **cerrada como duplicada de N-MOTOR-13**. La formulación original apuntaba a "niebla habitual" sin causa raíz; N-MOTOR-13 identifica el `min(24h)` como causa.
- **N-MOTOR-12** (umbral de 2 km es alto para zonas húmedas): **REFUTADA por P12**. Con datos reales de Xicotepec, la niebla llega a 0.2 km. Bajar el umbral a 1 km no resolvería el problema, porque `min(24h) = 0.2` seguiría disparando N2. El problema es el criterio de agregación, no el umbral.

### 2.3 Interfaz

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| **N-UI-01** | **El Monitor Público no muestra el semáforo N1–N4 al público en días tranquilos.** Cuando `estado_ligero.json` viene con `evaluaciones: []` (días sin N3/N4), `MonitorPublico.jsx` busca la localidad en `[]`, no la encuentra, `evaluacionLocal = null` y **no renderiza el bloque 2.bis (semáforo + desglose por vector)**. El usuario ve solo el texto hardcodeado de la "Síntesis Comunitaria" sin semáforo real. Bajo DEC-011 esto es "gris silencioso": el ciudadano no distingue "no hay N3/N4" de "no hay datos del motor". | 🟡 | Bajo | Abierta |
| H-UI-22 | El disclaimer menciona ECMWF y el gráfico lee un campo `ecmwf` que el motor no consulta. **Confirmado en `MonitorPublico.jsx` línea 286**: `crearRutaLinea('ecmwf')` lee`detalle_modelos.temp.ecmwf`, que no existe en el consenso. La línea cae al fallback `h.temperatura_c`, mostrando el valor consensuado 3 veces superpuesto. | 🟡 | Bajo | Confirmada, abierta |
| **H-UI-02** | ~~El bloque 'Síntesis de Situación Comunitaria' usaba `if/else` con `lluviaTotalDia >= 20`.~~ **CERRADA el 29/10/2026.** El Monitor Público ahora usa `generarPronosticoComunario` (motor heurístico en `textoComunitario.js`) que evalúa multiamenaza, variaciones deterministas y pestañas temporales. | 🟡 | Bajo | ✅ **Cerrada** |
| H-UI-07 | Las secciones I a VI no tienen guardas para contenido vacío. | 🟢 | Bajo | Abierta |
| H-UI-08 | El borde de la sección 0 siempre se muestra en verde. | 🟢 | Bajo | Abierta |
| H-UI-09 | `TextoEnriquecido` no maneja todo el markdown. | 🟢 | Bajo | Abierta |
| H-UI-11 | Estilos de impresión del modal operativo incompletos. | 🟢 | Bajo | Abierta |
| H-UI-13 | El banner del SMN no se actualiza solo. | 🟢 | Bajo | Abierta |
| H-UI-14 | El banner del SMN no tiene respaldo si `/api/smn` falla. | 🟢 | Bajo | Abierta |
| H-UI-23 | `DisclaimerModal` tiene una rama que nunca se ejecuta (`abierto === undefined`). **Confirmado en código:** `MonitorPublico.jsx` siempre pasa `abierto`, la rama del `useEffect` con `abierto === undefined` es código muerto en producción. | 🟢 | Bajo | Confirmada, abierta |
| **H-UI-24** | **El Monitor Público no inyecta el aviso del SMN al pronóstico comunitario.** La función `generarPronosticoComunitario` acepta un parámetro `alertaSMN`, pero `MonitorPublico.jsx` le pasa `null` (el componente `OfficialAlertBanner` consume la API, pero el Monitor no). | 🟡 | Bajo | Abierta |

### 2.4 Arquitectura, operación y almacenamiento

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| **H-REPORTE-02** | ~~El reporte diario nunca se ha entregado.~~ **CERRADA el 29/10/2026 (commit `b22772b`).** `reporteDiario.mjs` migrado de `@vercel/blob` a `escribirJSONBlob` de Google Drive. | 🔴 | Medio | ✅ **Cerrada** | P5 del 29/10/2026 |
| **H-REPORTE-03** | ~~Reintento silencioso 8×/día.~~ **CERRADA el 29/10/2026 (commit `b22772b`).** Al escribir la bitácora correctamente, `debeGenerarReporteDiario` ya detecta la entrada del día y no reintenta. | 🔴 | Bajo | ✅ **Cerrada** | P5 del 29/10/2026 |
| **N-CRON-05/06** | ~~Doble disparador no documentado.~~ **CERRADA el 29/10/2026 (ADR-010).** **Nuevo (29/10):** se reparó `cron-job.org` (fallaba con 401 por token desactualizado) y se creó un Watchdog en GitHub Actions (Capa 3) para asegurar la ventana de las 6:00 AM. | 🟠 | Bajo | ✅ **Cerrada** | P7 + Sesión 29/10 |
| **H-PKG-01** | **Zod 4 con `.errors` en el runner.** `ejecutar_sara_autonomo.mjs:635` usa `validacion.error.errors`, campo eliminado en Zod 4. Confirmado con P1. | 🟠 | Bajo | Confirmada, abierta | P1 del 29/10/2026 |
| **N-OPS-01** | **Escalabilidad de Apps Script no documentada.** `SatRCOperativo.jsx` refresca `/api/sara` cada 5 min × 3 reads = **36 requests a Drive por hora por operador activo**. | 🟠 | Bajo | Abierta | |
| **N-OPS-02** | **`construirResumenAtmosferico` duplicada con contratos divergentes.** Viola ADR-004. | 🟠 | Bajo | Abierta | |
| **H-DRIVE-01** | **Reformulada como riesgo latente, no activo.** `escribirJSONBlob` devuelve `null` en fallo sin propagar error. El runner imprime `✅ Publicación exitosa` ciegamente. | 🔴 | Bajo | **Cerrada** el 29/10/2026 (commit 87caa05, ver 04_HISTORIAL.md §7.23) | P4 del 29/10/2026 |
| **H-DRIVE-05** | Vercel recibe HTTP 401 al intentar escribir en Drive (Apps Script). | 🔴 | Bajo | Abierta | Logs Vercel 28/10/2026 |
| **H-DRIVE-04** | `googleDrive.js` no valida el formato de `GOOGLE_SCRIPT_URL`. | 🟠 | Bajo | Abierta | Incidente 28/10/2026 |
| **H-ONDEMAND-01** | `tokenConsolaValido()` en `reporte-ondemand.js`: `if (!esperado) return true`. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-05** | `TIMEOUT_GROQ_MS = 8000` es demasiado alto para Vercel Hobby. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-03** | `escribirJSONBlob('reporte_diocesano_vigente.json')` no verifica el retorno. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-DRIVE-02** | El runner escribe `estado_ligero.json` sin validarlo con Zod. | 🟠 | Medio | Abierta | Análisis 28/10/2026 + baseline |
| **H-SARA-05** | `bitacoraLeida = true` en el `else` de `sara.js`. | 🟠 | Medio | **Posiblemente obsoleta** | Análisis 28/10/2026 |
| **H-ONDEMAND-04** | `escribirJSONBlob('bitacora_sara.json')` no verifica el retorno. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-06** | `max_completion_tokens: 2500` en el on-demand puede cortar el JSON. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-07** | `esParcialReal` se calcula del payload del cliente. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-08** | Si falla `leerJSONBlob`, `hashUltimo = BLOQUE_GENESIS` → reinicia la cadena SHA-256. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-09** | Si escribe el reporte OK pero falla la bitácora, hay inconsistencia. No hay rollback. | 🟠 | Medio | **Riesgo latente, no confirmado** | Análisis 28/10/2026 + P5b |
| **N-OPS-04** | El modal de bitácora muestra hardcodeado `"Almacén en Vercel Blob"`. | 🟡 | Bajo | Abierta | |
| **N-OPS-05** | El modal de bitácora no muestra `hash_completo` ni `prev_hash`. | 🟡 | Bajo | Abierta | |
| **N-OPS-07** | `descargarDocumentoOficial` hardcodea `"ON-DEMAND"` en el título. | 🟢 | Bajo | Abierta | |
| **H-DRY-01** | `generarHashSHA256` + `siguienteIdBitacora` reimplementados en 3 archivos. | 🟡 | Medio | Abierta | Análisis 28/10/2026 |
| **H-API-06** | `api/auth-operativo.js` valida la clave sin un sistema de sesiones. | 🟡 | Medio | Abierta, V3.0 | Migración 27/10/2026 |
| H-ARCH-01 | Agregar un quinto evaluador exige tocar siete archivos. | 🟡 | Medio | Abierta, V3.0 | `02` §10 |
| DEU-19 | Dependencia de planes gratuitos (Groq, Vercel, Open-Meteo, cron-job.org) sin plan de contingencia. | 🟡 | Medio | Sin documentar | |
| DEU-28 | El test de regresión del runner verifica imports en código fuente. | 🟡 | Medio | Abierta | |
| DEU-22 | Constante `TAMANO_LOTE = 4` declarada en cuatro archivos. | 🟢 | Bajo | Abierta | `02` §4 + análisis 29/10/2026 |
| H-INFRA-01 | No existe `vercel.json`; el despliegue usa detección automática. | 🟢 | Bajo | Abierta, V3.0 | `02` §10 |
| H-NOM-01 | `procesar_datos.cjs` escribe `version: "3.0"`. | 🟢 | Bajo | Abierta | Revisión documental |
| H-API-02 | `disparar-workflow.js` no registra IP ni agente de usuario. | 🟢 | Bajo | Abierta | |
| H-API-05 | `latest-gif.js` no tiene respaldo si NOAA cambia el patrón de nombres. | 🟢 | Bajo | Abierta | |
| **N-API-SMN-01** | `api/smn.js` retorna `color`, `OfficialAlertBanner.jsx` no lo consume. | 🟢 | Bajo | Abierta | |
| **N-API-SMN-03** | `api/smn.js` retorna `exito: false` con `alerta: { activo: false, nivel: 1 }`. | 🟠 | Bajo | Abierta | |
| **N-API-NOAA-01** | `Cache-Control: s-maxage=300` cachea el 404 durante 5 min. | 🟢 | Bajo | Abierta | |
| **N-API-NOAA-02** | `glmFed` probablemente no emite `-1000x1000.gif` estándar. | 🟢 | Bajo | Pendiente verificar | |
| **N-API-GH-01** | `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_REF` hardcodeados. | 🟢 | Bajo | Abierta | |
| DEU-30 | `normalizarDatosRegionales` cae a `14` con `||`. | 🟢 | Bajo | Abierta | |
| **H-CRON-01** | `sara_cron.yml` no tiene pre-check de `GROQ_API_KEY` y `GOOGLE_SCRIPT_URL`. | 🟢 | Bajo | Abierta | |
| H-CI-01 | `tests.yml` no corre `npm run build`. | 🟢 | Bajo | **Cerrada** el 29/10/2026 (commit 876864f). El workflow ahora ejecuta npm run build en el step Build | |
| **N-RESILIENCIA-429** | **Falla silenciosa del reporte diario ante 429/413 de Groq.** **CERRADA el 29/10/2026 (commit `a274db4`).** Se redujo `max_tokens` a 3000 (diario) y 800 (dictamen), y se agregó retry con backoff de 30s. | 🔴 | Medio | ✅ **Cerrada** | Sesión 29/10/2026 |

### 2.5 Pruebas y calidad

> **Baseline verificado el 29/10/2026 (Cierre de sesión, HEAD 4543fce):**
> - `npm test` → **206 pass + 0 rojos** en 19 archivos. Incluye: 195 previos + 7 tests de cizalladura vectorial y showers (H-CONV-02, `consensusEngine.vector.test.js`) + 2 tests nuevos de propagación en el orquestador + 2 tests nuevos de reproducción del falso positivo (H-CONV-02, `convectiveEvaluator.test.js`). Verificado el 29/10/2026 con `npm test` sobre el HEAD `b6f7b60` + A.6.1.
> - `npm run lint` → **57 advertencias, 0 errores**.
> - `npm run build` → verde, 853.44 kB / 201.79 kB gzip.

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| DEU-16 | La regla de `node --check` antes del commit no se aplica en CI. | 🟡 | Bajo | **Cerrada** el 29/10/2026 (commit 876864f). El workflow ejecuta node --check en 9 archivos de api/ y scripts/ |
| DEU-17 | `tests.yml` solo ejecuta Vitest; no valida `api/` ni `scripts/*.mjs`. | 🟡 | Bajo | **Cerrada parcialmente** el 29/10/2026 (commit 876864f). Sintaxis cubierta por node --check. Validación funcional de api/ y scripts/ sigue como deuda |
| **N-CI-03** | **`tests.yml` no corre `node --check` ni `npm run build`.** | 🟠 | Bajo | **Cerrada** el 29/10/2026 (commit 876864f). El workflow ejecuta 4 steps: tests, node --check, lint, build |
| **H-PROCESO-03** | **Lección de P5b:** un filtro vacío no es evidencia de ausencia de datos. | 🟡 | — | Lección registrada |
| **N-TEST-01** | Tests usan `require('fs')` y `require('path')` en ESM. | 🟡 | Bajo | Abierta |
| **N-TEST-07** | El test "Downburst N4" no valida el subtipo `DOWNBURST`. | 🟡 | Bajo | Abierta |
| **N-TEST-08** | Sin cobertura de `null` en `humedad_700hpa`. **Resuelto el 29/10/2026 (commit `426cc7e`).** | 🟡 | Bajo | ✅ **Cerrada** |
| **N-TEST-09** | `datos_disponibles_por_vector` sin cobertura. | 🟡 | Bajo | Abierta |
| H-TEST-07 | Módulos deben documentar su rango `[mín, máx]`. | 🟡 | — | Lección |
| H-TEST-11 | `datos_disponibles_por_vector` no tiene cobertura. | 🟡 | Bajo | Abierta |
| DEU-18 | Conteo de pruebas inconsistente. **Resuelto el 29/10/2026: 179 pass + 0 rojos.** | 🟢 | Bajo | ✅ **Cerrada** |
| H-TEST-06 | Verificar aritmética antes de asumir error de código. | 🟢 | — | Lección |
| H-ORQ-08 | `determinarVectorDominante()` usa `prioridad.indexOf(a)` sobre un array en mutación. | 🟢 | Bajo | Abierta |
| **H-SCHEMA-01** | `EstadoDiocesanoBlobSchema` tiene `schema_version`, pero el runner no lo emite. | 🟢 | Bajo | Confirmada empíricamente |

### 2.6 Prompts de SARA

> **Confirmación P3 del 29/10/2026:** grep sobre `scripts/reportes/reporteDiario.mjs` → **0 coincidencias** de la regla 17. Grep sobre `api/reporte-ondemand.js` → **1 coincidencia** en la línea 189. Asimetría confirmada por evidencia dura.

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| **H-PROMPT-06** | ~~El `systemPrompt` del diario no tiene la regla de control de emergencias.~~ **CERRADA el 29/10/2026 (Commit `4204b80`).** | 🔴 | Medio | ✅ **Cerrada** | P3 del 29/10/2026 |
| **H-PROMPT-09** | El `systemPrompt` del on-demand **no tiene la regla 12.bis** (coherencia Sección 0 ↔ Sección II). | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-PROMPT-05** | El dictamen del runner llama a Groq sin `max_completion_tokens`. **Resuelto el 29/10/2026 (commit `a274db4`, ahora es 800).** | 🟠 | Bajo | ✅ **Cerrada** | Análisis 28/10/2026 |
| **H-PROMPT-08** | `promptsMultivector.js` implementa solo R17. Faltan R18, R19, R20. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-PROMPT-10** | R17 no menciona `acciones_operativas`. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| H-PROMPT-03 | No hay pruebas automáticas de los prompts. | 🟡 | Medio | Abierta | `05` §8 |
| **H-PROMPT-07** | La regla 10 del prompt usa umbrales más bajos que el motor. | 🟢 | Bajo | Abierta | Análisis 28/10/2026 |
| H-PROMPT-04 | El prompt no incluye el aviso de "suspender actividades". | 🟡 | Bajo | Abierta | Crisis 27/10/2026 |

### 2.7 Motor multifactor

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| H-MULTI-06 | El respaldo en vivo de la Sala Operativa usa solo el motor hidrológico. | 🟡 | Medio | Abierta | Verificación §2.7 |

### 2.8 Calidad del código (verificación del 29/10/2026)

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| DEU-24 | `npm run lint` reporta **55 advertencias y 0 errores** (imports sin uso, variables sin uso, etc.). | 🟢 | Bajo | Abierta | P0 lint del 29/10/2026 |
| DEU-25 | Código muerto en `reportesRegionales.js`: `TIMEOUT_FETCH_MS` y `STAGGER_MS` sin uso. | 🟡 | Bajo | Abierta | Lint local |

### 2.9 Deudas documentales

| ID | Deuda | Sev. | Estado | Fuente |
|---|---|---|---|---|
| **H-DOC-BASELINE-01** | ~~Cifras de baseline desactualizadas.~~ **CERRADA el 29/10/2026 (commit `f6f4281`).** Baseline actualizado a 179 pass. | 🟠 | ✅ **Cerrada** | P0 del 29/10/2026 |
| **H-DOC-BASELINE-02** | ~~Advertencias de lint desactualizadas.~~ **CERRADA el 29/10/2026.** Actualizado a 55 advertencias. | 🟡 | ✅ **Cerrada** | P0 lint del 29/10/2026 |
| H-DOC-HVIENTO-01 | **H-VIENTO-01** está declarado cerrado incorrectamente en `04_HISTORIAL.md` §6.1. | 🟠 | Abierta | Análisis 28/10/2026 + verificación 29/10/2026 |
| H-DOC-H6.6 | `04_HISTORIAL.md` menciona H6.6 como "abierto" en notas históricas. | 🟠 | Abierta | Análisis 28/10/2026 |
| H-DOC-REF-02 | Referencia rota a `02_ARQUITECTURA.md §8`. | 🟢 | Cerrado | Análisis 28/10/2026 |
| H-DOC-MOJI-02 | Posible mojibake en docs. | 🟢 | Pendiente de verificar | Análisis 28/10/2026 |
| H-DOC-GIT-01 | Archivos `salida_*.txt` no están en `.gitignore`. | 🟡 | Abierta | P0 del 29/10/2026 |
| H-DOC-ASSETS-01 | Assets sin referencias en `src/assets/`. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-TEST-01 | Carpetas vacías `src/lib/__tests__/` y `test/`. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-PS1-01 | Scripts de diagnóstico históricos en `scripts/diagnostico/*.ps1`. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-EXT-01 | `12_E4_THERMAL_EVALUATOR.MD` con extensión en mayúsculas. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-README-01 | `README.md` desactualizado y con mojibake pendiente. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-PUBLIC-01 | `public/` documentado. | 🟢 | Cerrado | Análisis 28/10/2026 |
| H-DOC-DIAGEXT-01 | `diagnostico_externo/` documentado. | 🟢 | Cerrado | Análisis 28/10/2026 |
| **H-DOC-PWA-01** | `LEEME_PRIMERO.md` y `09_ARBOL` dicen "cache offline parcial". Es Network-Only puro. | 🟠 | Abierta | P0 del 29/10/2026 |
| **N-DOC-03** | `01_CONTEXTO.md` contiene un snapshot antiguo de `08_DECISIONES.md` embebido (ADR-001 a ADR-009). Requiere decisión de cómo corregirlo (D1=A del 29/10: solo registrar deuda, no tocar el archivo). | 🟠 | Abierta | Sesión 29/10/2026 |
| **N-DOC-04** | 5 documentos fundacionales quedaron desactualizados tras la sesión del 29/10/2026 y no se actualizaron en esta sesión: `02_ARQUITECTURA.md` (notas "aún en Vercel Blob" en L51/154/188/189 + H-DRIVE-01/H-REPORTE-02 en §9), `03_MOTOR_RIESGO.md` (baseline 179 en L570 + N-MOTOR-08-bis/16/30 abiertas en §12), `05_PROMPT_SARA.md` (R18 como pendiente en §4 pese a estar implementada), `07_GUIA_OPERACION.md` (baseline 165/179 en L9/274 + `BLOB_READ_WRITE_TOKEN` en L454/459), `09_ARBOL_Y_RUTA_DE_APRENDIZAJE.md` (`src/lib/compartido/__tests__/` con 7 archivos cuando ya son 8 con `googleDrive.test.js`). Corregir en una sesión específica de coherencia documental. | 🟠 | Abierta | Sesión 29/10/2026 (Vía 3 del cierre) |

### 2.10 Re-auditoría de invierno pendiente

En la verificación del 27/10/2026, las 405 localidades tenían `niveles_por_vector.termico = 1.0` (no hay frío en octubre). El impacto del fix de H-TERM-01 en el semáforo se medirá en la primera corrida de invierno que dispare el térmico. Si la subida de N3 supera el 30 %, evaluar recalibración del peso (commit B2 separado).

### 2.11 Deudas nuevas detectadas en la auditoría documental del 29/10/2026 (pendientes de verificación empírica)

> Estas deudas fueron identificadas por lectura cruzada de código, docs y datos durante la fase de contexto (45+ archivos). No todas se han verificado en producción. Se documentan para no perderlas, con el estado de verificación explícito.

| ID | Deuda | Sev. | Estado verificación |
|---|---|---|---|
| **N-MOTOR-01** | Ráfagas se consensúan con `Math.max(r_gfs, r_icon, r_gem)` en `consensusEngine.js`. ADR-002 solo autoriza máximo para `cape` y `wind_speed_700hPa`. **Sobrestima sistemáticamente el vector viento.** | 🟠 | Verificado en código |
| **N-MOTOR-24** | `calcularUmbralDeslave` calcula un umbral dinámico (`65 - pendiente*0.85 - factorRelieve`) que **nunca se usa en las reglas**. | 🟠 | Verificado en código |
| **N-MOTOR-28** | El piso del aviso SMN (`Math.max(lluviaEfectiva, pisoSMN)`) es una fuente de sobreestimación no catalogada bajo DEC-011. | 🟠 | Verificado en código |
| **N-MOTOR-29** | `tipoAmenaza: "ESTABLE"` (Regla 1) y `"VIGILANCIA_NORMAL"` (Regla 6) no coinciden con `03_MOTOR_RIESGO.md` §9.4. | 🟠 | Verificado en código |
| **N-MOTOR-30** | `umbralFisicoDeslaveMm` reportado en el diagnóstico no coincide con el umbral (65.0) realmente usado. | 🟡 | **Cerrada** el 29/10/2026 (commit 1505624). El campo reporta 65.0 constante. 1 test nuevo en riskEvaluator.test.js |
| **N-MOTOR-05-bis** | SPP (43 localidades) y HYC (13) tienen perfil `Aw`/`LADERA` similar a XIC/HUA/ZAC, pero no aparecen en la lista original de H-MOTOR-05. **Confirmado por P9.** | 🔴 | Confirmado por P9 |
| **N-MOTOR-08-bis** | Regla 4 (inundación) no pondera por `tc_horas`. Sobrestima cuencas lentas. | 🟠 | **Confirmado por test** el 29/10/2026 (commit c276e59). El runner asigna N4 donde el frontend asigna N3 con poblacionAguasArriba < 50000 y lluvia 35-64 mm. Ver riskEvaluatorRunner.test.js Test 6 |
| **N-DICT-01** | `generarTituloDictamen(2, 'SIN_AMENAZA')` produce `"Vigilancia por Condiciones Normales"` (contradictorio). | 🟡 | Verificado en código |
| **N-DICT-02** | Sin test que verifique que `NOMBRES_VECTOR` cubre todos los vectores. | 🟡 | Verificado en código |
| **N-REG-02** | `construirBloqueRegional` hardcodea `"ventana 72h"` en el encabezado incluso en on-demand. | 🟡 | Verificado en código |
| **N-REG-03** | Si `resumenes` está vacío pero `zonas_fallidas` no, `construirBloqueRegional` no menciona el fallo. | 🟡 | Verificado en código |
| **N-VITE-01** | `vite.config.js` sin proxy para `/api`. | 🟡 | Verificado |
| **N-AUTH-01** | `App.jsx` sin sesión persistente. | 🟢 | Verificado en código |
| **N-FEC-01** | `formatearTimestamp` retorna `null` sin guarda en el JSDoc. | 🟢 | Verificado en código |
| **N-MOJ-01** | `mojibake.js` no detecta mojibake de caracteres de 4 bytes UTF-8. | 🟢 | Verificado en código |
| **N-MOJ-02** | `repararMojibake` silenciosa si no repara. | 🟢 | Verificado en código |
| **N-NODOS-01** | Desempate por orden de iteración si empatan poblaciones. | 🟢 | Verificado en código |
| **N-DRY-04** | URLs NOAA duplicadas entre `latest-gif.js` (objeto `DIRS` hardcodeado) y `noaa-goes.js` (`NOAA_PRODUCTS.*.dir`). El backend no importa `NOAA_PRODUCTS`. Viola ADR-004. | 🟠 | Verificado en código |
| **N-DRY-05** | 4 archivos sin newline final: `googleDrive.js`, `riskEvaluatorRunner.test.js`, `consensusEngine.test.js`, `riskEvaluator.test.js`. Cosmético. | 🟢 | Verificado en código |
| **N-CI-05** | `actions/checkout@v4` y `actions/setup-node@v4` deprecadas (warning "Node.js 20 is deprecated"). Bump a v5+ opcional. | 🟢 | Confirmado por log de Actions (run 40967148872) |
| **N-INDEX-01** | `index.html` viewport declara `maximum-scale=1.0, user-scalable=no`, bloqueando el zoom táctil. Viola WCAG 2.1 SC 1.4.4. | 🟡 | Verificado en código |
| **N-PWA-03** | `index.html` enlaza a `/manifest.json` pero no se ha verificado su existencia ni contenido. La PWA no se instala si el manifest falta. | 🟠 | Pendiente de verificar |
| **N-BITACORA-04** | Test de integración entre los 4 escritores de bitácora (runner, diario, on-demand, sara) no existe. **Bloqueada por N-DRY-03** (refactor para exponer la lógica como función). Sin test, H-BITACORA-02 sigue sin red de seguridad. | 🟠 | Verificado por ausencia; bloqueada |
| **N-ARCH-02** | `parseNoaaStamp` duplicada en `SatelliteViewer.jsx` (sin validación de rangos) y en `src/lib/compartido/noaa.js`. `calcularContextoNiebla` duplicada en `riskEvaluator.js` y `riskEvaluatorRunner.mjs`. Viola ADR-004. | 🟡 | Verificado en código |
| **N-AUTH-03** | El frontend no distingue roles. Cualquier clave válida en `SATRC_OPERADORES_JSON` autentica y da acceso completo a la Sala Operativa. Los roles existen solo en el backend para `generado_por`. | 🟡 | Verificado en código |

---

## 3. Cerrados recientes

Los siguientes se cerraron y su detalle está en `04_HISTORIAL.md`. No se mantienen aquí.

- **Etapas 3, 4 y 5:** cerradas.
- **H-MULTI-01..05, H-PROMPT-01, H-PROMPT-02, H6.6, H-UI-01, H-UI-03:** cerrados (2026).
- **H-TERM-01, H-VIENTO-01, H-SMN (falso positivo):** cerrados (24/10/2026). **H-VIENTO-01 requiere reapertura documental** por el error de cierre en `04_HISTORIAL.md` §6.1 (ver H-DOC-HVIENTO-01 en §2.9).
- **H-BITACORA-01 y H-REPORTE-01:** cerrados el 24/10/2026 (commit `d3b0c1c`).
- **H-MOTOR-07 y H-CONV-03:** cerrados el 27/10/2026 (commit `d248fdb`).
- **R-01, R-02, R-04 y DEU-21:** cerrados el 27/10/2026 (commits `0110708`, `aaea7e6`).
- **H-VERCEL-01 (Timeout/Suspensión de Blob):** cerrado el 27/10/2026. Se migró todo el almacenamiento a Google Drive (Apps Script).
- **N22/N27 (Mojibake en Blob):** cerrado el 27/10/2026. Al migrar a Google Drive, el problema de codificación doble en el Blob desaparece.
- **H-RUNNER-01:** Renombrado a **H-REPORTE-02**.
- **H-SARA-02:** Cerrado el 28/10/2026 (commit `2a3e3e8`).
- **H-DRIVE-02 (Zod schema):** Cerrado el 28/10/2026 (commit `3053e29`). **Sin embargo, este cambio dejó 2 tests rojos sin actualizar (ver H-DOC-BASELINE-01).**
- **Incidente de producción 28/10/2026:** Cerrado.
- **H-ENTORNO-01 (Entorno local):** Cerrado el 28/10/2026.
- **H-SARA-01, H-SARA-03, H-SARA-04:** Cerrados el 28/10/2026 (commit `b25d7c5`).
- **H-ONDEMAND-09 (para el caso del 28/10/2026):** **REFUTADA la manifestación** por P5b.
- **H-PKG-01:** Cerrado el 29/10/2026 (commit `6fd6120`/F1).
- **N-PROMPT-JSON-01:** Cerrado el 29/10/2026 (commit `5b2d70b`).
- **H-MOTOR-05 y H-DIAG-04:** Cerrados el 29/10/2026 (DEC-012).
- **N-MOTOR-09:** Cerrado el 29/10/2026 (ADR-011, `95bb853`).
- **N-MOTOR-06 y N-MOTOR-06-bis:** Cerrados el 29/10/2026 (`426cc7e`).
- **N-MOTOR-36:** Cerrado el 29/10/2026 (`b343165`).
- **N-FETCH-01:** Cerrado el 29/10/2026 (`c41fd0c`).
- **N-RESILIENCIA-429:** Cerrado el 29/10/2026 (`a274db4`).

---

## 4. Prioridades propuestas bajo DEC-011

Estas prioridades están propuestas, no aprobadas. Se confirman antes de comenzar el trabajo.

> **Bajo DEC-011 (precisión sobre cobertura), el orden de ataque cambia respecto a la v2.7.** El criterio es: primero lo que reduce falsos positivos publicados, después lo que reduce ruido interno, después la deuda latente.

1. **Inmediato (crítico bajo DEC-011): H-MOTOR-05 + H-DIAG-04 + N-MOTOR-11/13/14/15.** Requiere decisión de coordinación técnica + pastoral (**PEND-06**): qué criterio operativo debe disparar N2 por niebla. Sin esta decisión, el fix es a ciegas. Estimación de impacto: 217 falsos positivos diarios eliminados. **(H-MOTOR-05 y H-DIAG-04 ya cerrados el 29/10).**
2. **Inmediato (crítico operativo): H-REPORTE-02 + H-REPORTE-03.** El reporte diario automático no se ha entregado ni una vez desde el 27/10. **(Ya cerrados el 29/10).**
3. **Inmediato (agrava #2): H-PROMPT-06 + H-PROMPT-09.** Al arreglar el diario, este saldría sin la regla 17. Corregir los prompts en el mismo lote que H-REPORTE-02. **(H-PROMPT-06 cerrado el 29/10).**
4. **Corto plazo: N-CRON-05 + N-CRON-06.** Decidir si el `on.schedule` interno se mantiene como respaldo (**PEND-07**). **(Cerrado el 29/10).**
5. **Corto plazo: N-MOTOR-09.** Requiere ADR de reemplazo. **(Cerrado el 29/10 con ADR-011).**
6. **Corto plazo: H-PKG-01.** Cambiar `validacion.error.errors` a `.issues`. **(Cerrado el 29/10).**
7. **Corto plazo: N-UI-01.** Mostrar el semáforo N1–N4 en el Monitor Público incluso en días tranquilos.
8. **Corto plazo: N-CI-03 + H-CI-01 + DEU-16/17.** Añadir `node --check` y `npm run build` a CI.
9. **Mediano plazo: R-03 (auth en `/api/sara`).**
10. **Mediano plazo: H-DRIVE-01 + H-DRIVE-04/05.**
11. **Mediano plazo: H-ONDEMAND-01, H-ONDEMAND-05, H-ONDEMAND-06.**
12. **Mediano plazo: N-OPS-01 + N-OPS-02 + N-OPS-04/05/07.**
13. **Mediano plazo: H-DRY-01, H-SARA-05 (verificar si obsoleta), H-ONDEMAND-03/04/07/08/09.**
14. **Mediano plazo: N-MOTOR-01, N-MOTOR-08-bis, N-MOTOR-24, N-MOTOR-28, N-MOTOR-29, N-MOTOR-30.**
15. **Mediano plazo: H-CONV-02, H-SMN-WS, H-MULTI-06, DEU-19, N-MOTOR-05-bis.**
16. **V3.0:** autenticación real, H-MOTOR-01, H-ARCH-01, H-VIENTO-02, N-VITE-01, N-AUTH-01, nuevos vectores.

---

## 5. Reglas para agregar pendientes

1. Un ítem nuevo entra aquí con identificador, severidad, estado y fuente.
2. Un bug resuelto no entra aquí: va a `04_HISTORIAL.md`.
3. Una decisión de diseño no entra aquí: va a `08_DECISIONES.md`.
4. Si un ítem depende de una decisión que no ha tomado la coordinación, se marca "Abierta, decisión de diseño" y no se trabaja sin confirmación.
5. Si un identificador se refiere a un hito de una etapa, se escribe la etapa cuando haya riesgo de confusión.
6. **Nuevo (29/10/2026):** toda deuda detectada por auditoría documental pero no verificada empíricamente se marca con su estado de verificación explícito en §2.11.

---

## 6. Decisiones pendientes

| ID | Pregunta | Quién decide | Origen |
|---|---|---|---|
| PEND-03 | ¿Los coeficientes de acoplamiento (ADR-005) se recalibran con eventos reales? Bajo DEC-011 esta calibración es prioritaria. | Coordinación técnica y pastoral | `08_DECISIONES.md` |
| PEND-04 | ¿Se migrará el runner a un modelo de ejecución que no dependa de GitHub Actions? | Coordinación técnica | `08_DECISIONES.md` |
| PEND-05 | ¿Cuál es la métrica objetivo de confiabilidad (porcentaje de alertas que se materializan) que cierra DEC-011? | Coordinación técnica y pastoral | `08_DECISIONES.md` |
| **PEND-06** | **¿Qué criterio operativo debe disparar N2 por niebla?** Opciones bajo DEC-011: (A) persistencia ≥ 4 h consecutivas; (B) ventana próxima 6 h en vez de 24 h; (C) niebla + otra condición; (D) niebla ≤ 1 km con persistencia ≥ 2 h; (E) híbrido. | Coordinación técnica y pastoral | P12 del 29/10/2026 |
| **PEND-07** | **¿El `on.schedule` interno de `sara_cron.yml` es un respaldo deliberado o se elimina?** | Coordinación técnica | P7 del 29/10/2026 |
| **PEND-08** | **¿Cómo debe resolverse N-MOTOR-09?** **RESUELTA el 29/10/2026 (Opción A).** Se conserva `HIDRO_TERMICO=0.15` y se elimina `TERMICO_HIDRO=0.10`. | Coordinación técnica y pastoral | P2 del 29/10/2026 |
| **PEND-09** | **¿Cómo debe tratarse la escritura de `reporte_diocesano_vigente.json` y `bitacora_sara.json` cuando el primero tiene éxito y el segundo falla?** Opciones: (a) rollback; (b) orden invertido; (c) aceptar la inconsistencia con log persistente; (d) escritura transaccional en un único JSON. Bajo DEC-011, la opción debe ser verificable empíricamente y auditable. | Coordinación técnica y pastoral | Sesión 29/10/2026 (H-ONDEMAND-09, N-ONDEMAND-04) |
| **PEND-10** | **¿Cómo se alinean los subtipos de `tipo_amenaza` entre el motor, la documentación (§9.4 de `03_MOTOR_RIESGO.md`) y los prompts (`REGLAS_MULTIVECTOR` en `promptsMultivector.js`)?** Opciones: (a) alinear código a docs; (b) alinear docs a código; (c) mapeo intermedio en el orquestador. Requiere test de contrato. | Coordinación técnica y pastoral | Sesión 29/10/2026 (N-MOTOR-29, N-MOTOR-05, N-RUNNER-VECTOR-CONTRACT) |
| **PEND-11** | **¿Cuál es el umbral mínimo de `showers`/`precipitation` que activa el gate convectivo del downburst?** El valor inicial de 0.5 mm/h es una calibración de referencia. Bajo DEC-011, debe calibrarse con eventos observados en la Sierra de Puebla-Hidalgo para evitar trazas de lluvia (0.2-0.3 mm/h) que activen falsos positivos. | Coordinación técnica y pastoral | Sesión 29/10/2026 (Opción A, A.4) |

---

## 7. Auditoría empírica del 29/10/2026 (P0–P12 y Sesión de Cierre)

### P0 — Baseline verificado
- **Comando:** `npm test`, `npm run lint`, `npm run build`.
- **Resultado:** 165 pass + 2 rojos (sesión anterior). 179 pass + 0 rojos (sesión de cierre).
- **Veredicto:** baseline documentado y actualizado.

### P1 — N-PKG-01 (Zod `.errors`)
- **Resultado:** Zod 4.6.5 instalado. `safeParse` con error → `error.issues` tiene contenido, `error.errors` es `undefined`.
- **Veredicto:** **H-PKG-01 confirmada.** Reclasificada a 🟠 alta.

### P2 — N-MOTOR-09 (acoplamiento duplicado)
- **Resultado:** `riesgo_continuo = 3.90` real vs `3.53` esperado.
- **Veredicto:** **N-MOTOR-09 confirmada y cerrada el 29/10 con ADR-011.** Ahora da 3.53.

### P3 — H-PROMPT-06 (diario sin regla 17)
- **Resultado:** Diario → 0 coincidencias. On-demand → 1 coincidencia.
- **Veredicto:** **H-PROMPT-06 confirmada y cerrada el 29/10.**

### P4 — H-DRIVE-01 (log miente)
- **Resultado:** Drive funciona. `schema_version` vacío.
- **Veredicto:** **H-DRIVE-01 riesgo latente.** **H-SCHEMA-01 confirmada.**

### P5 — H-REPORTE-02 (diario no se guarda)
- **Resultado:** 22 CRON, 0 diarios. Reporte vigente es ON_DEMAND.
- **Veredicto:** **H-REPORTE-02 confirmada y cerrada el 29/10.**

### P5b — Corrección metodológica (H-PROCESO-03)
- **Resultado:** filtro vacío. Cronología reveló que sí existía.
- **Veredicto:** **H-ONDEMAND-09 refutada.** Lección H-PROCESO-03.

### P6 — Cadena SHA-256
- **Resultado:** 23/23 íntegros.
- **Veredicto:** ADR-003 validado. H-BITACORA-02 no manifestado.

### P7 — N-CRON-05/06 (frecuencia)
- **Resultado:** 60 corridas en 5 días. 17 schedule, 43 dispatch.
- **Veredicto:** **N-CRON-05/06 confirmadas y cerradas el 29/10.** Se mantiene doble disparador.

### P9 — H-MOTOR-05/H-DIAG-04 (N2 por niebla)
- **Resultado:** 217 de 227 N2 son "Niebla Densa".
- **Veredicto:** **H-MOTOR-05 y H-DIAG-04 confirmadas y cerradas el 29/10.**

### P10 — Distribución de visibilidad
- **Resultado:** 217 alertas con visibilidad ≤ 0.36 km.
- **Veredicto:** Confirmación de H-MOTOR-05.

### P11 — Open-Meteo: ¿ICON y GEM proveen visibilidad?
- **Resultado:** Solo GFS provee visibilidad.
- **Veredicto:** **N-MOTOR-11 confirmada.**

### P12 — Persistencia de la niebla
- **Resultado:** 2 horas de niebla. Resto del día > 6 km.
- **Veredicto:** **N-MOTOR-12 REFUTADA.** **N-MOTOR-13 y N-MOTOR-14 confirmadas.**

### Sesión de Cierre — 29/10/2026 (Fixes aplicados)
- **P2 post-fix (ADR-011):** Se aplicó el commit `95bb853`. `riesgo_continuo` bajó de 3.9 a 3.53.
- **N-MOTOR-06 (Defensa null):** Commit `426cc7e`. Con humedad null, el potencial de desplome baja a 0.
- **N-MOTOR-36 (Viento):** Commit `b343165`. El texto muestra ambos valores.
- **P0 diagnóstica (Cron):** Se detectó `401 Unauthorized` en cron-job.org y se reparó el secreto. Se creó el Watchdog en GitHub Actions.
- **N-RESILIENCIA-429 (Groq):** Commit `a274db4`. Se redujo `max_tokens` a 3000/800 y se agregó retry.

---

*Fin del documento.*
