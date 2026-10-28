# SatRC V2.0 — Historial de bugs, hitos y lecciones

> **Versión del documento:** 2.5 (28/10/2026)
> **Propósito:** registro cronológico de los problemas resueltos, los hitos cerrados y las lecciones aprendidas. Cada entrada indica síntoma, causa, solución, verificación y commit.
> **Regla:** un bug entra aquí solo cuando está resuelto. Lo pendiente va a `06_PENDIENTES.md`.

---

## 0. Cómo leer los identificadores

Los hitos se nombran con la etapa cuando puede haber confusión. Esta versión separa las colisiones que tenía el historial anterior:

| Prefijo | Significado | Ejemplo |
|---|---|---|
| `E3-` | Hito de Etapa 3 (deuda técnica) | `E3-H5` (N18, visibilidad) |
| `E4-` | Hito de Etapa 4 (multiamenaza) | `E4-H6.4a` |
| `E5-` | Hito de Etapa 5 (integración multivectorial) | `E5-H5.0.2b` |
| Sin prefijo | Bugs con identificador propio (N-, H-) | `N27`, `H-MOTOR-06` |

**Nota de renombrado:** en versiones anteriores, `H5` se usaba tanto para la Etapa 3 (N18) como para la Etapa 5 (H5.0 a H5.8). Las entradas conservan su texto original y se etiquetan con el prefijo correspondiente en el encabezado.

**Lecciones:** los identificadores `H-TEST-*` se usan en `06_PENDIENTES.md` y en las entradas de este archivo. El identificador `H-TEST-06` significa "verificar la aritmética del escenario antes de asumir un error" en todo el proyecto. La lección sobre fixtures reales, que antes también se llamaba `H-TEST-06`, pasa a ser `H-TEST-10`.

---

## 1. Línea del tiempo

| Fase | Periodo | Resultado |
|---|---|---|
| Fase C2c | Inicio de octubre de 2026 | Bugs iniciales de reportes, SMN y codificación |
| Etapa 3 (H0 a H9) | Octubre de 2026 | Deuda técnica cerrada. Tag `etapa-3-cerrada` |
| Etapa 4 (H6.1 a H6.7) | 21 a 22 de octubre de 2026 | Motor multiamenaza en producción. Tag `etapa-4-cerrada` (commit `29009fe`) |
| Etapa 5 (H5.0 a H5.8) | 22 de octubre de 2026 | Integración multivectorial en interfaz, bitácora y prompts |
| Migración a Drive | 27 de octubre de 2026 | Suspensión de Vercel Blob y migración de emergencia |
| **Rescate y Auditoría** | **28 de octubre de 2026** | **Resolución del incidente de producción (RESPUESTA_EN_VIVO), fix de Zod, auditoría documental completa** |

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
- **Lección:** `H-TEST-10`. Este identificador reemplaza al `H-TEST-06` que tenía esta lección en el historial anterior.

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
- **Verificación:** 167 tests en verde. Apan bajó de N3 a N1, Almoloya de N3 a N2.
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
- **Síntoma:** la especificación original del evaluador de viento incluía un suavizado de 3 horas y un factor de rugosidad.
- **Causa:** el código **nunca implementó** ni el suavizado (solo extrae el máximo de 24h) ni el factor de rugosidad.
- **Solución:** cierre como **documental**. Se actualiza la especificación para reflejar el código real (DEC-010). No requiere cambio de código.
- **Fecha de registro:** 28/10/2026.

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

---

## 7. Lecciones consolidadas

| ID | Lección | Origen |
|---|---|---|
| H-TEST-05 | Todo campo nuevo en un contrato debe tener una prueba de su valor y su rango | E4-H-ORQ-02 |
| H-TEST-06 | Antes de asumir un error de código, verificar la aritmética del escenario de prueba | Especificación del adaptador hidrológico |
| H-TEST-07 | Los módulos que emiten valores continuos deben documentar su rango `[mín, máx]` | E4-H-ORQ-03 |
| H-TEST-08 | Antes de proponer un arreglo, analizar los datos reales de producción | E5-H5.0.2 (tres iteraciones) |
| H-TEST-09 | `npm test` no valida `api/` ni `scripts/`. Usar `node --check` antes del commit | Corrección de SMN |
| H-TEST-10 | Las pruebas de integración deben usar datos reales de la API, no datos sintéticos | E4-H6.7 |
| H-E4-LEC | Verificar las APIs externas con llamadas reales antes de codificar | E4-H-E4-01 |
| **H-TEST-12** | Los documentos de arquitectura y motor de riesgo deben declarar explícitamente qué campo se emite y en qué nivel (top-level vs anidado), no solo el nombre del vector. | H-VIENTO-02 |
| **H-TEST-13** | Los scripts de verificación empírica no deben confundir "mención en código" con "implementación efectiva". Extraer siempre el contexto. | T2, T4, B1 (Sesión 28/10) |
| **H-TEST-14** | Antes de declarar que un campo no existe en el código, buscar variantes de nomenclatura (ej. `isoterma` vs `nivel_congelacion_m`). | T4b, T1 (Sesión 28/10) |
| **H-TEST-15** | Los documentos de estado (`06_PENDIENTES`, `LEEME_PRIMERO`) deben revisarse contra el código antes de citarlos. La documentación puede estar desactualizada sin que nadie lo detecte. | G1, S13 (Sesión 28/10) |
| **H-PROCESO-01** | Una auditoría documental completa requiere: (1) prueba empírica, (2) lectura del código fuente, (3) verificación de la cadena de consumidores. | Sesión 28/10/2026 |
| **H-PROCESO-02** | Las URLs de infraestructura crítica (como `GOOGLE_SCRIPT_URL`) deben validarse por código (ej. que empiece con `script.google.com`) para evitar errores humanos de copy-paste de redirecciones. | Incidente 28/10/2026 |

---

## 8. Sesiones de trabajo

El handover de cada sesión registraba el estado, los pendientes y cómo retomar el trabajo.

- **Sesión 22/10/2026:** Etapa 5 cerrada, corrección del SMN aplicada. Pendientes: H-SMN-WS, H6.6, H-ARCH-01.
- **Sesión 28/10/2026:** Incidente de producción resuelto (`RESPUESTA_EN_VIVO`). 8 documentos fundacionales reescritos. Deudas reclasificadas bajo DEC-011. Sistema operativo (`origen: GOOGLE_DRIVE_ACTUALIZADO`). Pendientes inmediatos: H-REPORTE-02, H-DRIVE-01/04/05, H-SARA-01/03/04.

---

## 9. Trazabilidad

- Los hashes de Etapa 5 y de los cierres de Etapa 4 se verificaron con `git log` el 22/10/2026.
- Los hashes marcados con `<hash>` en versiones anteriores no están disponibles y no se consignan aquí.
- Los commits de la sesión 28/10/2026 (`2a3e3e8`, `3053e29`) y la reescritura documental están consolidados en los commits `2a3e3e8` y `3053e29`.