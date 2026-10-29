# SatRC V2.0 — Historial de bugs, hitos y lecciones

> **Versión del documento:** 2.7 (29/10/2026)
> **Propósito:** registro cronológico de los problemas resueltos, los hitos cerrados y las lecciones aprendidas. Cada entrada indica síntoma, causa, solución, verificación y commit.
> **Regla:** un bug entra aquí solo cuando está resuelto. Lo pendiente va a `06_PENDIENTES.md`.
> **Cambios de esta versión:**
> - **Sesión de cierre del 29/10/2026 (§7.22):** Se registran los 7 commits de blindaje (ADR-011, N-MOTOR-06, N-MOTOR-36, N-FETCH-01, N-RESILIENCIA-429) y la reparación de infraestructura (cron-job.org y Watchdog).
> - **Actualización del baseline:** 179 pass + 0 rojos.
> - **Nuevas lecciones de proceso:** H-PROCESO-04 (silencio por inejecución) y H-PROCESO-05 (falso positivo por script).
> - Agrega **§7 — Sesión 29/10/2026: Auditoría empírica P0–P12**. Registra el proceso, los hallazgos y las verificaciones de la sesión de diagnóstico sin resolver código de producción.
> - **Corrige §6.1** (H-VIENTO-01): el cierre anterior afirmaba erróneamente que el código no implementa factor de rugosidad. El código sí lo implementa. Se conserva el texto original por trazabilidad histórica y se agrega nota correctiva.
> - **Actualiza §8** con tres lecciones nuevas: `H-PROCESO-03`, `H-TEST-16`, `H-TEST-17`.
> - **Actualiza §9** con la sesión 29/10/2026.
> - **Corrige H-DOC-BASELINE-01/02:** el conteo real de `npm test` es 165 pass + 2 rojos obsoletos; el conteo real de `npm run lint` es 55 advertencias, 0 errores. Las cifras anteriores (167 verdes, 51 advertencias) eran incorrectas.
> - Los hallazgos confirmados por pruebas empíricas (H-REPORTE-02, H-REPORTE-03, H-PROMPT-06, H-MOTOR-05, H-DIAG-04, N-MOTOR-09, N-MOTOR-11, N-MOTOR-13, N-MOTOR-14, N-MOTOR-15, N-CRON-05, N-CRON-06, H-PKG-01) **NO se registran aquí como resueltos**; se registran en `06_PENDIENTES.md` como deudas confirmadas. Este documento solo registra el proceso y las lecciones.
> - **Refutación documentada de N-MOTOR-12** (hipótesis sobre umbral de niebla).

---

## 0. Cómo leer los identificadores

Los hitos se nombran con la etapa cuando puede haber confusión. Esta versión mantiene la separación que tenía el historial anterior:

| Prefijo | Significado | Ejemplo |
|---|---|---|
| `E3-` | Hito de Etapa 3 (deuda técnica) | `E3-H5` (N18, visibilidad) |
| `E4-` | Hito de Etapa 4 (multiamenaza) | `E4-H6.4a` |
| `E5-` | Hito de Etapa 5 (integración multivectorial) | `E5-H5.0.2b` |
| Sin prefijo | Bugs con identificador propio (N-, H-) | `N27`, `H-MOTOR-06` |
| `P#` | Prueba empírica de una sesión de auditoría | `P9` (§7, sesión 29/10/2026) |
| `N-*` | Deuda nueva no catalogada en versiones previas | `N-MOTOR-09` |
| `H-PROCESO-*` | Lección de metodología o proceso | `H-PROCESO-03` |

**Nota de renombrado:** en versiones anteriores, `H5` se usaba tanto para la Etapa 3 (N18) como para la Etapa 5 (H5.0 a H5.8). Las entradas conservan su texto original y se etiquetan con el prefijo correspondiente en el encabezado.

**Lecciones:** los identificadores `H-TEST-*`, `H-E4-LEC` y `H-PROCESO-*` se usan en `06_PENDIENTES.md` y en las entradas de este archivo. El identificador `H-TEST-06` significa "verificar la aritmética del escenario antes de asumir un error" en todo el proyecto.

---

## 1. Línea del tiempo

| Fase | Periodo | Resultado |
|---|---|---|
| Fase C2c | Inicio de octubre de 2026 | Bugs iniciales de reportes, SMN y codificación |
| Etapa 3 (H0 a H9) | Octubre de 2026 | Deuda técnica cerrada. Tag `etapa-3-cerrada` |
| Etapa 4 (H6.1 a H6.7) | 21 a 22 de octubre de 2026 | Motor multiamenaza en producción. Tag `etapa-4-cerrada` (commit `29009fe`) |
| Etapa 5 (H5.0 a H5.8) | 22 de octubre de 2026 | Integración multivectorial en interfaz, bitácora y prompts |
| Migración a Drive | 27 de octubre de 2026 | Suspensión de Vercel Blob y migración de emergencia |
| Rescate y Auditoría | 28 de octubre de 2026 | Resolución del incidente de producción (`RESPUESTA_EN_VIVO`), fix de Zod, auditoría documental completa |
| **Auditoría empírica** | **29 de octubre de 2026** | **Baseline verificado (P0), 5 hipótesis críticas confirmadas con pruebas P1–P5, 3 pruebas adicionales P6–P12 confirman causa raíz de H-MOTOR-05 y refutan N-MOTOR-12. Sin cambios en código de producción. Diagnóstico cerrado para planificación de fixes.** |

---

## 2. Fase C2c — Bugs iniciales

### N29 — Zonas distintas en la Sección 0 y la Sección II del reporte
- **Síntoma:** el reporte bajo demanda mencionaba zonas diferentes en la decisión operativa y en la sección de zonas que requieren atención.
- **Causa:** el modelo interpretaba dos criterios distintos para cada sección.
- **Solución:** regla 12.bis en el prompt, que exige que ambas secciones mencionen exactamente las mismas zonas.

### N33 y N35 — El parser del SMN no detectaba avisos reales
- **Síntoma:** había avisos de lluvias torrenciales de CONAGUA, pero el sistema indicaba "sin aviso".
- **Causa:** `api/smn.js` consultaba un servicio que solo devuelve el pronóstico general, no los avisos.
- **Solución:** se reescribió el scraping sobre la página principal del SMN, buscando patrones de aviso.

### N34 y N36 — Títulos "Normal" con datos de emergencia
- **Síntoma:** el runner reportaba 19 localidades en N4, pero el texto del dictamen decía "Situación Meteorológica Normal".
- **Causa:** el prompt era ambiguo, y la regla de no mencionar números hacía que el modelo ignorara los conteos.
- **Solución:** regla de coherencia determinista: si N4 > 0, el título es de emergencia. El nivel del SMN se pasa en el prompt del usuario. Ver `05_PROMPT_SARA.md` §2.1.

### N27 — Doble codificación UTF-8 (mojibake)
- **Síntoma:** la bitácora y los reportes mostraban `Ã³` en lugar de `ó`.
- **Causa raíz:** el entorno de GitHub Actions, al usar `@vercel/blob`, guarda las cadenas con doble codificación.
- **Solución (parche):** `repararMojibake()` en `/api/sara.js` y `/api/reporte-ondemand.js`, al leer.
- **Estado:** la causa raíz en el runner no está resuelta. Ver N22/N27 en `06_PENDIENTES.md`.

### N30, N31 y N37 — Fricción en el reporte bajo demanda
- **Síntoma:** si fallaban zonas, el operador debía reintentar a mano. El archivo de texto descargable no incluía la decisión operativa.
- **Solución:** reintento automático (2 intentos) en `SatRCOperativo.jsx`. La decisión operativa se agregó al archivo de texto.

---

## 3. Etapa 3 — Deuda técnica (H0 a H9)

Objetivo: cerrar deuda, establecer pruebas y documentar. Sin funciones nuevas.

### E3-H1 (N26) — Cobertura de zonas en el runner
- **Síntoma:** el runner reportaba 9 de 14 zonas. Cinco zonas quedaban sin datos, lo que producía un falso negativo.
- **Causa:** 14 peticiones simultáneas saturaban Open-Meteo.
- **Solución:** lotes de 4 peticiones con `Promise.allSettled` y 500 ms de espera entre lotes.
- **Verificación:** corrida `39067735652` con 14 de 14 zonas.
- **Commits:** `3ee8253`, `da696cc`, `2f8fd22`.

### E3-H2a (H-MOTOR-02) — Parser del SMN en el runner
- **Síntoma:** el runner consultaba un servicio antiguo, y la alerta del SMN quedaba en nulo.
- **Causa:** N33 se corrigió en la API, pero no en el runner.
- **Solución:** misma lógica de scraping en el runner.
- **Commits:** `2cb3231`, `c89a7ac`.

### E3-H2b (H-API-07, 08 y 09) — Código muerto
- **Síntoma:** `api/glm.js` era un endpoint huérfano con respaldos rotos.
- **Solución:** eliminado.
- **Commits:** `840c671`, `107834b`.

### E3-H2c (H-MOTOR-06) — Piso de lluvia del SMN aplicado a todos los estados
- **Síntoma:** un aviso para Veracruz elevaba el riesgo en todas las zonas de la Sierra.
- **Causa:** el piso del aviso se aplicaba sin verificar el estado de la localidad.
- **Solución:** se verifica `estados_afectados` (HGO, PUE, VER).
- **Verificación:** corrida `39307266292` con N4 = 4 y N3 = 24.
- **Commits:** `12375d0`, `df3f7ad`.

### E3-H3 (H-MOTOR-04) — Respaldo de la interfaz con un solo nodo
- **Síntoma:** si el Blob fallaba, la interfaz usaba solo Huauchinango y sobreclasificaba N2.
- **Solución:** respaldo con los 14 nodos regionales.
- **Commits:** `9a05052`, docs `b7c037f`.

### E3-H4 (H-MOTOR-01, parcial) — Gemelo del motor en el runner
- **Síntoma:** el runner tenía una copia inline de las seis reglas, divergente de la interfaz.
- **Solución:** extraído a `scripts/engine/riskEvaluatorRunner.mjs` con tres pruebas de paridad.
- **Estado:** resuelto en parte. La unificación total queda en V3.0.
- **Commits:** `a94324c`, `3e702f4`.

### E3-H5 (N18) — Lectura de visibilidad
- **Síntoma:** la interfaz no leía `visibility_gfs_seamless` y usaba 10 km por defecto.
- **Solución:** el código ya lo tenía resuelto desde H7a.2. Se agregó una prueba que blinda el respaldo triple.
- **Commit:** `6becdf9` (pendiente de confirmar con `git log`).

### E3-H6 (H-FUNC-01) — Funciones duplicadas
- **Síntoma:** 14 copias de 7 funciones repartidas en el código.
- **Solución:** cinco módulos compartidos en `src/lib/compartido/`: `fechas`, `markdown`, `nodos`, `mojibake`, `regionales`.
- **Commits:** `742ead5`, `e81da8d`, `39049be`, `9d9dd40`.

### E3-H7a (H-TEST-04) — Vitest y CI
- **Síntoma:** cuatro pruebas obsoletas o rotas, sin script de pruebas ni CI.
- **Solución:** Vitest, 36 pruebas iniciales y CI en GitHub Actions.
- **Commits:** `338cc4d`, `d8b59bf`, `734a77b`, `ac5c9ef`, `4bfd241`.

### E3-H7b (H-UI-19) — Resto de pruebas y extracción de NOAA
- **Síntoma:** el análisis de la hora de las imágenes de NOAA estaba en línea y no validaba rangos.
- **Solución:** pruebas de `mojibake`, `regionales` y `fechas`. Extracción de `noaa.js` con validación de rangos.
- **Commits:** `4c23f52`, `54f00d0`.

### E3-H8 — Validación de contratos con Zod
- **Síntoma:** el esquema Zod existía, pero no se usaba. Los datos corruptos llegaban a la interfaz.
- **Solución:** dos esquemas (Blob y Response), activos en `/api/sara` y en el runner.
- **Commits:** `af82f44`, `bd5ca6d`, `c168385`.

### E3-H8.4 y H8.5 — Ajustes de Zod y del modelo
- **H8.4:** Zod rechazaba la respuesta porque faltaba `hora_local_mexico`. Se hizo opcional (`862a446`).
- **H8.5:** el modelo devolvía HTTP 400 porque el JSON de siete secciones se cortaba. Se fijó `max_completion_tokens: 4096` y se corrigió un paréntesis faltante (`e3cff05`).

### E3-H9 — Cierre de Etapa 3
- Documentación actualizada y tag `etapa-3-cerrada`.

---

## 4. Etapa 4 — Motor multiamenaza (H6.1 a H6.7)

### E4-H-E4-01 — Variables de Etapa 4 no verificadas en Open-Meteo
- **Síntoma:** las variables de Etapa 4 nunca se habían comprobado contra la API real.
- **Hallazgo, nivel 1:** la primera verificación dio 0 de 8 variables con datos. Parecía que no existían.
- **Hallazgo, nivel 2:** Open-Meteo agrega un sufijo con el modelo cuando se piden varios (`_gfs_seamless`, `_icon_seamless`, `_gem_seamless`). Las ocho variables existen. GEM devuelve nulo en `freezing_level_height`.
- **Solución:** consenso con estrategias por variable (mediana, máximo o GFS preferente) y valores expuestos sin sufijo.
- **Commits:** `8563829`, `b8f34f0` (pendientes de confirmar con `git log`).
- **Lección:** antes de codificar contra una API externa, verificarla con PowerShell.

### E4-H-ORQ-01 — Prueba del orquestador incompatible con la sigmoide
- **Síntoma:** la prueba "calma total" fallaba con `1.12` en vez de `1`.
- **Causa:** la prueba esperaba exactamente 1.0, pero la sigmoide da 1.118 para CAPE = 500.
- **Solución:** la aserción acepta el rango continuo de N1, que es menor que 2.0.
- **Commit:** `29230c1`. Desbloqueó el commit del orquestador, que había quedado sin subir.

### E4-H-ORQ-02 — Continuo de viento sin tope
- **Síntoma:** en la auditoría H6.4, 47 localidades de Pachuca aparecían en N2 sin justificación. El viento emitía N1 con continuo 2.25.
- **Causa:** las fórmulas del continuo no tenían tope dentro del nivel discreto.
- **Solución:** topes de 1.99, 2.99 y 3.99 en las fórmulas de `windEvaluator.js`.
- **Verificación:** la auditoría posterior al cambio dio 2 o 3 % de cambio, frente a 14.3 % antes.
- **Commit:** `74504c2` (pendiente de confirmar con `git log`).
- **Lección:** `H-TEST-05`.

### E4-H-ORQ-03 — Umbrales de mapeo desalineados
- **Síntoma:** después del tope anterior, 47 localidades seguían en N2 falso.
- **Causa:** el mapeo usaba umbrales de 1.5, 2.5 y 3.5, pero los módulos emiten valores entre `[nivel, nivel + 0.99]`.
- **Solución:** umbrales de 2.0, 3.0 y 4.0.
- **Commit:** `74504c2` (pendiente de confirmar con `git log`).
- **Lección:** `H-TEST-07`.

### E4-H-ORQ-04 — Adaptador de forma en el runner (H6.4 y H6.5)
- **Síntoma:** el orquestador devuelve `nivel_alerta_global`, pero el esquema y la interfaz esperan `nivel_alerta`. Sin adaptador, Zod rechazaría el paquete.
- **Solución:** el runner copia el valor global en `nivel_alerta` y conserva los campos nuevos como opcionales. Si el orquestador falla en una localidad, se usa el motor anterior para esa localidad.
- **Además:** el esquema tiene cinco campos opcionales nuevos y `diagnostico` acepta `acoplamiento` con `.passthrough()`.
- **Commit:** `caae110`.
- **Decisión:** ADR-006 en `08_DECISIONES.md`.

### E4-H6.7 — Pruebas con datos reales de Open-Meteo
- **Síntoma:** las 26 pruebas de Etapa 4 usaban datos sintéticos con nombres planos. No detectaban fallos de consenso.
- **Solución:** fixture de 240 horas con datos reales de Pachuca, y siete pruebas que lo usan.
- **Hallazgo:** el consenso produce un arreglo de objetos, pero los evaluadores esperan un objeto de arreglos. La conversión se hace en el orquestador, y las pruebas la replican.
- **Commits:** `6fdc414` (fixture) y `2b86e47` (pruebas); confirmados en `git log`.
- **Lección:** `H-TEST-10`.

### E4-H-CIERRE — Cierre de Etapa 4
- **Estado:** cerrada a nivel funcional. Quedan abiertos H6.6 *(Nota 28/10/2026: H6.6 se cerró en Etapa 5, ver 6.1)*, H7 y H-ARCH-01 (ver `06_PENDIENTES.md`).
- **Tag:** `etapa-4-cerrada` en el commit `29009fe`.

---

## 5. Etapa 5 — Integración multivectorial

### E5-H-ORQ-05 — N1 debe ser `SIN_AMENAZA`
- **Síntoma:** 114 falsos positivos de convección y 35 de viento en N1, con títulos de vector que no correspondían al nivel.
- **Causa:** el vector dominante se elegía por una diferencia mínima (1.05 frente a 1.00) incluso en N1.
- **Solución:** si el nivel global es 1, el vector dominante es `SIN_AMENAZA`.
- **Verificación (22/10/2026):** 142 `SIN_AMENAZA` en producción, cero convectivos en N1, cero de viento en N1.
- **Commit:** `f9845a6`.

### E5-H5.0.2 — Diagnóstico de acoplamiento por vector
- **Síntoma:** 30 casos de viento en N2 con causa "vientos normales", y 11 de hidrología en N3 con texto de acoplamiento demasiado largo.
- **Causa:** el diagnóstico conservaba el título del vector dominante, aunque el nivel subió por acoplamiento.
- **Solución:** cuando el nivel global supera al del vector principal, el título describe el acoplamiento entre los dos vectores.
- **Verificación (22/10/2026):** los 11 casos de hidrología ahora dicen "Acoplamiento hidrología + viento — Nivel 3". Los 30 casos de viento desaparecieron al bajar el viento de 1.99 a 1.93, y una prueba los cubre.
- **Commits:** `f9845a6` (prueba), `85a8013` (primer intento), `c09d1c6` (intento con `Math.floor`, fallido), `e30c266` (solución final, E5-H5.0.2b).
- **Lección:** `H-TEST-08`.

### E5-H5.0.1 — Coherencia de vectores
- Los niveles N1 se marcan `SIN_AMENAZA` para evitar falsos positivos de convección y viento. Ver E5-H-ORQ-05.

### E5-H5.1 — Pruebas de Zod para los cinco campos del orquestador
- Cuatro pruebas nuevas en `estadoDiocesanoSchema.test.js`.
- **Commit:** `16908e9`.

### E5-H5.2 — Banner dinámico
- `dictamen.js` con una tabla de siete vectores (cuatro simples y tres compuestos).
- El banner de la Sala Operativa muestra la amenaza real. Por ejemplo, "Alerta por Frío Extremo" cuando el vector es térmico, en lugar de "Deslaves".

### E5-H5.3 — Bitácora multivectorial
- **Commits:** `a5262b8`, `541cbdd`, `ac16c1c`.
- `bitacora.js` registra el desglose por vector en el resumen que se encadena con SHA-256. Ejemplo: `N3 [hidro:36, viento:0, termico:0, conv:0] | Top-1: HIDROLOGICO`.

### E5-H5.4 y H5.5 — Prompts multivectoriales
- El frontend y el reporte diario incluyen `vector_dominante` y `acciones_operativas` en los focos críticos.
- `promptsMultivector.js` define las reglas 17, 18 y 19 de los prompts.
- **Verificación:** SARA genera viñetas específicas por vector.
- **Commits:** `db6c37b` (H5.4), `2997885` (H5.5).
- **Estado:** parcial. La especificación de prompts por vector sigue en `05_PROMPT_SARA.md` §5.

### E5-H5.7 — Interfaz operativa
- **Commits:** `53b83a0` (componente), `ab785b8` (H5.7b, `tempMinimaC`), `bdbd293` (H5.7c, lectura en el modal).
- Componente `VectorBar.jsx`, con las cuatro barras del desglose y las acciones operativas en el modal de auditoría.
- Se inyecta `tempMinimaC` desde el orquestador. Antes el modal mostraba `-- °C`.

### Corrección de SMN (fuera de etapa, 22/10/2026)
- **Síntoma:** el scraper leía los comunicados de prensa de todo el país, y generó alarmas falsas por Veracruz para la Sierra.
- **Solución:** el parser usa una expresión regular que extrae solo el bloque de alerta activa. Si no hay alerta en ese bloque, el sistema indica condiciones normales.
- **Archivos:** `api/smn.js` y `scripts/ejecutar_sara_autonomo.mjs`.
- **Commit:** `fe85b08`.
- **Lección:** `H-TEST-09`.

### H-PROMPT-01 — Dictamen del runner con lenguaje multivectorial y formato optimizado
- **Síntoma:** El dictamen del runner usaba un prompt genérico sin reglas multivectoriales (sus ejemplos eran solo de lluvia). Además, el resumen de la bitácora mostraba los números antes que el texto, dificultando la lectura rápida.
- **Solución:** Se importó `REGLAS_MULTIVECTOR` en el runner y se inyectó el `tipo_amenaza` en el prompt. Se reordenó el resumen de la bitácora para seguir la lógica "Qué -> Dónde -> Cuánto" (Texto -> Cobertura -> Conteos).
- **Verificación:** El dictamen en producción ahora genera textos como "Se mantiene la vigilancia normal... | Zonas OK: 14/14. | N4: 0...".
- **Commits:** `3f2f672` y el commit de reordenamiento.

### H-PROMPT-02 — Subtipos de amenaza estructurados para SARA
- **Síntoma:** SARA recibía el vector genérico (`TERMICO` o `CONVECTIVO`) y tenía que adivinar si era una nevada, una helada, un granizo o un downburst leyendo el texto del diagnóstico.
- **Solución:** El orquestador ahora expone el campo `tipo_amenaza` (ej. `NEVADA`, `GRANIZO`, `VIGILANCIA_NORMAL`) y el prompt de SARA lo utiliza en la Regla 17.
- **Verificación:** Test J en verde. API de producción devuelve el campo correctamente.
- **Commits:** `0aa00db` y el commit del runner.

### Corrección Crítica Multifactor (Hotfix 23/10/2026)

#### H-MULTI-01 — El runner no consensuaba las variables E4
- **Síntoma:** El motor convectivo y térmico (nevada) nunca disparaban en producción. Los niveles por vector quedaban atascados en 1.0.
- **Causa:** El runner usaba una copia local de `generarConsensoDeterminista` que solo producía 9 variables. Descartaba las 8 variables de Etapa 4 solicitadas a Open-Meteo.
- **Solución:** Se eliminó la copia local (92 líneas) y se importó el consenso compartido (`src/engine/consensusEngine.js`).
- **Verificación:** Test de importación (Commit 1) pasó de rojo a verde.
- **Commit:** `6a72bdc`.

#### H-MULTI-04 — El orquestador destruía los ceros reales
- **Síntoma:** Incluso con datos, una temperatura de 0 °C o nubosidad de 0 % se convertían en 15 °C y 50 %.
- **Causa:** Uso del operador lógico `||` en lugar del operador de coalescencia nula `??` en la normalización del orquestador y `windEvaluator.js`.
- **Solución:** Cambio a `??` en 13 campos de la serie. Protección de `Math.min` contra arrays vacíos en evaluadores térmico y convectivo.
- **Verificación:** Test E y F en verde. La helada radiativa ahora se detecta (nivel térmico > 2.0).
- **Commit:** `50ebc53`.

#### H-MULTI-02 — La bitácora no distinguía "sin riesgo" de "sin datos"
- **Síntoma:** La bitácora mostraba `termico:0` o `conv:0` aunque el sistema no hubiera recibido datos para esos vectores.
- **Causa:** Falta de trazabilidad de la disponibilidad de datos.
- **Solución:** El orquestador ahora inyecta `datos_disponibles_por_vector`. La bitácora muestra `SIN_DATOS` si el vector no tuvo información.
- **Verificación:** Tests G, H, I en verde.
- **Commit:** `5c826cd`.

### Cierre de Etapa 5
- **Tag:** `etapa-5-cerrada` en el commit `ae67db3`.
- **Documentación de cierre:** `b213bca` (handover) y `890ba6e` (backlog), HEAD al momento de la verificación.

---

## 5.bis Fixes post-Etapa 5 (octubre de 2026)

### E5-H-TERM-01 — Nivel continuo térmico fuera del contrato [nivel, nivel+0.99]
- **Síntoma:** con sensación térmica de 0 °C y nevada real (nivel discreto 3), `nivel_alerta_continuo` devolvía 2.64, que el orquestador leía como N2. Una nevada (N3) podía degradarse a N2 global.
- **Causa:** `thermalEvaluator.js` calculaba el continuo con `1.0 + (nivelFrio - 1) * pesoFrio` en lugar de `nivelFinal + peso * 0.99`. Viola ADR-008. Además, el cálculo del continuo se hacía antes del desempate frío/calor.
- **Solución:** se reordenó el bloque. `nivelFinal` se calcula primero, y el continuo después con la fórmula `nivelFinal + peso_dominante * 0.99`.
- **Verificación:** 6 tests de reproducción nuevos. En producción, semáforo sin cambios por ser octubre (sin frío).
- **Commit:** `343f80d`.
- **Lección:** H-TEST-05 aplicada (campo nuevo con test de valor y rango).

### Cierre de H-BITACORA-01 y H-REPORTE-01 (24/10/2026)
- **Síntoma:** la cadena SHA-256 de la bitácora se rompía en producción. El reporte diario parcial sobrescribía el vigente.
- **Causa:** Colisión de escritura. El runner cargaba la bitácora en memoria, luego `generarReporteDiario()` hacía su propio `put` leyendo una base sin el registro del runner. Al final, el runner volvía a hacer `put` pisando el registro del diario y rompiendo el `prev_hash`.
- **Solución:** Se extrajo la lógica a `calcularNuevaEntradaBitacora`. `reporteDiario.mjs` ya no hace `put` de la bitácora; recibe `bitacoraBase` por parámetro y devuelve el registro al runner. `ejecutar_sara_autonomo.mjs` es el único que hace el `put` final. Se añadió `if (!esParcial)` antes del `put` del reporte.
- **Verificación:** 164/164 tests en verde. En producción, los registros nuevos se encadenan correctamente.
- **Commits:** `d3b0c1c`.

### Cierre de Riesgos de Seguridad (R-01, R-02, R-04) — 27/10/2026
- **Síntoma:** Credenciales y claves de acceso expuestas en el código fuente público y en el bundle del navegador.
- **Solución:** Se movieron a variables de entorno (`SATRC_OPERADORES_JSON`, `CLAVE_SALA_OPERATIVA`), se creó el endpoint `api/auth-operativo.js`, y se eliminó el token expuesto.
- **Verificación:** Build y test (164/164) en verde. Producción funcionando con las nuevas variables.
- **Commits:** `0110708`, `d3b0c1c`, y el commit de auth-operativo.

### Cierre de H-MOTOR-07 y H-CONV-03 — 27/10/2026
- **Síntoma H-MOTOR-07:** El motor hidrológico leía `wind_speed_10m` en lugar de `viento_kmh`, por lo que la Regla 1 nunca detectaba vientos > 40 km/h.
- **Síntoma H-CONV-03:** El motor convectivo disparaba alertas N3 por "Downburst" con valores de CAPE muy bajos, generando falsos positivos (Apan, Almoloya).
- **Solución:** Se cambió el campo de viento en `riskEvaluator.js` y se agregó `capeMax > 1000` en `convectiveEvaluator.js`.
- **Verificación:** 167 tests en verde (cifra histórica; ver corrección en §7.2 con la cifra real del 29/10/2026). Apan bajó de N3 a N1, Almoloya de N3 a N2.
- **Commits:** `d248fdb`.

### Crisis de Vercel Blob y Migración a Google Drive (27 al 28/10/2026)
- **Síntoma:** La aplicación dejó de funcionar. Los logs mostraban `BlobStoreSuspendedError`.
- **Causa:** Se superó el límite de "Advanced Operations" del plan Hobby de Vercel.
- **Solución:** Migración total a Google Drive (Apps Script). Se creó el adaptador `googleDrive.js`. Se inyectó `GOOGLE_SCRIPT_URL` en el YAML. Se creó `estado_ligero.json` (2.69 KB) para evitar timeouts en Vercel. Se re-implementó el Apps Script con "Ejecutar como: Yo" y "Acceso: Cualquier persona" para evitar bloqueos de IP.

---

## 6. Sesión 28/10/2026 — Auditoría, Rescate de Producción y Fix Crítico

Esta sección documenta el incidente de producción más grave desde la creación del sistema y la auditoría documental que derivó de él.

### 6.1 Aclaraciones Históricas y Cierres Formales

**H-VIENTO-01 (Cierre formal)**
- **Síntoma original (versión 28/10/2026):** la especificación original del evaluador de viento incluía un suavizado de 3 horas y un factor de rugosidad.
- **Causa (versión 28/10/2026):** el código **nunca implementó** ni el suavizado (solo extrae el máximo de 24h) ni el factor de rugosidad.
- **Solución (versión 28/10/2026):** cierre como **documental**. Se actualiza la especificación para reflejar el código real (DEC-010). No requiere cambio de código.
- **Fecha de registro:** 28/10/2026.

> **Nota de corrección del 29/10/2026 (ver §7.15):** la afirmación "el código nunca implementó el factor de rugosidad" es **incorrecta**. La verificación empírica P0–P12 confirma que `windEvaluator.js` **sí implementa** factor de rugosidad (LADERA=1.1, LOMA=1.05). Solo el suavizado de 3 h está ausente. H-VIENTO-01 permanece cerrado como **documental por el suavizado**, pero la causa y consecuencia del cierre están mal redactadas. La corrección formal se registra en §7.15 y se propaga a `03_MOTOR_RIESGO.md` §5.1 al cierre del próximo hito.

**Aclaración sobre H6.6**
- **Estado real:** cerrado en Etapa 5.
- **Evidencia:** T14 del 28/10/2026 confirmó que `MonitorPublico.jsx` usa `niveles_por_vector` y `acciones_operativas` del orquestador.
- **Corrección:** Las notas históricas en las secciones 4 y 7 de este documento que decían "H6.6 abierto" o "pendiente" han sido corregidas en esta versión.

### 6.2 Incidente de Producción: La "Tormenta Perfecta" (`RESPUESTA_EN_VIVO`)

- **Síntoma:** `/api/sara` devolvía `origen: RESPUESTA_EN_VIVO`. El semáforo aparecía vacío (`N4=undefined, N3=undefined`). El dictamen mostraba un texto genérico ("Informe Diocesano") en lugar del real. La bitácora era falsa (`SARA_LOG_1`). El runner de GitHub Actions reportaba "publicación exitosa", pero los operadores y el público no veían nada.
- **Causa Raíz (3 fallos encadenados):**
  1. **Infraestructura:** La variable `GOOGLE_SCRIPT_URL` en Vercel contenía una URL de redirección (`script.googleusercontent.com`) en lugar de la canónica (`script.google.com/macros/s/.../exec`). Las peticiones fallaban silenciosamente.
  2. **Runner:** En días sin alertas N3/N4, el runner generaba el paquete ligero con `evaluaciones: null`.
  3. **Validación Zod:** El esquema `EstadoDiocesanoBlobSchema` exigía `.min(1)` en `evaluaciones`, por lo que rechazaba el `[]` (o aceptaba el null solo si usaba `.nullable()` pero luego fallaba con el arreglo vacío).
- **Solución:**
  1. Corrección manual de `GOOGLE_SCRIPT_URL` en Vercel y redeploy sin caché.
  2. `scripts/ejecutar_sara_autonomo.mjs` y `api/sara.js` modificados para aceptar y enviar días tranquilos (`evaluaciones: []`).
  3. `src/schemas/estadoDiocesanoSchema.js` modificado para aceptar arreglos vacíos (se eliminó `.min(1)`). Se corrigió el log de errores de Zod (`.issues` en lugar de `.errors`).
- **Verificación:**
  - La app pasó de `RESPUESTA_EN_VIVO` a `GOOGLE_DRIVE_ACTUALIZADO`.
  - `semaforo: N4=0 N3=0 N2=262 N1=143` (405 localidades).
  - `dictamen.titulo: Vigilancia por Vientos Fuertes`.
- **Commits:** `2a3e3e8` (acepta días tranquilos), `3053e29` (Zod schema).
- **Deudas expuestas (nuevas):** H-DRIVE-01 (silencia errores), H-DRIVE-04 (no valida URL), H-DRIVE-05 (Vercel no puede escribir en Drive por HTTP 401), H-SARA-01 (fallback miente).

### 6.3 Auditoría Documental y Actualización del Sistema

Tras el rescate, se realizó una auditoría empírica de los 11 documentos fundacionales. Se reescribieron para alinear la documentación con el código real y se institucionalizó el principio **DEC-011 (Precisión sobre cobertura)**.

- `00_METODOLOGIA.md`: Reemplaza el principio de falso positivo. Añade verificación de efecto real en Drive. Establece el Protocolo de Rescate de Producción en 4 niveles.
- `01_CONTEXTO.md`: Glosario actualizado. Principio de precisión.
- `08_DECISIONES.md`: DEC-011 agregada. ADR-009 documenta los riesgos de Drive.
- `02_ARQUITECTURA.md`, `03_MOTOR_RIESGO.md`, `05_PROMPT_SARA.md`, `07_GUIA_OPERACION.md`, `09_ARBOL_Y_RUTA_DE_APRENDIZAJE.md`, `LEEME_PRIMERO.md`: Actualizados con el estado real de las deudas, la arquitectura de Drive y las referencias cruzadas.
- `06_PENDIENTES.md`: Integración de 26 deudas nuevas y reclasificación bajo DEC-011.

### 6.4 Fix del Fallback Mentiroso (H-SARA-01/03/04)

- **Síntoma:** Cada vez que alguien consultaba `/api/sara`, el fallback generaba un registro falso en la bitácora con `origen_evento: PROGRAMADO_CRON`, consumía cuota de Groq y devolvía `SITUACION_NORMAL` ("Calma") incluso si Drive fallaba en un día con emergencia real.
- **Causa:** El endpoint tenía un fallback que:
  1. No distinguía entre "Drive no responde" y "no hay emergencias".
  2. Escribía en `bitacora_sara.json` con un `origen_evento` falso.
  3. Llamaba a Groq con `TIMEOUT_GROQ_MS = 10000` en cada lectura.
- **Solución:** Se eliminó el bloque de fallback completo. Ahora:
  1. Si Drive falla o Zod rechaza, devuelve `503` con `SISTEMA_NO_DISPONIBLE`.
  2. No escribe en la bitácora.
  3. No llama a Groq.
  El frontend tiene su propio respaldo (Open-Meteo en el navegador) y puede manejar el 503.
- **Verificación:**
  - **Local:** El script `test-sara-fallback.mjs` confirmó que el endpoint devuelve 503 sin tocar la bitácora.
  - **Producción:** 5 lecturas consecutivas a `/api/sara` no hicieron crecer la bitácora (22 registros antes y después). El semáforo sigue mostrando datos reales (`N2=227 N1=178`).
- **Commit:** `b25d7c5`.
- **Lección:** H-PROCESO-02 aplicada (validar en entorno local antes de desplegar) y H-TEST-15 reforzada (no confiar en que el fallback funciona si no se ha probado en condiciones de fallo).

---

## 7. Sesión 29/10/2026 — Auditoría empírica P0–P12

### 7.1 Propósito y metodología

Sesión de diagnóstico sin cambios en código de producción. Se ejecutaron **13 pruebas empíricas** en el entorno local con PowerShell, siguiendo el protocolo de 4 niveles de `00_METODOLOGIA.md` Fase 6:

1. **Nivel 1 (endpoints):** consultas a `/api/sara` y `/api/smn` cuando aplique.
2. **Nivel 2 (almacenamiento):** lectura real de Google Drive vía Apps Script.
3. **Nivel 3 (runner):** consulta a la API de GitHub Actions y a logs de corridas.
4. **Nivel 4 (contratos Zod):** ejecución directa de los schemas con payloads controlados.

**Regla aplicada:** ninguna prueba escribe en producción. Todas son de lectura o de ejecución local. Cada hipótesis es falsable y se contrasta con el código o con datos reales antes de emitir veredicto.

**Ubicación de los hallazgos:** los **hallazgos confirmados** se registran en `06_PENDIENTES.md` §2 como deudas activas. Este documento solo registra el **proceso**, las **lecciones** y las **correcciones documentales** que derivan de la auditoría.

### 7.2 P0 — Baseline verificado (corrección documental)

- **Propósito:** establecer la cifra real de `npm test`, `npm run lint` y `npm run build` antes de emitir cualquier veredicto sobre el estado del sistema.
- **Comando:** `npm test`, `npm run lint`, `npm run build` ejecutados sobre el HEAD `1281d43` (`docs: registra el cierre de H-SARA-01/03/04 en historial y pendientes`).
- **Resultado real:**
  - `npm test`: **165 pass + 2 rojos conocidos** en 17 archivos. Los dos rojos son `estadoDiocesanoSchema.test.js` "rechaza evaluaciones vacías []" y `regresionFase1.test.js` Test 5 "rechaza payload sin evaluaciones". Ambos fallan por el cambio del commit `3053e29` que relajó el `.min(1)` para aceptar `[]` en días tranquilos, **sin actualizar los tests en el mismo commit**. Viola `00_METODOLOGIA.md` Fase 5.
  - `npm run lint`: **55 advertencias, 0 errores**. Las 4 adicionales respecto a la cifra anterior (51) corresponden a `react(set-state-in-effect)` y `react(purity)` en componentes React, no solo `no-unused-vars`.
  - `npm run build`: verde, 853.44 kB / 201.79 kB gzip. Warning benigno de chunk > 500 kB.
- **Discrepancia documental detectada:** `07_GUIA_OPERACION.md` §5 y `LEEME_PRIMERO.md` §2 decían "167 pruebas en verde" y "51 advertencias". Las cifras reales son distintas.
- **Corrección registrada:** `06_PENDIENTES.md` §2.9 **H-DOC-BASELINE-01** y **H-DOC-BASELINE-02**. La corrección de las cifras en `07_GUIA_OPERACION.md` §5 y `LEEME_PRIMERO.md` §2 se hará al cierre del próximo hito.
- **Veredicto:** baseline documentado. Los 2 rojos del baseline son evidencia de que el cambio de schema del 28/10/2026 dejó tests obsoletos sin actualizar. **No es un bug del código**, es deuda documental y de proceso.
- **Lección:** `H-TEST-16`.

### 7.3 P1 — Verificación de N-PKG-01 (Zod 4 `.errors`)

- **Hipótesis:** `ejecutar_sara_autonomo.mjs` usa `validacion.error.errors`, campo eliminado en Zod 4. Si Zod rechaza el paqueteMaestro, el log imprime `undefined` en lugar del detalle.
- **Comando:** invocación directa de `EstadoDiocesanoBlobSchema.safeParse` con payload inválido (`totalNivel4: -1`) desde PowerShell + `Select-String` sobre el runner.
- **Resultado:**
  - Zod instalado: **4.6.5**.
  - `ejecutar_sara_autonomo.mjs:635` usa `validacion.error.errors` (confirmado).
  - `safeParse` con payload inválido: `success: false`, `error.issues: 1`, `error.errors: UNDEFINED`.
  - Log del runner imprime `❌ [ZOD] El paqueteMaestro no cumple el schema: undefined` y `process.exit(1)` en la línea siguiente.
- **Veredicto:** **H-PKG-01 CONFIRMADA.** Pero **reclasificada de 🔴 crítica a 🟠 alta**: el workflow falla en rojo (no es fallo silencioso), el diagnóstico es degradado (no dice qué campo falló).
- **Registro:** `06_PENDIENTES.md` §2.4 H-PKG-01.

### 7.4 P2 — Verificación de N-MOTOR-09 (acoplamiento duplicado)

- **Hipótesis:** el orquestador suma dos veces el acoplamiento hidro-térmico (`HIDRO_TERMICO: 0.15` y `TERMICO_HIDRO: 0.10`) sobre el mismo producto `(rH−1)(rT−1)`. Si es verdadera, el `riesgo_continuo` real es mayor que el que predice `03_MOTOR_RIESGO.md` §9.1.
- **Comando:** script Node local que construye una localidad en `HUA` (2400 msnm), con serie de 192 h (`lluvia: 0.5 mm/h`, `sensación: -2 °C`, `ráfagas: 15 km/h`, `acceso: CARRETERA_FEDERAL`) y ejecuta `evaluarMultiamenaza`. Compara `riesgo_continuo` real con dos predicciones: la fórmula doc §9.1 (con un solo γ hidro-térmico) y la fórmula del código actual (con dos γ sumados).
- **Resultado:**
  - `niveles_por_vector: { hidro: 2.97, viento: 1.00, térmico: 2.88, convectivo: 1.05 }`.
  - `riesgo_continuo` real = **3.90**.
  - Predicción doc §9.1 (un solo par): **3.5255**.
  - Predicción código (par duplicado): **3.8959**.
  - `Coincide con doc? false`. `Coincide con código? true`.
- **Veredicto:** **N-MOTOR-09 CONFIRMADA.** El código sobreestima `+0.37` en este caso. **Naturaleza: diseño ambiguo, no bug.** ADR-005 lista ambos γ sin aclarar si es uno o dos términos. El código es consistente con la documentación vigente, pero la documentación vigente es contradictoria con DEC-011 (sobreestima).
- **Registro:** `06_PENDIENTES.md` §2.2 N-MOTOR-09 + **PEND-08** en §6 (decisión pendiente).
- **Corrección metodológica:** la primera ejecución de P2 usó `zona_id: PMN` y `rH = 1` por la Regla 1 (Protección Altiplano). El test no discriminaba porque todos los aportes eran cero. Se corrigió a `zona_id: HUA` y el test discrimina. Este patrón refuerza `H-TEST-06` (verificar la aritmética del escenario antes de asumir un error).

### 7.5 P3 — Verificación de H-PROMPT-06 (diario sin regla 17)

- **Hipótesis:** el `systemPrompt` del diario no tiene la regla 17 (control de emergencias), mientras que el on-demand sí la tiene.
- **Comando:** `Select-String` sobre `scripts/reportes/reporteDiario.mjs` con el patrón de la regla 17 + control positivo sobre `api/reporte-ondemand.js`.
- **Resultado:** diario → **0 coincidencias**. On-demand → **1 coincidencia** en la línea 189 con el texto `17. CONTROL ESTRICTO DE EMERGENCIAS: Si Nivel 4 = 0 y Nivel 3 = 0, BAJO NINGUNA CIRCUNSTANCIA uses "suspender actividades", "evacuar" o "emergencia"...`.
- **Veredicto:** **H-PROMPT-06 CONFIRMADA.** Asimetría real entre diario y on-demand. Agrava H-REPORTE-02: cuando se arregle el diario, si no se corrige antes el prompt, el diario podría generar lenguaje de emergencia con semáforo en N1/N2.
- **Registro:** `06_PENDIENTES.md` §2.6 H-PROMPT-06.

### 7.6 P4 — Verificación de H-DRIVE-01 (log miente) y H-SCHEMA-01

- **Hipótesis:** `escribirJSONBlob` devuelve `null` en fallo sin propagar; el runner imprime `✅ Publicación exitosa` ciegamente. Además, el runner no emite `schema_version` (H-SCHEMA-01).
- **Comando:** lectura directa de `estado_ligero.json` y `estado_diocesano.json` desde Apps Script con `GOOGLE_SCRIPT_URL` del `.env.local`. Verificación del timestamp y del campo `schema_version`.
- **Resultado:**
  - `estado_ligero.json`: `actualizado_iso: 2026-10-29T01:03:45.451Z` (28/10 19:03 MX), `hora_local_mexico: 07:03 p.m.`, `semaforo: N4=0 N3=0 N2=227 N1=178`, `evaluaciones N3/N4: 0`, `zonas_sin_datos: (vacío)`.
  - `estado_diocesano.json`: `actualizado_iso: 2026-10-29T01:03:45.451Z`, `evaluaciones: 405`, **`schema_version: (vacío)`**.
- **Veredicto:**
  - **H-DRIVE-01 reformulada como riesgo latente, no activo hoy.** La lectura y escritura de Drive funcionaron correctamente. Pero el `return null` silencioso sigue en el código. Un fallo futuro de Apps Script pasaría invisible. Se mantiene abierta como 🔴 crítica de riesgo latente.
  - **H-SCHEMA-01 confirmada empíricamente.** El campo `schema_version` no se emite.
  - **H-MOTOR-05 confirmada con datos de producción.** N2=227 (56 %) + N3=0 + N4=0 sobre 405 localidades es el patrón de sobreestimación documentado, y ahora hay evidencia de producción.
- **Registro:** `06_PENDIENTES.md` §2.4 H-DRIVE-01 (reformulada) + §2.5 H-SCHEMA-01 (confirmada) + §2.2 H-MOTOR-05.

### 7.7 P5 — Verificación de H-REPORTE-02 (diario no se guarda)

- **Hipótesis:** el reporte diario automático nunca se ha generado porque `reporteDiario.mjs` llama `put()` a `@vercel/blob` sin token inyectado. El `catch` del runner lo absorbe y la corrida queda verde.
- **Comando:** lectura de `reporte_diocesano_vigente.json` y `bitacora_sara.json` desde Drive + análisis de los orígenes de las entradas de bitácora.
- **Resultado:**
  - `reporte_diocesano_vigente.json`: `id_reporte: REP_ONDEMAND_1793229898815`, `origen: ON_DEMAND_OPERADOR`, `generado_por: Administrador`, `fecha_dia_mexico: 28 de octubre de 2026`, `hora_exacta_mexico: 05:24:58 p.m.`, `timestamp_iso_utc: 2026-10-28T23:24:58.815Z`.
  - Bitácora: **23 entradas totales**. De ellas, **22 `PROGRAMADO_CRON`** y **1 `ON_DEMAND_OPERADOR`**. **0 entradas `PROGRAMADO_REPORTE_DIARIO`.**
- **Veredicto:** **H-REPORTE-02 CONFIRMADA al 100 %.** En 23 horas de bitácora (27/10 20:45 → 28/10 19:03) se ejecutaron 22 corridas CRON y **0 reportes diarios entregados**. Al menos 11 de esas corridas ocurrieron después de las 6:00 MX y ninguna generó reporte diario.
- **Consecuencia derivada:** **H-REPORTE-03 CONFIRMADA.** `debeGenerarReporteDiario` reintenta cada corrida post-6:00 porque no ve entrada de bitácora (el diario falla antes de registrarla). Eso son ~8-11 reintentos fallidos por día, invisibles.
- **Registro:** `06_PENDIENTES.md` §2.4 H-REPORTE-02 (confirmada) + H-REPORTE-03 (nueva).

### 7.8 P5b — Corrección metodológica (falso negativo del filtro PowerShell)

- **Observación inicial:** al analizar la bitácora con un filtro PowerShell (`Where-Object { $_.origen_evento -like 'ON_DEMAND*' }`), el resultado fue vacío. Se interpretó como "0 entradas `ON_DEMAND`", lo que hubiera implicado que el reporte vigente `ON_DEMAND` había escrito el archivo sin escribir la bitácora (H-ONDEMAND-09 manifestada).
- **Corrección:** la cronología completa de la bitácora (P6) mostró que **`SARA_LOG_20`** existe con `origen_evento: ON_DEMAND_OPERADOR`, fecha `28/10/2026 17:24:58`, y su `timestamp_iso_utc` **coincide exactamente** con el `reporte_diocesano_vigente.json` (`2026-10-28T23:24:58.815Z`). El filtro PowerShell anterior falló por encoding (posible mojibake de consola Windows), no por ausencia de datos.
- **Veredicto:** **H-ONDEMAND-09 REFUTADA para el caso del 28/10/2026.** La bitácora existe, coincide con el reporte, y la cadena SHA-256 está íntegra. Se mantiene como riesgo latente en `06_PENDIENTES.md`, no como bug activo.
- **Lección registrada:** **H-PROCESO-03** (§8).

### 7.9 P6 — Verificación de la cadena SHA-256 de la bitácora

- **Hipótesis:** la cadena SHA-256 está íntegra en producción tras 2 días de operación continua con mezcla de orígenes (`PROGRAMADO_CRON` + `ON_DEMAND_OPERADOR`).
- **Comando:** lectura de los 23 eslabones de `bitacora_sara.json` y verificación secuencial de que `prev_hash` de cada entrada coincide con los primeros 16 caracteres de `hash_completo` de la entrada anterior.
- **Resultado:** **23/23 eslabones íntegros.** `SARA_LOG_20` (`ON_DEMAND_OPERADOR`, 17:24:58) encadena con `SARA_LOG_19` (CRON, 15:37:28) y con `SARA_LOG_21` (CRON, 17:35:03). La mezcla de orígenes no rompió la cadena.
- **Veredicto:** ADR-003 (bitácora con encadenamiento criptográfico) validado en producción. H-BITACORA-01 (fix del 24/10) funciona. **H-BITACORA-02 (concurrencia) no se ha manifestado.**
- **Registro:** confirmación de ADR-003 + reformulación de H-BITACORA-02 como riesgo latente en `06_PENDIENTES.md`.

### 7.10 P7 — Verificación de frecuencia de corridas (N-CRON-05 y N-CRON-06)

- **Hipótesis:** el `sara_cron.yml` tiene `on.schedule` interno **y** el planificador externo `cron-job.org` dispara `/api/disparar-workflow`. Si ambos están activos, hay doble disparador no documentado.
- **Comando:** consulta a la API de GitHub Actions (`/repos/Maxiaintelligence/satrc-v2/actions/workflows/sara_cron.yml/runs?per_page=60`) con `GITHUB_PAT` del `.env.local`. Análisis de `created_at`, `event`, `status`, `conclusion`.
- **Resultado:**
  - 60 corridas en 5 días (24-28/10).
  - Por evento: **17 `schedule`** + **43 `workflow_dispatch`**.
  - Por conclusión: **53 success** + **7 failure** (troubleshooting del 27/10 ya resuelto).
  - Distribución diaria: 24/10: 5, 25/10: 13, 26/10: 11, 27/10: 20 (troubleshooting), 28/10: 11.
  - Los `schedule` internos tienen **jitter masivo** (20:45, 23:56, 03:10, 06:35, 07:19, 11:00, 14:58, 17:21, 22:56).
  - Los `workflow_dispatch` son **estables** (03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00).
- **Veredicto:**
  - **N-CRON-05 reformulada.** No es "3× la frecuencia" como estimé preliminarmente. Es **1.4-1.5× (11-12 corridas/día vs 8 planificadas)**. El `on.schedule` interno corre con jitter y es poco confiable. El `workflow_dispatch` externo es el disparador efectivo.
  - **N-CRON-06 confirmada.** El `on.schedule` interno **no está documentado como activo** en `00_METODOLOGIA.md` Fase 4 ni en `07_GUIA_OPERACION.md` §1.2. Requiere decisión: ¿es respaldo deliberado o descuido?
- **Registro:** `06_PENDIENTES.md` §2.4 N-CRON-05 y N-CRON-06 + **PEND-07** en §6 (decisión pendiente).
- **Corrección metodológica:** la primera corrida de `gh run list` falló por `Unknown JSON field: "actor"`. Se cambió a la API directa con `Invoke-RestMethod`, que funcionó. **Confirmación de H-PROCESO-01** (verificación empírica con fallback).

### 7.11 P9 — Verificación de H-MOTOR-05 / H-DIAG-04 (causa raíz de la sobreestimación de N2)

- **Hipótesis:** la sobreestimación documentada como H-MOTOR-05 afecta a las zonas húmedas y tiene una causa raíz identificable.
- **Comando:** lectura de `estado_diocesano.json` (405 localidades) y agrupación por `zona_id`, `diagnostico.titulo`, `vector_dominante`, `impactoSistemico.lluviaEvento24hMm`, `impactoSistemico.saturacionTotalSueloMm`, `impactoSistemico.visibilidadMinKm`.
- **Resultado:**
  - **Distribución por zona:** ACT, APN, PMS, TIZ al **0 % N2**. CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH al **100 % N2**. PMN al 30.8 %, ATG al 37.5 %.
  - **Causa por título:** 217 "Vigilancia por Niebla Densa", 8 "Acoplamiento viento + convección — Nivel 2", 2 "Vigilancia por Ráfagas Moderadas".
  - **Vector dominante:** 217 HIDROLOGICO, 10 VIENTO.
  - **Distribución de `lluviaEvento24hMm`:** 169 con 0, 4 con 0.1, 32 con 0.2, 7 con 0.4, 15 con 0.5. **Ninguna N2 llegó a 8 mm.**
  - **Distribución de `saturacionTotalSueloMm`:** **227 (todas) < 30 mm.**
  - **Distribución de `visibilidadMinKm`:** **217 ≤ 2 km**, 10 > 5 km.
- **Veredicto:** **H-MOTOR-05 + H-DIAG-04 CONFIRMADAS con causa raíz.** Las 217 N2 por niebla tienen `lluvia=0`, `saturación<30 mm` y `visibilidad≤2 km`. La Regla 6 dispara N2 por niebla sola. Precisión estimada de N2 en producción hoy: **~4.4 %** (10 legítimas de 227). Bajo DEC-011, esto es el efecto del niño que gritó lobo confirmado empíricamente.
- **Además:** N-MOTOR-05-bis confirmada. SPP y HYC, ausentes de la lista original de H-MOTOR-05, están al 100 % en N2 hoy.
- **Registro:** `06_PENDIENTES.md` §2.2 H-MOTOR-05 y H-DIAG-04 reformuladas con causa raíz + N-MOTOR-05-bis.

### 7.12 P10 — Distribución exacta de visibilidad en las N2

- **Hipótesis:** las 217 N2 por niebla podrían estar "justo en el umbral de 2 km" (fallback o valor por defecto) o tener dispersión real.
- **Comando:** agrupación de `visibilidadMinKm` de las 227 N2 + min/max/prom por zona.
- **Resultado:**
  - Por valor: 90 con 0.18 km, 30 con 0.22 km, 36 con 0.26 km, 7 con 0.34 km, 54 con 0.36 km, 4 con 11.58 km (ATG), 6 con 23.96 km (PMN).
  - Por zona: HUA/SPP/XIC: 0.18 km; CHG/HYC: 0.22 km; ZAC: 0.26 km; ZAH: 0.34 km; TUL: 0.36 km. ATG y PMN: 11-24 km (no es niebla, son N2 por otras causas).
- **Veredicto:** **las 217 alertas de niebla tienen visibilidad ≤ 0.36 km, no "justo en el umbral".** Coherencia por zona (todas las localidades de una zona comparten el valor del nodo, esperado por ADR-001). **La Regla 6 dispara sobre niebla densa real, no sobre ruido de umbral.**
- **Registro:** confirmación de H-MOTOR-05 con datos exactos en `06_PENDIENTES.md` §2.2.

### 7.13 P11 — Verificación de N-MOTOR-11 (visibilidad solo GFS)

- **Hipótesis:** la visibilidad no se consensúa porque ICON y GEM no la proveen.
- **Comando:** consulta directa a Open-Meteo para Xicotepec (`lat: 20.27605861, lon: -97.95814361`) con `hourly=visibility` y `models=gfs_seamless,icon_seamless,gem_seamless`.
- **Resultado:**
  - `visibility_gfs_seamless`: **240 valores válidos**. `min: 60 m`, `max: 24,140 m`, `prom: 18,338 m`.
  - `visibility_icon_seamless`: **240 valores `null`**.
  - `visibility_gem_seamless`: **240 valores `null`**.
  - `visibility` (sin sufijo): **no existe** en la respuesta.
- **Veredicto:** **N-MOTOR-11 CONFIRMADA con evidencia dura.** La visibilidad **no puede ser consensuada** porque ICON y GEM no la proveen. El disparador del 95.6 % de las alertas N2 del sistema **depende de un único modelo**, contra ADR-002 (consenso determinista).
- **Implicación bajo DEC-011:** la variable que más alertas N2 dispara no tiene redundancia. Es un punto único de fallo no documentado en `03_MOTOR_RIESGO.md` §4.2 ni en ADR-002.
- **Registro:** `06_PENDIENTES.md` §2.2 N-MOTOR-11.

### 7.14 P12 — Refutación de N-MOTOR-12 y confirmación de N-MOTOR-13 / N-MOTOR-14

- **Hipótesis previa N-MOTOR-12:** el umbral de 2 km era alto para zonas húmedas y disparaba N2 por niebla habitual.
- **Hipótesis previa N-MOTOR-13:** la Regla 6 usa `Math.min(ventana 24h)` sin persistencia, por lo que un solo valor bajo dispara N2 para toda la ventana.
- **Hipótesis previa N-MOTOR-14:** el motor no distingue evento pasado de futuro.
- **Comando:** consulta a Open-Meteo para el nodo de Xicotepec y análisis hora por hora de la ventana de 24 h de hoy.
- **Resultado:**
  - Horas con `visibilidad ≤ 2 km`: **2**.
  - Horas con `visibilidad ≤ 1 km`: 2.
  - Horas con `visibilidad ≤ 500 m`: 2.
  - Detalle: 00:00 → 0.2 km, 01:00 → 0.5 km, **02:00 a 23:00 → todas > 6 km** (la mayoría > 17 km).
- **Veredicto:**
  - **N-MOTOR-12 REFUTADA.** Con datos reales, la niebla llega a 0.2 km, no está "justo en 2 km". Bajar el umbral a 1 km **no resolvería el problema** porque `min(24h) = 0.2 km` seguiría disparando N2. El problema es el criterio de agregación, no el umbral.
  - **N-MOTOR-13 CONFIRMADA como causa raíz.** Un solo valor bajo de 2 h dispara N2 para toda la ventana de 24 h. El sistema emite "Vigilancia por Niebla Densa" a las 19:00 sin niebla actual.
  - **N-MOTOR-14 CONFIRMADA.** El motor no distingue evento pasado de futuro. La niebla ocurrió hace 19 horas y sigue en N2.
- **Registro:** `06_PENDIENTES.md` §2.2 N-MOTOR-13 + N-MOTOR-14 + N-MOTOR-15 + refutación de N-MOTOR-12 en §2.2 (sección de hipótesis refutadas). **PEND-06** en §6 (decisión pendiente sobre criterio operativo).

### 7.15 Corrección de H-VIENTO-01 (cierre anterior erróneo)

- **Contexto:** en §6.1 (sesión 28/10/2026), H-VIENTO-01 se cerró como documental afirmando: *"el código nunca implementó ni el suavizado (solo extrae el máximo de 24h) ni el factor de rugosidad"*.
- **Verificación empírica del 29/10/2026 (lectura de código):** `src/engine/windEvaluator.js` líneas 43-45 **sí implementan factor de rugosidad**:

let factorRugosidad = 1.0;
if (relieve === 'LADERA' || relieve === 'CANADA') factorRugosidad = 1.1;
else if (relieve === 'LOMA') factorRugosidad = 1.05;

- **Corrección:** la afirmación de §6.1 es incorrecta. Solo el **suavizado de 3 h** está ausente. El factor de rugosidad **existe y está activo**.
- **Estado de H-VIENTO-01:** permanece cerrado como documental **por el suavizado**, pero la causa y consecuencia están mal redactadas en §6.1 y en `03_MOTOR_RIESGO.md` §5.1.
- **Acción registrada:** `06_PENDIENTES.md` §2.9 **H-DOC-HVIENTO-01** reformulada. La corrección de `03_MOTOR_RIESGO.md` §5.1 y del cierre de §6.1 de este documento se hará al cierre del próximo hito, en el mismo commit documental.
- **Lección:** `H-TEST-13` reforzada (los scripts de verificación empírica no deben confundir "mención en código" con "implementación efectiva"; extraer siempre el contexto).

### 7.16 Lo que NO se resuelve en esta sesión

Ninguna de las 13 pruebas P0–P12 modificó código de producción. Todas fueron de **lectura o ejecución local**. En consecuencia:

- **No hay commits de producción nuevos** en esta sesión. El HEAD sigue en `1281d43`.
- **No se cierran bugs en `06_PENDIENTES.md`.** Los hallazgos confirmados se mantienen abiertos, pero ahora con evidencia empírica.
- **No se actualiza el código de motor, runner, prompts ni adaptadores.** Los fixes se planifican a partir de esta auditoría, en commits atómicos posteriores, siguiendo `00_METODOLOGIA.md` Fase 2.5 (5 puntos por fix).
- **Los 2 tests rojos del baseline siguen rojos.** Su corrección se hará junto con la actualización de cifras en `07_GUIA_OPERACION.md` §5 y `LEEME_PRIMERO.md` §2.

### 7.17 Estado de los archivos de auditoría

Durante la sesión se generaron archivos de auditoría en la raíz del repo que **no deben subirse** al repositorio:

- `salida_test_baseline.txt`
- `salida_lint_baseline.txt`
- `salida_build_baseline.txt`

Además de los archivos temporales de los scripts `test-p2-acoplamiento.mjs`, `test-visibilidad-openmeteo.mjs` y `test-persistencia-niebla.mjs`, **eliminados al cierre de cada prueba**.

**Acción registrada:** `06_PENDIENTES.md` §2.9 **H-DOC-GIT-01** ampliada para incluir los 3 archivos de auditoría del 29/10/2026.

### 7.18 Fixes aplicados el 29/10/2026 (bloque PEND-06)

Cinco commits ejecutados sobre `origin/main` tras la auditoría P0–P12. **Todos verificados en 4 niveles** (node --check, npm test, build, ejecución local con caso real).

| # | Commit | Hash | Contenido | Verificación |
|---|---|---|---|---|
| 1 | Documental | `c9d72c8` | 7 documentos fundacionales alineados con auditoría | Revisión cruzada |
| 2 | Fix motor | `6fd6120` | Regla 6 sin niebla como disparador. `calcularContextoNiebla` con período. Paridad canónico/runner. | `node --check` ok, `npm test` 169 pass, Xicotepec → N1 |
| 3 | Fix orquestador | `aabdd30` | Propaga `contexto.niebla`. Zod tolera el campo nuevo. | `node --check` ok, `npm test` 173 pass |
| 4 | Fix prompts | `4204b80` | SARA consume `contexto.niebla` (regla 18). H-PROMPT-06 cerrado (regla 17 en diario). | `node --check` ok, `npm test` 173 pass, grep de la constante en 3 archivos |
| 5 | Fix UI | `03a91a6` | Monitor Público y Sala Operativa consumen `contexto.niebla`. H-UI-02 cerrado de facto. | `npm test` 173 pass, `npm run build` verde (856 kB), `npm run lint` 55 warn / 0 err |

**Estado del baseline tras el bloque:** 173 pass + 2 rojos obsoletos. Los 2 rojos son los del commit `3053e29` (H-DRIVE-02) sin actualizar. **Ajenos a este bloque.**

**Fix pendiente:** H-REPORTE-02 + H-REPORTE-03 (migrar `reporteDiario.mjs` a `googleDrive.js`). **No se resuelve en esta sesión.** Requiere una verificación previa de `debeGenerarReporteDiario` que no se hizo.

### 7.19 Lecciones del bloque PEND-06 (agregar a §8)

**H-PROCESO-04:** un test que falla no implica bug del código. Antes de tocar código de producción, verificar la aritmética del escenario del test. En el Commit A del 29/10/2026, un test nuevo esperaba `MIXTO` con una serie que no cruzaba el límite de período. El código era correcto; el test era incorrecto. Corrección: el test, no el código.

**H-PROCESO-05:** un comando de verificación con patrón mal construido puede producir falsos negativos. En el Commit C del 29/10/2026, `Select-String -SimpleMatch '\$\{...\}'` buscó la cadena con barras invertidas literales en lugar de la cadena sin barras. El código estaba correcto; el comando estaba mal. Antes de concluir "el código no tiene X", verificar con una consulta que no tenga ambigüedad de patrón, o cruzar con otra fuente.

**H-PROCESO-06:** los archivos de salida de verificación (`salida_*.txt` generados con `Tee-Object`) nunca deben quedar en el árbol de trabajo ni versionarse. `salida_lint.txt` y `salida_npm_test.txt` **estaban versionados** en `origin/main` antes de esta sesión. Se restauran al final. Requiere agregar `salida_*.txt` al `.gitignore` (H-DOC-GIT-01 se cierra en el Commit E).

**H-PROCESO-07:** ante un `git status` ambiguo, ejecutar primero `git log -1` para confirmar el HEAD real. En el Commit D, el `git status` mostró "deleted: salida_*.txt" sin los archivos de UI modificados. Un `git log -1` reveló que el commit ya estaba hecho y que solo faltaba restaurar los 2 archivos de salida borrados. Asumir el estado sin verificar el HEAD produjo 3 intentos fallidos de commit inexistente.

### 7.20 Sesión 29/10/2026 — Fixes post-auditoría

Se aplicaron 3 fixes más tras el cierre de los 5 commits del bloque PEND-06:

| # | Commit | Fix | Verificación |
|---|---|---|---|
| 1 | F1 | Zod `.errors` → `.issues` en el runner (H-PKG-01). | `node --check`, log del runner ahora imprime el path exacto del campo que falla. |
| 2 | F2 (`b22772b`) | `reporteDiario.mjs` migrado a Google Drive (H-REPORTE-02). Test L actualizado. | `node --check`, `npm test` 173 pass + 2 rojos, sin imports reales de `@vercel/blob`. Cadena hasta Groq verificada en producción. |
| 3 | `5b2d70b` | Forzar estructura JSON y mapeo defensivo de llaves (N-PROMPT-JSON-01). | Prueba empírica con Groq devuelve `seccion_0_decision`, etc. Reporte on-demand verificado en la app. |

**Nueva lección (H-TEST-18):** los prompts que piden JSON deben incluir la estructura exacta de llaves. Decir "responde con 7 secciones" no es suficiente: el modelo inventa los nombres de las llaves. La estructura debe ser explícita.

**Nueva lección (H-TEST-19):** ante un error de API externa, no asumir la causa. El 429 de Groq parecía saturación por cantidad de llamadas. La prueba directa desde PowerShell (aislada) fue exitosa. El 429 real fue por concurrencia inmediata (2 llamadas en 5s), no por volumen.

### 7.21 Motor de Pronóstico Comunitario Determinista (Monitor Público)

- **Síntoma:** El Monitor Público mostraba textos robóticos y artificiales (hardcodeados en `if/else` con `lluviaTotalDia >= 20`), que no reflejaban las condiciones reales (viento, frío, niebla) y no cambiaban por día.
- **Causa:** Falta de integración del motor de riesgo con el texto del frontend.
- **Solución:** Se creó la función `generarPronosticoComunitario` en `src/lib/compartido/textoComunitario.js`. Es un motor heurístico multiamenaza que:
  1. Evalúa los 4 vectores (N1 a N4).
  2. Integra datos de Open-Meteo (lluvia, viento, frío, niebla).
  3. Varía el texto determinísticamente (semilla: Localidad + Fecha + Pestaña).
  4. Se conectó a `MonitorPublico.jsx` reemplazando el bloque estático.
- **Verificación:** `npm run build` verde, prueba local de 3 pestañas (Hoy, Mañana, Pasado) con textos diferentes y gramaticalmente correctos.

---


### 7.22 Sesión de Cierre 29/10/2026 — Blindaje del Motor, Infraestructura y Resiliencia

Sesión de desarrollo senior enfocada en la "esencia matemática" del motor y la confiabilidad de la infraestructura. Se aplicaron 7 commits atómicos.

#### A. Blindaje del Motor Matemático (Motor y Datos)

1. **ADR-011 (commit `95bb853`) — Acoplamiento hidro-térmico único.**
   - *Síntoma:* P2 confirmó que `riesgo_continuo` daba 3.9 en lugar de 3.53 en escenarios medios.
   - *Causa:* `crossThreatOrchestrator.js` sumaba los coeficientes `HIDRO_TERMICO=0.15` y `TERMICO_HIDRO=0.10` sobre el mismo producto simétrico.
   - *Solución:* Se eliminó `TERMICO_HIDRO`. El acoplamiento efectivo pasó de 0.25 a 0.15.
   - *Verificación:* Prueba P2 ejecutada de nuevo: `riesgo_continuo = 3.53`, acoplamiento 0.56.

2. **N-MOTOR-06 + bis (commit `426cc7e`) — Defensa contra null.**
   - *Síntoma:* Falsos positivos de downburst (N3) cuando faltaba el dato de humedad.
   - *Causa:* `Math.min(...humedades, 100)` con `null` devolvía 0, inflando el potencial de desplome.
   - *Solución:* Se filtraron los `null` y se usó 100 como fallback para humedad; para nivel de congelación se usó `null` seguro (espesor de fusión).
   - *Verificación:* 3 tests nuevos. El potencial de desplome bajó de 1500 a 0 en el caso de prueba.

3. **N-MOTOR-36 (commit `b343165`) — Coherencia del diagnóstico de viento.**
   - *Síntoma:* El texto decía "ráfagas de 42.0 km/h superan el umbral de 45" (siendo 42 < 45).
   - *Causa:* El diagnóstico usaba `rafagaMax` (real) en lugar de `vEqFinal` (normalizada por densidad).
   - *Solución:* Se muestra la ráfaga real y la equivalente a nivel del mar.
   - *Verificación:* Test manual: la causa ahora dice "Ráfaga real de 42.0 km/h (equivalente a 45.8 km/h)...".

4. **N-FETCH-01 (commit `c41fd0c`) — Blindaje de alineación midnight.**
   - *Contexto:* Todo el motor asume que `serie[168]` es la medianoche local.
   - *Solución:* Se agregó un test en `consensusEngine.test.js` que verifica la alineación del fixture real (índices 0, 144, 168, 192) y un `console.warn` en `meteoFetcher.js` si Open-Meteo cambia la política.

5. **Reparación de Tests Obsoletos (commit `f6f4281`).**
   - Se actualizaron 2 tests que esperaban el rechazo de `evaluaciones: []` (comportamiento viejo). Ahora validan el comportamiento `.nullable()` implementado en H-DRIVE-02.
   - **Baseline final: 179 pass + 0 rojos.**

#### B. Infraestructura de Disparo (El Cron no corría)

Durante el diagnóstico del reporte diario, se descubrió que la causa raíz no era Groq, sino que el runner no se ejecutaba en las ventanas esperadas.

1. **Reparación de `cron-job.org`:**
   - *Síntoma:* El 100% de los disparos externos fallaban con `HTTP 401 Unauthorized`.
   - *Causa:* El `CRON_SECRET` en `cron-job.org` estaba desactualizado respecto al de Vercel (probablemente tras la migración a Drive).
   - *Solución:* Se actualizó el header `x-cron-secret` en la plataforma externa.
   - *Verificación:* Un disparo manual devolvió `200 OK` y el workflow de GitHub se ejecutó exitosamente.

2. **Creación del Watchdog en GitHub Actions (Capa 3):**
   - *Contexto:* El `on.schedule` interno de GitHub es impredecible (se saltó la ventana del 29/10 a las 6:00 AM).
   - *Solución:* Se creó `.github/workflows/watchdog_diario.yml` que corre a las 6:30 AM. Si el reporte no existe en Drive, dispara el workflow principal.
   - *Verificación:* Al ejecutarse con el reporte ya presente, termina en verde sin duplicar.

#### C. Resiliencia de Groq (429 y 413)

1. **N-RESILIENCIA-429 (commit `a274db4`) — Blindaje de reporteDiario.mjs.**
   - *Síntoma:* El diario fallaba silenciosamente con `429 Too Many Requests` y `413 Payload Too Large` (registrado en logs del 28/10).
   - *Causa:* `max_completion_tokens: 4096` excedía el límite de tokens por minuto (8000) cuando coexistía con el dictamen, y el `try/catch` genérico ocultaba el error.
   - *Solución:* Se redujo `max_completion_tokens` del diario a 3000 y del dictamen a 800 (evitando la reserva por defecto). Se agregó retry con backoff de 30s para el 429.
   - *Verificación:* El reporte se generó correctamente tras el despliegue.

---

## 8. Lecciones consolidadas

| ID | Lección | Origen |
|---|---|---|
| H-TEST-05 | Todo campo nuevo en un contrato debe tener una prueba de su valor y su rango | E4-H-ORQ-02 |
| H-TEST-06 | Antes de asumir un error de código, verificar la aritmética del escenario de prueba | Especificación del adaptador hidrológico |
| H-TEST-07 | Los módulos que emiten valores continuos deben documentar su rango `[mín, máx]` | E4-H-ORQ-03 |
| H-TEST-08 | Antes de proponer un arreglo, analizar los datos reales de producción | E5-H5.0.2 (tres iteraciones) |
| H-TEST-09 | `npm test` no valida `api/` ni `scripts/`. Usar `node --check` antes del commit | Corrección de SMN |
| H-TEST-10 | Las pruebas de integración deben usar datos reales de la API, no datos sintéticos | E4-H6.7 |
| H-E4-LEC | Verificar las APIs externas con llamadas reales antes de codificar | E4-H-E4-01 |
| H-TEST-12 | Los documentos de arquitectura y motor de riesgo deben declarar explícitamente qué campo se emite y en qué nivel (top-level vs anidado), no solo el nombre del vector. | H-VIENTO-02 |
| H-TEST-13 | Los scripts de verificación empírica no deben confundir "mención en código" con "implementación efectiva". Extraer siempre el contexto. | T2, T4, B1 (Sesión 28/10) |
| H-TEST-14 | Antes de declarar que un campo no existe en el código, buscar variantes de nomenclatura (ej. `isoterma` vs `nivel_congelacion_m`). | T4b, T1 (Sesión 28/10) |
| H-TEST-15 | Los documentos de estado (`06_PENDIENTES`, `LEEME_PRIMERO`) deben revisarse contra el código antes de citarlos. La documentación puede estar desactualizada sin que nadie lo detecte. | G1, S13 (Sesión 28/10) |
| **H-PROCESO-01** | Una auditoría documental completa requiere: (1) prueba empírica, (2) lectura del código fuente, (3) verificación de la cadena de consumidores. | Sesión 28/10/2026 |
| **H-PROCESO-02** | Las URLs de infraestructura crítica (como `GOOGLE_SCRIPT_URL`) deben validarse por código (ej. que empiece con `script.google.com`) para evitar errores humanos de copy-paste de redirecciones. | Incidente 28/10/2026 |
| **H-PROCESO-03** | **Un filtro que devuelve vacío no es evidencia de ausencia de datos.** Antes de concluir "no hay X", verificar con una consulta sin filtros y cruzar con otra fuente. Los datos de Apps Script pueden tener encoding distinto al esperado (falso negativo de PowerShell en P5b del 29/10/2026). | Sesión 29/10/2026 |
| **H-TEST-16** | **Las cifras de estado ("167 pruebas en verde", "51 advertencias") envejecen mal.** Toda cifra de baseline debe incluir la fecha, el comando y el HEAD en que se verificó. Cuando cambia el código sin actualizar la cifra, la documentación miente. | P0 del 29/10/2026 |
| **H-TEST-17** | **Un script de diagnóstico debe discriminar la hipótesis o no es un test.** El primer escenario de P2 usó `zona_id: PMN`, activó la Regla 1 (Protección Altiplano), y el resultado fue indistinguible de la calma. Cambiar a `zona_id: HUA` permitió discriminar. Refuerza H-TEST-06. | P2 del 29/10/2026 |
| **H-TEST-20** | Un modelo de lenguaje no es la única forma de generar texto humano. La heurística determinista (semilla basada en fecha + ID) permite textos variados, sin latencia y sin costo de API. | Monitor Público (29/10/2026) |
| **H-PROCESO-04** | **El silencio en la bitácora no siempre es un bug de lógica.** Puede significar que el proceso nunca se ejecutó (el cron no disparó). Antes de culpar al código, verificar que el disparador funciona. | Sesión 29/10/2026 |
| **H-PROCESO-05** | **Un script de reemplazo de PowerShell puede dar falsos negativos por diferencias de saltos de línea (CRLF vs LF).** Usar Node.js (`fs.replace`) para ediciones masivas en el código. | Sesión 29/10/2026 |
| **H-TEST-21** | **Los límites de los LLM (Groq) cuentan tokens reservados (prompt + max_completion_tokens) para la admisión.** Si reduces el max_tokens, evitas el error 413 y liberas margen para la ventana de 60s. | Sesión 29/10/2026 |

---

## 9. Sesiones de trabajo

El handover de cada sesión registra el estado, los pendientes y cómo retomar el trabajo.

- **Sesión 22/10/2026:** Etapa 5 cerrada, corrección del SMN aplicada. Pendientes: H-SMN-WS, H6.6, H-ARCH-01.
- **Sesión 28/10/2026:** Incidente de producción resuelto (`RESPUESTA_EN_VIVO`). 8 documentos fundacionales reescritos. Deudas reclasificadas bajo DEC-011. Sistema operativo (`origen: GOOGLE_DRIVE_ACTUALIZADO`). Pendientes inmediatos: H-REPORTE-02, H-DRIVE-01/04/05, H-SARA-01/03/04.
- **Sesión 29/10/2026:** Auditoría empírica P0–P12 ejecutada. 5 hipótesis críticas confirmadas (H-PKG-01, N-MOTOR-09, H-PROMPT-06, H-DRIVE-01 latente, H-REPORTE-02) + 3 pruebas adicionales (P6 cadena íntegra, P7 doble disparador, P9 causa raíz de H-MOTOR-05) + refutación documentada de N-MOTOR-12 y confirmación de N-MOTOR-11/13/14/15. Sin cambios en código de producción (HEAD `1281d43`). Baseline corregido a 165 pass + 2 rojos y 55 advertencias. Corrección documental de H-VIENTO-01. Nuevas lecciones H-PROCESO-03, H-TEST-16, H-TEST-17. Nuevas decisiones pendientes PEND-06, PEND-07, PEND-08. **Ningún fix se ha aplicado aún; la sesión fue de diagnóstico y documentación.**

---

## 10. Trazabilidad

- Los hashes de Etapa 5 y de los cierres de Etapa 4 se verificaron con `git log` el 22/10/2026.
- Los hashes marcados con `<hash>` en versiones anteriores no están disponibles y no se consignan aquí.
- Los commits de la sesión 28/10/2026 (`2a3e3e8`, `3053e29`, `b25d7c5`) y la reescritura documental están consolidados en el HEAD `1281d43`.
- **La sesión 29/10/2026 no generó commits nuevos.** El HEAD sigue en `1281d43`. Los hallazgos confirmados se registran en `06_PENDIENTES.md` v2.8. Los commits de los fixes derivados (motor, runner, prompts, adaptadores) se registrarán en el historial al cierre de cada uno.

---

*Fin del documento.*