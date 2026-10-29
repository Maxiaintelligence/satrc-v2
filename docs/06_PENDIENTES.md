# SatRC V2.0 — Pendientes, deuda técnica y riesgos

> **Versión del documento:** 2.8 (29/10/2026)
> **Propósito:** registro único de lo que falta, lo que se aceptó como deuda y los riesgos abiertos. Es la única lista vigente. Un ítem cerrado sale de aquí y pasa a `04_HISTORIAL.md`.
> **Regla:** cada ítem tiene identificador, severidad, estado y fuente. Ningún otro documento mantiene una lista paralela.
> **Cambios de esta versión:**
> - Integración de los resultados de la auditoría empírica P1–P12 del 29/10/2026 (§7).
> - **Reformulación de H-MOTOR-05 / H-DIAG-04** con causa raíz confirmada (§2.2).
> - Nuevas deudas críticas confirmadas: **N-MOTOR-09, N-MOTOR-11, N-MOTOR-13, N-MOTOR-14, N-MOTOR-15, H-REPORTE-03, H-PKG-01, N-CRON-05, N-CRON-06, N-UI-01, N-OPS-01, N-OPS-02, H-PROCESO-03**.
> - **Refutación documentada de N-MOTOR-12** (hipótesis previa sobre umbral de niebla).
> - Corrección del baseline verificado: `npm test` → **165 pass + 2 rojos obsoletos** (no 167 en verde). `npm run lint` → **55 advertencias, 0 errores** (no 51).
> - **H-SCHEMA-01 confirmado empíricamente** en producción (campo `schema_version` ausente).
> - **H-DRIVE-01 reformulado como riesgo latente** (no activo hoy).
> - Nuevas decisiones pendientes PEND-06, PEND-07, PEND-08.

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
| **H-MOTOR-05** | ~~Sobreestimación crónica de N2 por niebla.~~ **CERRADA el 29/10/2026 (DEC-012, commits `6fd6120`, `aabdd30`, `4204b80`, `03a91a6`).** La niebla deja de disparar nivel. Se expone como `contexto.niebla`. Impacto esperado en producción: N2 pasa de 227 a ~10. | 🔴 | Alto | ✅ **Cerrada** | P9+P10 del 29/10/2026 |
| **H-DIAG-04** | ~~Causa raíz desagregada.~~ **CERRADA el 29/10/2026 (DEC-012).** Las 4 causas raíz (N-MOTOR-11, N-MOTOR-13, N-MOTOR-14, N-MOTOR-15) quedan cerradas porque el criterio `min(24h)` deja de disparar nivel. | 🔴 | Alto | ✅ **Cerrada** | P9–P12 del 29/10/2026 |
| **N-MOTOR-09** | **Acoplamiento hidro-térmico contado dos veces.** `crossThreatOrchestrator.js` suma `calcularAcoplamiento(rH, rT, 0.15)` **y** `calcularAcoplamiento(rT, rH, 0.10)` sobre el mismo producto simétrico. Confirmado con P2: escenario `rH=2.97, rT=2.88, rV=rC=1.0` → `riesgo_continuo = 3.90` vs `3.53` que predice la fórmula de §9.1. **Sobrestima +0.37 en ese caso, +0.9 en escenarios altos.** **Naturaleza: diseño ambiguo, no bug.** ADR-005 lista ambos γ sin aclarar si es uno o dos términos. Requiere ADR de reemplazo (PEND-06). | 🟠 | Bajo | Abierta, **requiere ADR** | P2 del 29/10/2026 |
| **N-MOTOR-11** | **La visibilidad no se consensúa porque ICON y GEM no la proveen.** Open-Meteo devuelve `visibility_gfs_seamless` con 240 valores válidos y `visibility_icon_seamless`/`visibility_gem_seamless` con 240 `null`. Confirmado con P11 en Xicotepec (28/10/2026): GFS `min=60 m, max=24,140 m, prom=18,338 m`; ICON y GEM todos `null`. **La variable que dispara 95.6 % de las alertas N2 depende de un único modelo**, contra ADR-002 (consenso determinista). | 🟠 | Medio | Abierta, **crítica bajo DEC-011** | P11 del 29/10/2026 |
| **N-MOTOR-13** | **Regla 6 usa `Math.min(ventana 24 h)` sin persistencia.** Un solo valor `visibilidad ≤ 2 km` en cualquier hora de las próximas 24 dispara N2 para toda la zona. Confirmado con P12 en Xicotepec: hoy la niebla ocurrió a las 00:00–01:00 (0.2 y 0.5 km), el resto del día >6 km, y el sistema sigue emitiendo "Vigilancia por Niebla Densa" a las 19:00. **Causa raíz principal de H-MOTOR-05.** Absorbe la hipótesis previa N-MOTOR-10. | 🔴 | Medio | Abierta, **crítica bajo DEC-011** | P12 del 29/10/2026 |
| **N-MOTOR-14** | **El motor no distingue evento actual de evento futuro.** La ventana de 24 h incluye horas ya pasadas y horas futuras indistintamente. La alerta de niebla pierde sentido cuando el evento ocurrió hace 19 horas. Bajo DEC-011, una alerta debe ser accionable en el momento de la consulta. | 🟠 | Medio | Abierta | P12 del 29/10/2026 |
| **N-MOTOR-15** | **Regla 6 usa OR sin contexto agravante.** `lluvia >= 8 OR saturación >= 30 OR visibilidad <= 2`. A diferencia de las reglas 2-5 que exigen combinación (pendiente + saturación + lluvia), la Regla 6 dispara N2 con una sola señal. Para eventos severos (N3/N4) es aceptable; para vigilancia N2 es demasiado laxo bajo DEC-011. | 🟠 | Bajo | Abierta | P12 del 29/10/2026 |
| H-SMN-WS | El scraping del SMN depende del HTML de la página oficial, que puede cambiar sin aviso. Migrar al servicio oficial de CONAGUA. | 🟠 | Medio | Abierta | `03` §2.4 |
| H-BITACORA-02 | Concurrencia entre los cuatro escritores de bitácora (`ejecutar_sara_autonomo.mjs`, `reporteDiario.mjs`, `api/reporte-ondemand.js` y `api/sara.js`). Si dos corren al mismo tiempo, el último en hacer `put` pisa la cadena del otro. **No se ha manifestado en 2 días de producción; verificado íntegro 23/23 eslabones el 29/10/2026.** Riesgo latente. | 🟡 | Alto | Abierta | Análisis de H-BITACORA-01 + P6 |
| H-CONV-02 | `convectiveEvaluator.js` mide `shearMax` como diferencia escalar de velocidades, sin dirección. Falsos negativos de downburst/supercélula posibles con cambio de dirección. Corregir requiere agregar `wind_direction_10m` y `wind_direction_700hPa` al fetcher y al consenso. | 🟡 | Alto | Abierta | `03` §7.1 |
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
| **H-REPORTE-02** | ~~El reporte diario nunca se ha entregado.~~ **CERRADA el 29/10/2026 (commit `b22772b`).** `reporteDiario.mjs` migrado de `@vercel/blob` a `escribirJSONBlob` de Google Drive. El reporte se genera y se guarda en Drive cuando la API de Groq responde. El bloqueador residual (429 de concurrencia) se gestionará en el próximo bloque de resiliencia. | 🔴 | Medio | ✅ **Cerrada (código migrado)** | P5 del 29/10/2026 |
| **H-REPORTE-03** | ~~Reintento silencioso 8×/día.~~ **CERRADA el 29/10/2026 (commit `b22772b`).** Al escribir la bitácora correctamente, `debeGenerarReporteDiario` ya detecta la entrada del día y no reintenta. El silencio residual por el 429 se abordará en el bloque de resiliencia. | 🔴 | Bajo | ✅ **Cerrada** | P5 del 29/10/2026 |
| **N-CRON-05** | ~~Doble disparador redundante.~~ **CERRADA el 29/10/2026 (ADR-010).** Los dos disparadores son **deliberados**. Se documentan como capa de seguridad en `00_METODOLOGIA.md` Fase 4 y `07_GUIA_OPERACION.md` §1.2. No se toca código. | 🟠 | Bajo | ✅ **Cerrada** | P7 del 29/10/2026 |
| **N-CRON-06** | ~~El `on.schedule` interno no está documentado como activo.~~ **CERRADA el 29/10/2026 (ADR-010).** Se documenta en Fase 4 y §1.2 como respaldo deliberado. | 🟠 | Bajo | ✅ **Cerrada** | P7 del 29/10/2026 |
| **H-PKG-01** | **Zod 4 con `.errors` en el runner.** `ejecutar_sara_autonomo.mjs:635` usa `validacion.error.errors`, campo eliminado en Zod 4. Confirmado con P1: Zod 4.6.5 instalado, `safeParse` inválido → `error.issues` tiene contenido, `error.errors` es `undefined`. El runner imprime `❌ [ZOD] El paqueteMaestro no cumple el schema: undefined` y hace `process.exit(1)`. **No es fallo silencioso** (el workflow falla en rojo), pero el diagnóstico es inútil. **Reclasificada de 🔴 crítica a 🟠 alta** tras verificar que `exit(1)` funciona. | 🟠 | Bajo | Confirmada, abierta | P1 del 29/10/2026 |
| **N-OPS-01** | **Escalabilidad de Apps Script no documentada.** `SatRCOperativo.jsx` refresca `/api/sara` cada 5 min × 3 reads = **36 requests a Drive por hora por operador activo**. Con 2 operadores, ~1,700 requests/día solo para mantener pantalla. Apps Script gratuito tiene cuotas que pueden saturarse. | 🟠 | Bajo | Abierta |
| **N-OPS-02** | **`construirResumenAtmosferico` duplicada con contratos divergentes.** Existe en `SatRCOperativo.jsx` y en `reportesRegionales.js` con **nombres de campo distintos**: `lluvia_acumulada_24h_mm`/`lluvia_proyectada_prox_24h_mm` vs `lluvia_ayer_24h_mm`/`lluvia_hoy_24h_mm`/`lluvia_manana_24h_mm`. Viola ADR-004. | 🟠 | Bajo | Abierta |
| **H-DRIVE-01** | **Reformulada como riesgo latente, no activo.** `escribirJSONBlob` devuelve `null` en fallo sin propagar error. El runner imprime `✅ Publicación exitosa` ciegamente. **Verificado el 29/10/2026 (P4): la lectura y escritura de Drive funcionaron correctamente hoy** (`actualizado_iso: 2026-10-29T01:03:45Z`, timestamp reciente y coherente). La deuda es de riesgo futuro, no de bug activo. | 🔴 | Bajo | Abierta como **riesgo latente** | P4 del 29/10/2026 |
| **H-DRIVE-05** | Vercel recibe HTTP 401 al intentar escribir en Drive (Apps Script). Ocurre porque Node.js hace un POST con `Content-Type: application/json` y Google responde con un redirect 302 que rompe la autenticación. **No se ha manifestado en la verificación del 29/10/2026, pero el código sigue con `application/json`.** Riesgo latente. | 🔴 | Bajo | Abierta | Logs Vercel 28/10/2026 |
| **H-DRIVE-04** | `googleDrive.js` no valida el formato de `GOOGLE_SCRIPT_URL`. Si el usuario ingresa una URL redirigida (`script.googleusercontent.com`) en lugar de la canónica (`script.google.com/macros/s/.../exec`), las peticiones fallan silenciosamente. Debe lanzar un error claro al inicio si la URL no cumple el patrón. | 🟠 | Bajo | Abierta | Incidente 28/10/2026 |
| **H-ONDEMAND-01** | `tokenConsolaValido()` en `reporte-ondemand.js`: `if (!esperado) return true`. Si alguien configura `SARA_ONDEMAND_TOKEN` en Vercel, el endpoint **rompe todos los reportes on-demand** porque el frontend nunca lo envía. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-05** | `TIMEOUT_GROQ_MS = 8000` es demasiado alto. Con 2 reads + 1 Groq (8s) + 2 writes a Drive, se supera fácilmente el timeout de 10s de Vercel Hobby. Debe bajarse a 6000 o dividir la operación. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-03** | `escribirJSONBlob('reporte_diocesano_vigente.json')` no verifica el retorno. `guardadoEnBlob = true` se asigna siempre, incluso si Drive falló. | 🔴 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-DRIVE-02** | El runner escribe `estado_ligero.json` sin validarlo con Zod. El paquete ligero puede contener `evaluaciones: []` o `null`. Debe agregarse un `EstadoDiocesanoLigeroSchema`. **Los 2 tests rojos del baseline (P0) son evidencia de que este cambio de schema se aplicó sin actualizar los tests.** | 🟠 | Medio | Abierta | Análisis 28/10/2026 + baseline |
| **H-SARA-05** | `bitacoraLeida = true` en el `else` de `sara.js`: si `leerJSONBlob` falla transitoriamente, el código marca la bitácora como "leída" y **sobrescribe la cadena con historial vacío**. Rompe el `prev_hash`. **Verificado en el código actual: el símbolo `bitacoraLeida` no existe.** La deuda describe una versión anterior. **Requiere verificar en `git log` si la deuda está obsoleta.** | 🟠 | Medio | **Posiblemente obsoleta** | Análisis 28/10/2026 |
| **H-ONDEMAND-04** | `escribirJSONBlob('bitacora_sara.json')` no verifica el retorno. Devuelve `bitacora_actualizada` como si hubiera guardado. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-06** | `max_completion_tokens: 2500` en el on-demand (vs. 4096 en el diario) puede cortar el JSON en reportes complejos. Debe unificarse a 4096. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-07** | `esParcialReal` se calcula del payload del cliente. El backend confía en el frontend. Si un cliente envía `zonas_ok: 14` con 5 zonas reales, se guarda como completo. | 🟠 | Medio | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-08** | Si falla `leerJSONBlob('bitacora_sara.json')`, `bitacoraHistorial = []` y `hashUltimo = BLOQUE_GENESIS` → **reinicia la cadena SHA-256**. | 🟠 | Bajo | Abierta | Análisis 28/10/2026 |
| **H-ONDEMAND-09** | Si escribe el reporte OK pero falla la bitácora, hay inconsistencia. No hay rollback. **P5b del 29/10/2026 evaluó y REFUTÓ la manifestación** para el caso del 28/10 (bitácora `SARA_LOG_20` existe, coincide con el reporte, cadena íntegra). Se mantiene como riesgo latente. | 🟠 | Medio | **Riesgo latente, no confirmado** | Análisis 28/10/2026 + P5b |
| **N-OPS-04** | El modal de bitácora en `SatRCOperativo.jsx` muestra hardcodeado `"Almacén en Vercel Blob"`. **Ya no es Blob, es Drive desde el 27/10/2026.** | 🟡 | Bajo | Abierta |
| **N-OPS-05** | El modal de bitácora no muestra `hash_completo` ni `prev_hash`, solo `hash` truncado (16 chars). Bajo ADR-003 ("la integridad depende de que quien revisa recalcule la cadena"), el operador no tiene información suficiente para auditar. | 🟡 | Bajo | Abierta |
| **N-OPS-07** | `descargarDocumentoOficial` en `SatRCOperativo.jsx` hardcodea `"REPORTE DIOCESANO DE SITUACIÓN METEOROLÓGICA (ON-DEMAND)"` en el título del archivo descargado, incluso si el reporte vigente es automático. | 🟢 | Bajo | Abierta |
| **H-DRY-01** | `generarHashSHA256` + `siguienteIdBitacora` reimplementados en 3 archivos en lugar de importar `calcularNuevaEntradaBitacora`. Viola ADR-004. | 🟡 | Medio | Abierta | Análisis 28/10/2026 |
| **H-API-06** | `api/auth-operativo.js` valida la clave contra una variable de entorno sin un sistema de sesiones. Cada petición que requiera autenticación de la Sala debe validar la clave de nuevo. | 🟡 | Medio | Abierta, V3.0 | Migración 27/10/2026 |
| H-ARCH-01 | Agregar un quinto evaluador exige tocar siete archivos. Propuesta: registro declarativo. | 🟡 | Medio | Abierta, V3.0 | `02` §10 |
| DEU-19 | Dependencia de planes gratuitos (Groq, Vercel, Open-Meteo, cron-job.org) sin plan de contingencia. Ahora se suma Google Drive (Apps Script). **N-CRON-05 y N-OPS-01 acentúan esta dependencia.** | 🟡 | Medio | Sin documentar | |
| DEU-28 | El test de regresión del runner verifica imports en código fuente en vez de ejecutarlo. Requiere refactor para permitir `dryRun`. | 🟡 | Medio | Abierta | |
| DEU-22 | Constante `TAMANO_LOTE = 4` declarada en **cuatro** archivos (no tres): `ejecutar_sara_autonomo.mjs`, `reportesRegionales.js`, `SatRCOperativo.jsx` y `reportesRegionales.js` (el mismo archivo la define dos veces en distintas funciones). Viola ADR-004. | 🟢 | Bajo | Abierta | `02` §4 + análisis 29/10/2026 |
| H-INFRA-01 | No existe `vercel.json`; el despliegue usa detección automática. | 🟢 | Bajo | Abierta, V3.0 | `02` §10 |
| H-NOM-01 | `procesar_datos.cjs` escribe `version: "3.0"`, y `package.json` se llama `satrc-v3`. | 🟢 | Bajo | Abierta | Revisión documental |
| H-API-02 | `disparar-workflow.js` no registra IP ni agente de usuario de las peticiones. | 🟢 | Bajo | Abierta | |
| H-API-05 | `latest-gif.js` no tiene respaldo si NOAA cambia el patrón de nombres. | 🟢 | Bajo | Abierta | |
| **N-API-SMN-01** | `api/smn.js` retorna `color: "#EF4444"` o `"#F59E0B"` en el objeto `alerta`. `OfficialAlertBanner.jsx` **no lo consume**. Código muerto. | 🟢 | Bajo | Abierta |
| **N-API-SMN-03** | `api/smn.js` retorna `exito: false` con `alerta: { activo: false, nivel: 1, titulo: "SMN no disponible" }` cuando el SMN falla. `OfficialAlertBanner.jsx` lo trata como "condiciones normales", sin distinguir de "sin aviso real". | 🟠 | Bajo | Abierta |
| **N-API-NOAA-01** | `Cache-Control: s-maxage=300` cachea el 404 durante 5 min si NOAA cae. | 🟢 | Bajo | Abierta |
| **N-API-NOAA-02** | El producto `glmFed` (GLM) probablemente no emite `-1000x1000.gif` estándar. 404 silencioso para ese producto. | 🟢 | Bajo | Pendiente verificar |
| **N-API-GH-01** | `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_REF` hardcodeados en `disparar-workflow.js`. No variables de entorno. | 🟢 | Bajo | Abierta |
| DEU-30 | `normalizarDatosRegionales` cae a `14` con `\|\|` si `zonas_totales` es `0`, ocultando problemas reales. | 🟢 | Bajo | Abierta | |
| **H-CRON-01** | `sara_cron.yml` no tiene un pre-check explícito de `GROQ_API_KEY` y `GOOGLE_SCRIPT_URL` antes de ejecutar el runner. **`BLOB_READ_WRITE_TOKEN` ya no aplica** (el runner migró a Drive). | 🟢 | Bajo | Abierta | |
| H-CI-01 | `tests.yml` no corre `npm run build`. Si se rompe un import en un componente React, `npm test` no lo detecta. | 🟢 | Bajo | Abierta | |
| **N-RESILIENCIA-429** | **Falla silenciosa del reporte diario ante 429 de Groq.** El runner hace 2 llamadas seguidas a Groq (dictamen + reporte diario) con ~5s de diferencia. Groq devuelve 429 por protección de concurrencia. El `try/catch` lo absorbe y la corrida queda en verde. **Bajo DEC-011, el reporte diario no puede fallar silenciosamente.** Solución pendiente: separar las llamadas + backoff + fallo visible del runner. | 🔴 | Medio | Abierta (bloqueador para próxima sesión) | P10 del 29/10/2026 |

### 2.5 Pruebas y calidad

> **Baseline verificado el 29/10/2026 (P0):**
> - `npm test` → **165 pass + 2 rojos conocidos** en 17 archivos (no 167 verdes como decía la versión 2.7). Los 2 rojos son `estadoDiocesanoSchema.test.js` "rechaza evaluaciones vacías []" y `regresionFase1.test.js` Test 5 "rechaza payload sin evaluaciones". Ambos fallan por el cambio de schema `3053e29` que relajó `.min(1)` para aceptar `[]` (H-DRIVE-02/H-SCHEMA-02), **sin actualizar los tests en el mismo commit**. Viola `00_METODOLOGIA.md` Fase 5.
> - `npm run lint` → **55 advertencias, 0 errores** (no 51). Las adicionales corresponden a warnings de React Hooks y pureza, no solo `no-unused-vars`.
> - `npm run build` → verde, 853.44 kB / 201.79 kB gzip. Warning benigno de chunk > 500 kB.

| ID | Deuda | Sev. | Esfuerzo | Estado |
|---|---|---|---|---|
| DEU-16 | La regla de `node --check` antes del commit no se aplica en CI. | 🟡 | Bajo | Abierta |
| DEU-17 | `tests.yml` solo ejecuta Vitest; no valida `api/` ni `scripts/*.mjs`. | 🟡 | Bajo | Abierta |
| **N-CI-03** | **`tests.yml` no corre `node --check` ni `npm run build`.** Un error de sintaxis en `api/sara.js` o un import roto en `src/` puede llegar a `main` sin detección. La única garantía es la verificación manual documentada en `07_GUIA_OPERACION.md` §5. Bajo `00_METODOLOGIA.md` Fase 3, esto es una violación estructural de la verificación de efecto real. | 🟠 | Bajo | Abierta |
| **H-PROCESO-03** | **Lección de P5b del 29/10/2026.** Un filtro PowerShell (`-like 'ON_DEMAND*'`) devolvió vacío y se interpretó como "0 entradas ON_DEMAND". La cronología completa (P6) reveló que `SARA_LOG_20` sí existe. **Un filtro vacío no es evidencia de ausencia de datos.** Antes de concluir "no hay X", verificar con consulta sin filtros y cruzar con otra fuente. Los datos de Apps Script pueden tener encoding distinto al esperado. | 🟡 | — | Lección registrada |
| **N-TEST-01** | `thermalEvaluator.test.js`, `crossThreatOrchestrator.test.js`, `consensusEngine.test.js` y `windEvaluator.test.js` usan `require('fs')` y `require('path')` en archivos ESM con `"type": "module"`. Vitest 5 provee polyfill, pero es frágil si se corre con `node --test` o `vitest --no-isolate`. | 🟡 | Bajo | Abierta |
| **N-TEST-07** | El test "Downburst N4" en `crossThreatOrchestrator.test.js` se llama así, pero **el downburst no se dispara** (`shearMax = 20-10 = 10 < 15`). El N4 viene por acoplamiento convectivo-viento con `rC = 2.47, rV = 3.70`. El test valida el número pero **no valida el subtipo `DOWNBURST`**. Cobertura semántica insuficiente. | 🟡 | Bajo | Abierta |
| **N-TEST-08** | Sin cobertura de `null` en `humedad_700hpa` (N-MOTOR-06 confirmado por lectura de `convectiveEvaluator.js`: `Math.min(...humedades, 100)` con `null` produce `0`). | 🟡 | Bajo | Abierta |
| **N-TEST-09** | `datos_disponibles_por_vector` sin cobertura en `estadoDiocesanoSchema.test.js`. Confirma H-TEST-11. | 🟡 | Bajo | Abierta |
| H-TEST-07 | Los módulos que emiten valores continuos deben documentar su rango `[mín, máx]`. La deuda de H-TERM-01 vino de no cumplirlo. | 🟡 | — | Lección; H-TERM-01 ya cerrado aplicándola |
| H-TEST-11 | `datos_disponibles_por_vector` no tiene cobertura en `estadoDiocesanoSchema.test.js`. | 🟡 | Bajo | Abierta |
| DEU-18 | Conteo de pruebas inconsistente entre documentos. **Resuelto parcialmente el 29/10/2026 con P0: cifra real 165 pass + 2 rojos obsoletos.** Actualizar `07_GUIA_OPERACION.md` §5 y `LEEME_PRIMERO.md` §2 al cerrar el próximo hito. | 🟢 | Bajo | Documental, en curso |
| H-TEST-06 | Las pruebas nuevas deben verificar la aritmética del escenario antes de asumir un error de código. | 🟢 | — | Lección |
| H-ORQ-08 | `determinarVectorDominante()` usa `prioridad.indexOf(a)` sobre un array en mutación durante el `sort`. Anti-patrón frágil. | 🟢 | Bajo | Abierta |
| **H-SCHEMA-01** | `EstadoDiocesanoBlobSchema` tiene `schema_version` con `.default("2.1.0")`, pero el runner no emite el campo. **Confirmado empíricamente el 29/10/2026:** al leer `estado_diocesano.json` de Drive, `schema_version` viene **vacío**. | 🟢 | Bajo | **Confirmada empíricamente, abierta** |

### 2.6 Prompts de SARA

> **Confirmación P3 del 29/10/2026:** grep sobre `scripts/reportes/reporteDiario.mjs` → **0 coincidencias** de la regla 17. Grep sobre `api/reporte-ondemand.js` → **1 coincidencia** en la línea 189. Asimetría confirmada por evidencia dura.

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| **H-PROMPT-06** | ~~El `systemPrompt` del diario no tiene la regla de control de emergencias.~~ **CERRADA el 29/10/2026 (Commit `4204b80`).** Se agregó la regla 17 al `systemPrompt` del diario en `scripts/reportes/reporteDiario.mjs` línea 178. Numeración alineada con on-demand. | 🔴 | Medio | ✅ **Cerrada** | P3 del 29/10/2026 |
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
| H-MULTI-06 | El respaldo en vivo de la Sala Operativa usa solo el motor hidrológico. **Confirmado en `SatRCOperativo.jsx` `ejecutarEvaluacionRealEnVivo`.** | 🟡 | Medio | Abierta | Verificación §2.7 |

### 2.8 Calidad del código (verificación del 29/10/2026)

| ID | Deuda | Sev. | Esfuerzo | Estado | Fuente |
|---|---|---|---|---|---|
| DEU-24 | `npm run lint` reporta **55 advertencias y 0 errores** (no 47). Incluye imports sin uso en `api/sara.js` (`escribirJSONBlob`, `generarTituloDictamen`, `BLOQUE_GENESIS`, `MAX_REGISTROS_BITACORA`, `ESTADOS`, `generarHashSHA256`, `normalizarEstadoSituacion`, `siguienteIdBitacora`), variables sin uso (`esModoEmergencia`, `esMarginacionAlta`, `altitud`), imports masivos sin uso en `SatRCOperativo.jsx` y `RiskMap.jsx`, y `require` en tests ESM. | 🟢 | Bajo | Abierta | P0 lint del 29/10/2026 |
| DEU-25 | Código muerto en `reportesRegionales.js`: `TIMEOUT_FETCH_MS` y `STAGGER_MS` sin uso. | 🟡 | Bajo | Abierta | Lint local |

### 2.9 Deudas documentales

| ID | Deuda | Sev. | Estado | Fuente |
|---|---|---|---|---|
| **H-DOC-BASELINE-01** | `07_GUIA_OPERACION.md` §5 y `LEEME_PRIMERO.md` §2 dicen "167 pruebas en verde". La realidad verificada el 29/10/2026 es "165 pass + 2 rojos obsoletos". Actualizar antes del cierre del siguiente hito. | 🟠 | Abierta | P0 del 29/10/2026 |
| **H-DOC-BASELINE-02** | `07_GUIA_OPERACION.md` §5 dice "51 advertencias". La realidad es "55 advertencias". Actualizar antes del cierre del siguiente hito. | 🟡 | Abierta | P0 lint del 29/10/2026 |
| H-DOC-HVIENTO-01 | **H-VIENTO-01** está declarado cerrado en `03_MOTOR_RIESGO.md` y en `06_PENDIENTES.md` §3, pero **`04_HISTORIAL.md` §6.1 lo cierra incorrectamente** diciendo "el código nunca implementó ni el suavizado ni el factor de rugosidad". **Falso:** `windEvaluator.js` líneas 43-45 implementan factor de rugosidad (LADERA=1.1, LOMA=1.05). Falta el registro formal de cierre **correcto** en `04_HISTORIAL.md`. | 🟠 | Abierta | Análisis 28/10/2026 + verificación 29/10/2026 |
| H-DOC-H6.6 | `04_HISTORIAL.md` L188 y L403 mencionan H6.6 como "abierto" en dos notas históricas, mientras `06_PENDIENTES.md` y `02_ARQUITECTURA.md` §3.1 lo declaran cerrado. Inconsistencia cruzada. | 🟠 | Abierta | Análisis 28/10/2026 |
| H-DOC-REF-02 | `03_MOTOR_RIESGO.md` L352 referenciaba `02_ARQUITECTURA.md §8`, que no existía tras el commit `cd68564`. Ya resuelto en los bloques 2.6 de `02` y 2.7 de `03`. | 🟢 | Cerrado | Análisis 28/10/2026 |
| H-DOC-MOJI-02 | Posible mojibake en `02` y `03`. **Probablemente falso positivo de PowerShell** (UTF-8 mal decodificado en consola). Verificar en editor UTF-8. | 🟢 | Pendiente de verificar | Análisis 28/10/2026 |
| H-DOC-GIT-01 | `salida_lint.txt` y `salida_npm_test.txt` no están en `.gitignore`. **Añadir también `salida_test_baseline.txt`, `salida_lint_baseline.txt` y `salida_build_baseline.txt`** generados el 29/10/2026 en P0. | 🟡 | Abierta | P0 del 29/10/2026 |
| H-DOC-ASSETS-01 | `src/assets/` contiene 3 archivos sin referencias en el código (`hero.png`, `react.svg`, `vite.svg`). Residuos de Vite. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-TEST-01 | Carpetas vacías: `src/lib/__tests__/` y `test/`. Purgar o poblar. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-PS1-01 | `scripts/diagnostico/*.ps1` son 10 scripts de diagnóstico histórico. Decidir si archivar o eliminar. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-EXT-01 | `12_E4_THERMAL_EVALUATOR.MD` tiene extensión en mayúsculas. Renombrar a `.md`. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-README-01 | `README.md` menciona los docs `00`-`08` pero no `09` ni `VERIFICACION_MULTIFACTOR.md`. Tiene mojibake pendiente. | 🟢 | Abierta | Análisis 28/10/2026 |
| H-DOC-PUBLIC-01 | `public/` (manifest, service worker, íconos PWA) no estaba documentado en el doc 09 v1.0. Ya agregado en v2.0. | 🟢 | Cerrado | Análisis 28/10/2026 |
| H-DOC-DIAGEXT-01 | `diagnostico_externo/` no estaba documentado en el doc 09 v1.0. Ya agregado en v2.0. | 🟢 | Cerrado | Análisis 28/10/2026 |
| **H-DOC-PWA-01** | `LEEME_PRIMERO.md` §2 y `09_ARBOL` §1.5 dicen "cache offline parcial" de la PWA. **Confirmado en `sw.js`:** es **Network-Only puro**, no cachea. La PWA no funciona offline. | 🟠 | Abierta | P0 del 29/10/2026 |

### 2.10 Re-auditoría de invierno pendiente

En la verificación del 27/10/2026, las 405 localidades tenían `niveles_por_vector.termico = 1.0` (no hay frío en octubre). El impacto del fix de H-TERM-01 en el semáforo se medirá en la primera corrida de invierno que dispare el térmico. Si la subida de N3 supera el 30 %, evaluar recalibración del peso (commit B2 separado).

### 2.11 Deudas nuevas detectadas en la auditoría documental del 29/10/2026 (pendientes de verificación empírica)

> Estas deudas fueron identificadas por lectura cruzada de código, docs y datos durante la fase de contexto (45+ archivos). No todas se han verificado en producción. Se documentan para no perderlas, con el estado de verificación explícito.

| ID | Deuda | Sev. | Estado verificación |
|---|---|---|---|
| **N-MOTOR-01** | Ráfagas se consensúan con `Math.max(r_gfs, r_icon, r_gem)` en `consensusEngine.js`. ADR-002 solo autoriza máximo para `cape` y `wind_speed_700hPa`. **Sobrestima sistemáticamente el vector viento.** | 🟠 | Verificado en código |
| **N-MOTOR-24** | `calcularUmbralDeslave` calcula un umbral dinámico (`65 - pendiente*0.85 - factorRelieve`) que **nunca se usa en las reglas**. Las Reglas 2 y 3 usan `65.0` fijo. `impactoSistemico.umbralFisicoDeslaveMm` miente en auditoría. | 🟠 | Verificado en código |
| **N-MOTOR-28** | El piso del aviso SMN (`Math.max(lluviaEfectiva, pisoSMN)`) es una fuente de sobreestimación no catalogada bajo DEC-011. `riskEvaluator.js` línea 71. | 🟠 | Verificado en código |
| **N-MOTOR-29** | `tipoAmenaza: "ESTABLE"` (Regla 1) y `"VIGILANCIA_NORMAL"` (Regla 6) no coinciden con `03_MOTOR_RIESGO.md` §9.4 (`PROTECCION_ALTIPLANO`, `VIGILANCIA`). Desalineación de contrato. | 🟠 | Verificado en código |
| **N-MOTOR-30** | `umbralFisicoDeslaveMm` reportado en el diagnóstico no coincide con el umbral (65.0) realmente usado en la decisión. Confunde auditoría. | 🟡 | Verificado en código |
| **N-MOTOR-36** | La causa del diagnóstico de viento reporta `rafagaMax` (real), no `vEqFinal` (normalizada). El texto al operador puede decir "ráfagas de X km/h superan umbral 95" con X < 95. Incoherente. | 🟡 | Verificado en código |
| **N-MOTOR-05-bis** | SPP (43 localidades) y HYC (13) tienen perfil `Aw`/`LADERA` similar a XIC/HUA/ZAC, pero no aparecen en la lista original de H-MOTOR-05. Probablemente también sobre-clasificadas. **Confirmado por P9: ambas zonas están al 100 % en N2 hoy.** | 🔴 | Confirmado por P9, candidata a fusión con H-MOTOR-05 |
| **N-MOTOR-08-bis** | Regla 4 (inundación) no pondera por `tc_horas`. Sobrestima cuencas lentas (Zacatlán, tc=24) y subestima cuencas rápidas (Chahuatlán, tc=4.75). Bajo DEC-011, doble error sistemático. | 🟠 | Verificado en datos |
| **N-DICT-01** | `generarTituloDictamen(2, 'SIN_AMENAZA')` produce `"Vigilancia por Condiciones Normales"` (contradictorio). La tabla `NOMBRES_VECTOR` asume `SIN_AMENAZA` solo en N1. | 🟡 | Verificado en código |
| **N-DICT-02** | Sin test que verifique que `NOMBRES_VECTOR` cubre todos los vectores que el orquestador puede emitir. | 🟡 | Verificado en código |
| **N-REG-02** | `construirBloqueRegional` hardcodea `"ventana 72h"` en el encabezado incluso en on-demand (que es 48h). El modelo puede repetir el error de ventana. | 🟡 | Verificado en código |
| **N-REG-03** | Si `resumenes` está vacío pero `zonas_fallidas` no, `construirBloqueRegional` no menciona el fallo. Rompe la regla 14 del diario ("declarar zonas sin datos"). | 🟡 | Verificado en código |
| **N-VITE-01** | `vite.config.js` sin proxy para `/api`. Desarrollo local de endpoints requiere `vercel dev`, no `npm run dev`. No está documentado en `00_METODOLOGIA.md` ni `07_GUIA_OPERACION.md`. | 🟡 | Verificado |
| **N-AUTH-01** | `App.jsx` sin sesión persistente. Cerrar pestaña = cerrar sesión. Fricción operativa. | 🟢 | Verificado en código |
| **N-FEC-01** | `formatearTimestamp` retorna `null` sin guarda en el JSDoc. Consumidores pueden renderizar "null" en pantalla. | 🟢 | Verificado en código |
| **N-MOJ-01** | `mojibake.js` no detecta mojibake de caracteres de 4 bytes UTF-8 (emoji, CJK). Marginal para el dominio español. | 🟢 | Verificado en código |
| **N-MOJ-02** | `repararMojibake` silenciosa si no repara. No auditable cuándo se aplicó. | 🟢 | Verificado en código |
| **N-NODOS-01** | Desempate por orden de iteración si empatan poblaciones. Sin empate hoy, pero frágil. | 🟢 | Verificado en código |

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
- **H-RUNNER-01:** Renombrado a **H-REPORTE-02**. El runner ya usa Drive; el que falla es `reporteDiario.mjs`.
- **H-SARA-02:** Cerrado el 28/10/2026 (commit `2a3e3e8`). El runner ya no envía `evaluaciones: null` en días tranquilos, envía `[]`.
- **H-DRIVE-02 (Zod schema):** Cerrado el 28/10/2026 (commit `3053e29`). **Sin embargo, este cambio dejó 2 tests rojos sin actualizar (ver H-DOC-BASELINE-01).** La deuda de schema está cerrada; la deuda de tests obsoletos queda abierta.
- **Incidente de producción 28/10/2026:** Cerrado. Causa raíz: URL de Vercel mal copiada + Zod estricto + runner enviando null.
- **H-ENTORNO-01 (Entorno local):** Cerrado el 28/10/2026. Se configuró y validó el archivo `.env.local` con las 8 variables críticas. **Confirmado el 29/10/2026 con P0: el archivo existe con las 8 variables esperadas.**
- **H-SARA-01, H-SARA-03, H-SARA-04:** Cerrados el 28/10/2026 (commit `b25d7c5`). Se eliminó el fallback de `api/sara.js` que devolvía "Calma" falsa, escribía bitácora con `origen_evento: PROGRAMADO_CRON` y consumía Groq en cada lectura. Ahora el endpoint devuelve un `503` honesto (`SISTEMA_NO_DISPONIBLE`) cuando Drive falla o Zod rechaza.
- **H-ONDEMAND-09 (para el caso del 28/10/2026):** **REFUTADA la manifestación** por P5b. La bitácora `SARA_LOG_20` (ON_DEMAND_OPERADOR, 28/10 17:24:58) existe, coincide exactamente con `reporte_diocesano_vigente.json`, y la cadena SHA-256 está íntegra (23/23 verificada por P6). Se mantiene como riesgo latente, no como bug activo.
- **H-PKG-01:** Cerrado el 29/10/2026 (commit `6fd6120`/F1). Se corrigió `validacion.error.errors` → `validacion.error.issues` en el runner. Zod 4 eliminó `.errors`; el log ahora imprime el path exacto del campo que falla.
- **N-PROMPT-JSON-01:** Cerrado el 29/10/2026 (commit `5b2d70b`). El prompt del on-demand no forzaba los nombres de las llaves del JSON. El modelo devolvía `"SECCION 0"`, el frontend esperaba `"seccion_0_decision"` y la pantalla salía vacía. Se agregó el bloque de JSON de ejemplo y un mapeo defensivo en `api/reporte-ondemand.js` y `scripts/reportes/reporteDiario.mjs`.

---

## 4. Prioridades propuestas bajo DEC-011

Estas prioridades están propuestas, no aprobadas. Se confirman antes de comenzar el trabajo.

> **Bajo DEC-011 (precisión sobre cobertura), el orden de ataque cambia respecto a la v2.7.** El criterio es: primero lo que reduce falsos positivos publicados, después lo que reduce ruido interno, después la deuda latente.

1. **Inmediato (crítico bajo DEC-011): H-MOTOR-05 + H-DIAG-04 + N-MOTOR-11/13/14/15.** Requiere decisión de coordinación técnica + pastoral (**PEND-06**): qué criterio operativo debe disparar N2 por niebla. Sin esta decisión, el fix es a ciegas. Estimación de impacto: 217 falsos positivos diarios eliminados.
2. **Inmediato (crítico operativo): H-REPORTE-02 + H-REPORTE-03.** El reporte diario automático no se ha entregado ni una vez desde el 27/10. Migrar `reporteDiario.mjs` a `googleDrive.js` y corregir el reintento silencioso.
3. **Inmediato (agrava #2): H-PROMPT-06 + H-PROMPT-09.** Al arreglar el diario, este saldría sin la regla 17 y podría generar lenguaje de emergencia con N1/N2. Corregir los prompts en el mismo lote que H-REPORTE-02.
4. **Corto plazo: N-CRON-05 + N-CRON-06.** Decidir si el `on.schedule` interno se mantiene como respaldo (documentado) o se elimina (**PEND-07**). Actualmente hay doble disparador no documentado.
5. **Corto plazo: N-MOTOR-09.** Requiere ADR de reemplazo (**PEND-06** o ADR específico). Naturaleza: diseño ambiguo, no bug.
6. **Corto plazo: H-PKG-01.** Cambiar `validacion.error.errors` a `.issues` en `ejecutar_sara_autonomo.mjs`. Una línea. Bajo riesgo.
7. **Corto plazo: N-UI-01.** Mostrar el semáforo N1–N4 en el Monitor Público incluso en días tranquilos. Bajo DEC-011, no mostrar el semáforo no es "sin alerta", es "sin datos visibles".
8. **Corto plazo: N-CI-03 + H-CI-01 + DEU-16/17.** Añadir `node --check` y `npm run build` a CI. Evita que un error de sintaxis llegue a `main`.
9. **Mediano plazo: R-03 (auth en `/api/sara`).** Confirmado activo por P5b.
10. **Mediano plazo: H-DRIVE-01 + H-DRIVE-04/05.** Reforzar el adaptador con validación de URL y propagación de errores. Riesgo latente.
11. **Mediano plazo: H-ONDEMAND-01, H-ONDEMAND-05, H-ONDEMAND-06.** Estabilizar el on-demand.
12. **Mediano plazo: N-OPS-01 + N-OPS-02 + N-OPS-04/05/07.** Reducir carga sobre Apps Script y actualizar el modal de bitácora.
13. **Mediano plazo: H-DRY-01, H-SARA-05 (verificar si obsoleta), H-ONDEMAND-03/04/07/08/09.** Consolidar bitácora y validaciones.
14. **Mediano plazo: N-MOTOR-01, N-MOTOR-08-bis, N-MOTOR-24, N-MOTOR-28, N-MOTOR-29, N-MOTOR-30, N-MOTOR-36.** Recalibración del motor bajo DEC-011.
15. **Mediano plazo: H-CONV-02, H-SMN-WS, H-MULTI-06, DEU-19, N-MOTOR-05-bis.**
16. **V3.0:** autenticación real, H-MOTOR-01, H-ARCH-01, H-VIENTO-02, N-VITE-01, N-AUTH-01, nuevos vectores.

---

## 5. Reglas para agregar pendientes

1. Un ítem nuevo entra aquí con identificador, severidad, estado y fuente.
2. Un bug resuelto no entra aquí: va a `04_HISTORIAL.md`.
3. Una decisión de diseño no entra aquí: va a `08_DECISIONES.md`.
4. Si un ítem depende de una decisión que no ha tomado la coordinación, se marca "Abierta, decisión de diseño" y no se trabaja sin confirmación.
5. Si un identificador se refiere a un hito de una etapa, se escribe la etapa cuando haya riesgo de confusión.
6. **Nuevo (29/10/2026):** toda deuda detectada por auditoría documental pero no verificada empíricamente se marca con su estado de verificación explícito en §2.11. Una deuda no verificada no tiene la misma prioridad que una confirmada por prueba empírica.

---

## 6. Decisiones pendientes

Estas decisiones requieren coordinación técnica + pastoral antes de poder ejecutarse. Se registran aquí para trazabilidad; se integran a `08_DECISIONES.md` cuando se tomen.

| ID | Pregunta | Quién decide | Origen |
|---|---|---|---|
| PEND-03 | ¿Los coeficientes de acoplamiento (ADR-005) se recalibran con eventos reales? Bajo DEC-011 esta calibración es prioritaria. | Coordinación técnica y pastoral | `08_DECISIONES.md` |
| PEND-04 | ¿Se migrará el runner a un modelo de ejecución que no dependa de GitHub Actions (por ejemplo, Vercel Cron)? | Coordinación técnica | `08_DECISIONES.md` |
| PEND-05 | ¿Cuál es la métrica objetivo de confiabilidad (porcentaje de alertas que se materializan) que cierra DEC-011? | Coordinación técnica y pastoral | `08_DECISIONES.md` |
| **PEND-06** | **¿Qué criterio operativo debe disparar N2 por niebla?** Opciones bajo DEC-011: (A) persistencia ≥ 4 h consecutivas; (B) ventana próxima 6 h en vez de 24 h; (C) niebla + otra condición (lluvia o saturación); (D) niebla ≤ 1 km con persistencia ≥ 2 h; (E) híbrido. Cada opción tiene implicaciones operativas distintas para las brigadas. **Bloquea el fix de H-MOTOR-05/N-MOTOR-13.** | Coordinación técnica y pastoral | P12 del 29/10/2026 |
| **PEND-07** | **¿El `on.schedule` interno de `sara_cron.yml` es un respaldo deliberado o se elimina?** Actualmente hay doble disparador no documentado (N-CRON-05 + N-CRON-06). | Coordinación técnica | P7 del 29/10/2026 |
| **PEND-08** | **¿Cómo debe resolverse N-MOTOR-09 (acoplamiento duplicado)?** Opciones: (A) un solo término con `HIDRO_TERMICO=0.15`; (B) un solo término con `TERMICO_HIDRO=0.10`; (C) mantener ambos pero reinterpretar (e.g., `HIDRO_TERMICO` para frío y `TERMICO_HIDRO` para calor, sumando condicionalmente); (D) fusión a un solo coeficiente con nuevo valor calibrado. **Naturaleza: diseño ambiguo, no bug. Requiere ADR de reemplazo.** | Coordinación técnica y pastoral | P2 del 29/10/2026 |

---

## 7. Auditoría empírica del 29/10/2026 (P0–P12)

Registro de las pruebas ejecutadas en el entorno local con PowerShell durante la sesión de diagnóstico. Cada prueba se documenta con comando ejecutado, resultado y veredicto.

### P0 — Baseline verificado

- **Comando:** `npm test`, `npm run lint`, `npm run build` en `C:\Users\anton\OneDrive\Documents\4. Maxia\Proyectos_Caritas\satrc-v3`.
- **Resultado:**
  - `npm test` → 165 pass + **2 rojos conocidos** en 17 archivos. Los rojos: `estadoDiocesanoSchema.test.js` "rechaza evaluaciones vacías []" y `regresionFase1.test.js` Test 5 "rechaza payload sin evaluaciones". Ambos obsoletos por el commit `3053e29`.
  - `npm run lint` → **55 advertencias, 0 errores**.
  - `npm run build` → verde, 853 kB / 201 kB gzip.
- **Veredicto:** baseline documentado. Actualiza H-DOC-BASELINE-01/02. Los 2 rojos son evidencia de H-DRIVE-02/H-SCHEMA-02 sin actualizar tests.

### P1 — N-PKG-01 (Zod `.errors`)

- **Comando:** `node --input-type=module -e "..."` invocando `EstadoDiocesanoBlobSchema.safeParse` con payload inválido.
- **Resultado:** Zod 4.6.5 instalado. `safeParse` con `totalNivel4: -1` → `success: false`, `error.issues: 1`, `error.errors: UNDEFINED`. Confirmado que `ejecutar_sara_autonomo.mjs:635` usa `validacion.error.errors`.
- **Veredicto:** **H-PKG-01 confirmada.** El log del runner imprime `undefined` cuando Zod rechaza. Pero `process.exit(1)` en la línea siguiente hace que el workflow falle en rojo. **Reclasificada de 🔴 crítica a 🟠 alta** (diagnóstico degradado, no fallo silencioso).

### P2 — N-MOTOR-09 (acoplamiento duplicado)

- **Comando:** `node test-p2-acoplamiento.mjs` con localidad `HUA` (2400 msnm), serie con `lluvia=0.5 mm/h`, `sensación=-2 °C`, `rafagas=15`, `suelo=CARRETERA_FEDERAL`.
- **Resultado:** `niveles_por_vector: { hidro: 2.97, viento: 1.00, térmico: 2.88, convectivo: 1.05 }`. `riesgo_continuo = 3.90`. Fórmula doc §9.1 predice `3.53`; fórmula código (sumando `0.15 + 0.10`) predice `3.90`. **Coincide con código, no con doc.**
- **Veredicto:** **N-MOTOR-09 confirmada.** Sobrestima +0.37 en este caso. **Naturaleza: diseño ambiguo, requiere ADR.** Requiere decisión PEND-08.

### P3 — H-PROMPT-06 (diario sin regla 17)

- **Comando:** `Select-String -Path "scripts\reportes\reporteDiario.mjs" -Pattern "CONTROL ESTRICTO|BAJO NINGUNA CIRCUNSTANCIA|regla 17|Regla 17|N4 = 0 y Nivel 3 = 0"` y control positivo en `api/reporte-ondemand.js`.
- **Resultado:** Diario → **0 coincidencias**. On-demand → **1 coincidencia** en línea 189.
- **Veredicto:** **H-PROMPT-06 confirmada.** Asimetría real entre diario y on-demand.

### P4 — H-DRIVE-01 (log miente)

- **Comando:** lectura de `estado_ligero.json` y `estado_diocesano.json` desde `.env.local` contra Apps Script.
- **Resultado:** `estado_ligero.json`: `actualizado_iso: 2026-10-29T01:03:45Z` (28/10 19:03 MX), `semaforo: N4=0 N3=0 N2=227 N1=178`, `evaluaciones N3/N4: 0`, `zonas_sin_datos: (vacío)`. `estado_diocesano.json`: `actualizado_iso: 2026-10-29T01:03:45Z`, `evaluaciones: 405`, **`schema_version: (vacío)`**.
- **Veredicto:** **H-DRIVE-01 reformulada como riesgo latente, no activo.** La lectura y escritura de Drive funcionaron correctamente hoy. Pero el código sigue teniendo el `return null` silencioso en `escribirJSONBlob`. **H-SCHEMA-01 confirmada empíricamente** por `schema_version` vacío. **H-MOTOR-05 confirmada con datos de producción.**

### P5 — H-REPORTE-02 (diario no se guarda)

- **Comando:** lectura de `reporte_diocesano_vigente.json` y `bitacora_sara.json`.
- **Resultado:** Reporte vigente: `origen: ON_DEMAND_OPERADOR`, `fecha: 28/10 17:24:58`, `id: REP_ONDEMAND_1793229898815`. Bitácora: **22 entradas `PROGRAMADO_CRON`, 0 entradas `PROGRAMADO_REPORTE_DIARIO`, 1 entrada `ON_DEMAND_OPERADOR`**.
- **Veredicto:** **H-REPORTE-02 CONFIRMADA.** En 23 h, 22 corridas CRON y 0 reportes diarios entregados. **H-REPORTE-03 confirmada** por el reintento silencioso.

### P5b — Corrección metodológica (H-PROCESO-03)

- **Observación inicial:** filtro PowerShell `-like 'ON_DEMAND*'` devolvió vacío. Se interpretó como "0 entradas ON_DEMAND".
- **Corrección:** cronología completa (P6) mostró que `SARA_LOG_20` es `ON_DEMAND_OPERADOR` (28/10 17:24:58), coincide con el reporte vigente.
- **Veredicto:** **H-ONDEMAND-09 refutada como bug activo** (la bitácora existe, la cadena está íntegra). Se mantiene como riesgo latente. **H-PROCESO-03 registrada:** un filtro vacío no es evidencia de ausencia de datos.

### P6 — Cadena SHA-256 (integridad de bitácora)

- **Comando:** verificación secuencial de los 23 eslabones.
- **Resultado:** **23/23 íntegros.** `SARA_LOG_20` (ON_DEMAND) encadena con `SARA_LOG_19` (CRON) y con `SARA_LOG_21` (CRON). La mezcla de orígenes no rompió la cadena.
- **Veredicto:** ADR-003 validado en producción. H-BITACORA-02 (concurrencia) no se ha manifestado. H-BITACORA-01 (fix del 24/10) funcionando.

### P7 — N-CRON-05/06 (frecuencia de corridas)

- **Comando:** `gh run list --workflow=sara_cron.yml --limit 60 --json createdAt,status,conclusion,event` + API GitHub.
- **Resultado:** 60 corridas en 5 días (24-28/10). 17 por `schedule` (jitter masivo, ~3.4/día), 43 por `workflow_dispatch` (cron-job.org, ~8.6/día estable). 53 success + 7 failure. Distribución: 24/10: 5, 25/10: 13, 26/10: 11, 27/10: 20 (troubleshooting), 28/10: 11.
- **Veredicto:** **N-CRON-05 confirmada (reformulada).** Hay doble disparador redundante. El `on.schedule` interno corre con jitter masivo y no es confiable. **N-CRON-06 confirmada:** el `on.schedule` no está documentado como activo. Requiere decisión PEND-07.

### P9 — H-MOTOR-05/H-DIAG-04 (sobreestimación de N2)

- **Comando:** lectura y agrupación de `estado_diocesano.json` (405 localidades) por zona, causa, vector, lluvia, saturación, visibilidad.
- **Resultado:**
  - Distribución por zona: ACT/APN/PMS/TIZ al **0 % N2**; CHG/HUA/HYC/SPP/TUL/XIC/ZAC/ZAH al **100 % N2**; PMN al 30.8 %, ATG al 37.5 %.
  - Causas: **217 "Vigilancia por Niebla Densa"**, 8 "Acoplamiento viento + convección", 2 "Vigilancia por Ráfagas Moderadas".
  - `lluviaEvento24hMm`: 169 con 0, 58 con 0.1-0.5 mm.
  - `saturacionTotalSueloMm`: **227 (todas) < 30 mm**.
  - `visibilidadMinKm`: **217 ≤ 2 km**, 10 > 5 km.
- **Veredicto:** **H-MOTOR-05 + H-DIAG-04 confirmadas.** Precisión estimada de N2: ~4.4 % (10 de 227 son legítimas). **Causa raíz identificada:** la Regla 6 dispara por niebla usando `min(24h)` sin persistencia. **N-MOTOR-05-bis confirmada:** SPP y HYC también sobre-clasificadas.

### P10 — Distribución exacta de visibilidad

- **Comando:** agrupación detallada por `visibilidadMinKm` y por zona.
- **Resultado:** HUA/SPP/XIC: 0.18 km. CHG/HYC: 0.22 km. ZAC: 0.26 km. ZAH: 0.34 km. TUL: 0.36 km. ATG/PMN: 11-24 km (no son niebla).
- **Veredicto:** **Las 217 alertas de niebla tienen visibilidad ≤ 0.36 km, no "justo en el umbral de 2 km".** Coherencia por zona (todas las localidades de una zona comparten el valor del nodo, esperado por ADR-001).

### P11 — Open-Meteo: ¿ICON y GEM proveen visibilidad?

- **Comando:** consulta directa a Open-Meteo para Xicotepec con `hourly=visibility` y 3 modelos.
- **Resultado:** `visibility_gfs_seamless`: 240 valores, `min=60 m, max=24,140 m, prom=18,338 m`. **`visibility_icon_seamless`: 240 null.** **`visibility_gem_seamless`: 240 null.** `visibility`: no existe.
- **Veredicto:** **N-MOTOR-11 confirmada.** La visibilidad no se consensúa porque ICON y GEM no la proveen. El disparador del 95.6 % de las alertas N2 depende de un único modelo, contra ADR-002.

### P12 — Persistencia de la niebla en la ventana de 24 h

- **Comando:** conteo de horas con `visibilidad ≤ 2 km` en la ventana de hoy (168-192) del nodo de Xicotepec.
- **Resultado:** **2 horas** (00:00 → 0.2 km, 01:00 → 0.5 km). Resto del día: > 6 km, la mayoría > 17 km.
- **Veredicto:** **N-MOTOR-12 REFUTADA** (el umbral de 2 km no es alto; la niebla es de 0.2 km). **N-MOTOR-13 CONFIRMADA** (el `min(24h)` dispara N2 con un solo valor bajo, aunque haya pasado 19 horas). **N-MOTOR-14 confirmada** (el sistema emite "Vigilancia por Niebla Densa" a las 19:00 sin niebla actual).

---

*Fin del documento.*