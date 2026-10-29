# SatRC V2.0 — Ingeniería de prompts (SARA)

> **Versión del documento:** 2.7 (29/10/2026)
> **Propósito:** describir los prompts que usa SARA, las reglas que contienen, cómo se alimentan con datos y qué falta por adaptar.
> **Fuente de verdad:** el código de los archivos citados. Si este documento y el código no coinciden, prevalece el código.
> **Cambios de esta versión:**
> - **H-PROMPT-06 confirmada empíricamente (P3, 29/10/2026):** grep sobre `scripts/reportes/reporteDiario.mjs` → 0 coincidencias de la regla 17. Grep sobre `api/reporte-ondemand.js` → 1 coincidencia en línea 189. Asimetría confirmada por evidencia dura. Se agrega nota en §2, §3, §10.
> - **H-REPORTE-02 y H-REPORTE-03 confirmadas empíricamente (P5, 29/10/2026):** el reporte diario nunca se ha entregado. En 23 h de bitácora, 22 corridas CRON y 0 reportes diarios. El prompt del diario es hoy **código muerto en producción**. Se agrega nota en §2, §3, §10.
> - **Nota correctiva en §4 sobre N-MOTOR-05 y N-MOTOR-29:** R17 enumera subtipos que **no coinciden** con los que el motor emite. Los subtipos reales del código (`CONVECTIVO_NORMAL`, `TORMENTA_DISPERSA`, `SUPERCELULA`, `ESTABLE`, `VIGILANCIA_NORMAL`) no están cubiertos por R17. Cuando SARA recibe uno de ellos, cae al fallback de lluvia genérica. Impacto directo en calidad del texto.
> - **Nota correctiva en §6 sobre la sobreestimación N2 por niebla:** cuando el motor corrija H-MOTOR-05 (bloqueado por PEND-06), los focos críticos que lleguen a SARA serán menos y más relevantes. Sin corregir el motor primero, arreglar H-REPORTE-02 haría que el diario publicara 217 focos N2 por niebla habitual.
> - **§10 reformulada** con las deudas confirmadas por la auditoría, marcando las que están bloqueadas por PEND-06/PEND-08 y las que deben corregirse en el mismo lote.
> - **§11 ampliada** con el orden correcto de implementación de los fixes: primero motor (H-MOTOR-05), después prompts (H-PROMPT-06/09/10), después H-REPORTE-02.

---

## 1. Qué es SARA

SARA es el agente que redacta los textos de la situación meteorológica a partir de datos que el sistema ya calculó. Se llama **Sistema de Alerta y Respuesta Automatizada**.

**Principio:** SARA redacta; no decide. El nivel de cada localidad, el vector dominante y las acciones operativas los calcula el motor (ver `03_MOTOR_RIESGO.md`). SARA convierte esos datos en texto para brigadas y coordinadores.

**Principio de precisión (DEC-011):** SARA no debe inflar el nivel de alerta ni inventar acciones operativas. Bajo el nuevo principio de precisión sobre cobertura, el texto que produce SARA debe reflejar exactamente lo que el motor calculó. Cuando el motor indica N1/N2, SARA describe precaución y vigilancia; cuando indica N3/N4, describe las acciones operativas específicas del vector dominante.

**Modelo:** `openai/gpt-oss-120b` a través de Groq. Se intentó migrar a un modelo más rápido, pero `gpt-oss-120b` es el que está disponible en la cuenta y responde en un tiempo aceptable (4-5 segundos).

---

## 2. Prompts vigentes

| Prompt | Archivo | Salida | Frecuencia |
|---|---|---|---|
| Reporte diario | `scripts/reportes/reporteDiario.mjs` | Reporte de 7 secciones (JSON) | Diario, 06:00 hora de México. **Actualmente falla por H-REPORTE-02; ver §2.1.** |
| Reporte bajo demanda | `api/reporte-ondemand.js` | Reporte de 7 secciones (JSON) | Cuando un operador lo solicita. **Es el único que llega al operador hoy.** |
| Dictamen del runner | `scripts/ejecutar_sara_autonomo.mjs` | Dictamen corto: estado, color, título y comentario | Cada 3 horas |

**Los dos reportes NO comparten las mismas reglas base.** Ver §3 para la tabla comparativa real. Cada uno tiene reglas exclusivas que el otro no incluye. Esta asimetría es una deuda de código activa (H-PROMPT-06, H-PROMPT-09).

**Límite de salida:** `max_completion_tokens: 4096` en el reporte diario, `2500` en el reporte on-demand, y **ninguno** en el dictamen del runner (H-PROMPT-05). Sin límite, el modelo puede devolver JSON truncado o generar timeouts. El límite del on-demand es menor porque Vercel Hobby tiene un tope de 10s por función.

### 2.1 Estado real del reporte diario (confirmado por P5, 29/10/2026)

**El prompt del reporte diario es hoy código muerto en producción.** Confirmado empíricamente el 29/10/2026:

- En 23 h de bitácora (27/10 20:45 → 28/10 19:03) se ejecutaron **22 corridas CRON** y **0 reportes diarios**.
- Al menos 11 de esas corridas ocurrieron después de las 6:00 MX y ninguna generó reporte diario.
- Causa: `reporteDiario.mjs` usa `@vercel/blob` sin `BLOB_READ_WRITE_TOKEN` inyectado. El `catch` del runner lo absorbe. La corrida queda verde.
- Deuda derivada: `debeGenerarReporteDiario` reintenta cada corrida post-6:00 porque no ve la entrada de bitácora (el diario falla antes de registrarla). ~8-11 reintentos fallidos por día, invisibles.

**Registro:** H-REPORTE-02 y H-REPORTE-03 en `06_PENDIENTES.md` §2.4.

**Agravante al arreglar H-REPORTE-02:** el prompt del diario no tiene la regla 17 (confirmado por P3, ver §3). Si se arregla solo H-REPORTE-02, el diario saldría sin control de emergencias. **H-PROMPT-06 debe corregirse en el mismo lote que H-REPORTE-02.**

**Agravante adicional:** el motor hoy publica 227 N2 sobre 405 localidades, de las cuales 217 son "Vigilancia por Niebla Densa" (ver §6.3 y `03_MOTOR_RIESGO.md` §2.1). Si el diario se arregla sin corregir el motor primero, SARA recibiría 217 focos N2 por niebla habitual y redactaría lenguaje de vigilancia para algo que ya ocurrió hace 19 horas. Bajo DEC-011, esto es inaceptable.

---

## 3. Reglas base de los reportes (tabla comparativa)

El código tiene 16 reglas numeradas en el diario y 11 en el on-demand. La tabla muestra qué regla existe en cada uno:

| # | Regla | Diario | On-demand |
|---|---|---|---|
| 1 | Usar nombres reconocibles de las zonas | ✅ | ✅ |
| 2 | Sección 0: decisión operativa, máximo 3 líneas | ✅ | ✅ |
| 3 | Sección I: síntesis de 2-3 zonas | ✅ | ✅ |
| 4 | Sección II: 3 zonas más críticas con dato y acción | ✅ | ✅ |
| 5 | Sección III: evolución respecto a ayer | ✅ | ✅ |
| 6 | Sección IV: ciclo 48h + aviso SMN | ✅ | ✅ |
| 7 | Sección V: lista por momento | ✅ | ✅ |
| 8 | Sección VI: deslinde institucional | ✅ | ✅ (incluida en la 7) |
| 9 | Traducción de niveles a decisiones (N1-N4) | ✅ | ✅ |
| 10 | Clasificación del viento (`<40 / 40-59 / ≥60`) | ✅ | ✅ |
| 11 | Anti-alucinación (solo datos reales) | ✅ | ✅ |
| 12 | Coherencia inter-secciones | ✅ | **❌** |
| **12.bis** | **Coherencia Sección 0 ↔ Sección II** | ✅ | **❌** (H-PROMPT-09) |
| 13 | Vocabulario: "localidades", no "municipios" | ✅ | **❌** |
| 14 | Declarar zonas sin datos | ✅ | **❌** |
| 15 | Formato con viñetas | ✅ | **❌** |
| 16 | Respuesta JSON estricto | ✅ | ✅ (al final del prompt) |
| 17 | **Control estricto de emergencias** | **❌** (H-PROMPT-06) | ✅ |
| R17 multivectorial | Leer el vector dominante y redactar según su lenguaje | ✅ | ✅ |

**Notas obligatorias:**

- **Numeración:** la regla 15 en versiones previas del documento se refería al control de emergencias. En el código, el control de emergencias **solo existe en el on-demand, numerado como 17**. Esta tabla refleja el estado real del código, no la numeración histórica del documento.
- **Regla 12.bis (coherencia 0↔II):** previene el bug histórico N29 (dos listas de zonas distintas en la Sección 0 y la Sección II). El diario la tiene; el on-demand **no** (H-PROMPT-09).
- **Regla 17 multivectorial (ver §4):** se inyecta vía `REGLAS_MULTIVECTOR` en los dos reportes y en el dictamen del runner.
- **Regla de control de emergencias:** el diario **no** la tiene (H-PROMPT-06). Bajo DEC-011 es la deuda más crítica del bloque: sin ella, el reporte diario puede generar lenguaje de emergencia cuando el motor indica N1/N2.

> **Confirmación empírica del 29/10/2026 (P3):**
>
> **H-PROMPT-06 CONFIRMADA.** `Select-String` con el patrón `CONTROL ESTRICTO|BAJO NINGUNA CIRCUNSTANCIA|regla 17|Regla 17|N4 = 0 y Nivel 3 = 0`:
> - `scripts/reportes/reporteDiario.mjs` → **0 coincidencias**.
> - `api/reporte-ondemand.js` → **1 coincidencia** en línea 189 con el texto exacto: `17. CONTROL ESTRICTO DE EMERGENCIAS: Si Nivel 4 = 0 y Nivel 3 = 0, BAJO NINGUNA CIRCUNSTANCIA uses "suspender actividades", "evacuar" o "emergencia"...`
>
> **Asimetría real entre diario y on-demand.** No es un problema de documentación, es un problema de código.
>
> **Registro:** H-PROMPT-06 en `06_PENDIENTES.md` §2.6.
>
> **Bloqueador:** el fix de H-PROMPT-06 debe coordinarse con el fix de H-REPORTE-02 (ver §11). No tiene sentido agregar la regla 17 al diario si el diario no se entrega. Y no tiene sentido arreglar H-REPORTE-02 sin agregar la regla 17, porque el diario saldría sin control de emergencias.

---

## 4. Reglas multivectoriales

**Archivo:** `src/lib/compartido/promptsMultivector.js` (constante `REGLAS_MULTIVECTOR`)
**Se inyectan en:** `api/reporte-ondemand.js`, `scripts/reportes/reporteDiario.mjs` y `scripts/ejecutar_sara_autonomo.mjs` (dictamen)

**Estado real del código:** existe **una sola regla multivectorial** (R17). Las reglas R18, R19 y R20 que versiones previas de este documento describían **no están implementadas** (H-PROMPT-08).

### R17 — Leer el vector dominante y redactar según su lenguaje

La regla 17 (implementada) instruye al modelo a leer el `vector_dominante`, `tipo_amenaza` y `niveles_por_vector` de cada foco, y a redactar con el lenguaje del vector:

- `HIDROLOGICO`: lluvias, deslaves, inundaciones, cortes viales.
- `VIENTO`: ráfagas, caída de árboles, daños a techos.
- `TERMICO`: frío extremo, heladas, nevadas, calor extremo.
- `CONVECTIVO`: granizo, downbursts, tormentas severas.
- Compuestos: combinación de lenguajes.

**Cobertura actual:**

| Aspecto | Cubierto por R17 |
|---|---|
| Distinguir lenguajes por vector | ✅ |
| Usar `tipo_amenaza` para subtipos específicos | ⚠️ Parcial (ver nota abajo) |
| Combinar lenguajes en vectores compuestos | ✅ |
| Traducir el vector a `acciones_operativas` | **❌ (H-PROMPT-10)** |
| Añadir viñeta específica en Sección V cuando el vector no es hidrológico | **❌ (R19 pendiente)** |

### Nota correctiva del 29/10/2026: R17 no cubre los subtipos reales del motor

**R17 enumera los subtipos documentados en `03_MOTOR_RIESGO.md` §9.4. Pero el código emite otros.** Confirmado por lectura cruzada de `promptsMultivector.js`, `convectiveEvaluator.js`, `riskEvaluator.js` y `03_MOTOR_RIESGO.md` §9.4 el 29/10/2026:

| Vector | Subtipos que R17 enumera | Subtipos reales del código | ¿Coincide? |
|---|---|---|---|
| HIDROLOGICO | `DESLAVE_CRITICO`, `INUNDACION_FLUVIAL`, `CORTE_VIAL` | `DESLAVE_CRITICO`, `DESLAVE_MODERADO`, `INUNDACION_FLUVIAL`, `CORTE_VIAL`, `ESTABLE` (Regla 1), `VIGILANCIA_NORMAL` (Regla 6) | **No.** R17 no cubre `DESLAVE_MODERADO`, `ESTABLE`, `VIGILANCIA_NORMAL`. |
| VIENTO | (no enumera; cubre genéricamente) | `VIENTO_NORMAL`, `VIENTO_FUERTE`, `VIENTO_DESTRUCTIVO` | ✅ (cubierto genéricamente) |
| TERMICO | `NEVADA`, `HELADA_AGRICOLA`, `FRIO_EXTREMO`, `CALOR_EXTREMO` | `TERMICO_NORMAL`, `FRIO_EXTREMO`, `HELADA_AGRICOLA`, `NEVADA`, `CALOR_EXTREMO` | **No.** R17 no cubre `TERMICO_NORMAL`. |
| CONVECTIVO | `GRANIZO`, `DOWNBURST`, `SUPER_CELULA` | `CONVECTIVO_NORMAL`, `CONVECTIVO`, `GRANIZO`, `DOWNBURST`, `SUPERCELULA` (sin guion bajo) | **No.** Nombres diferentes: `CONVECTIVO_NORMAL` vs `SIN_AMENAZA`; `CONVECTIVO` vs `TORMENTA_DISPERSA`; `SUPERCELULA` vs `SUPER_CELULA`. |

**Implicación directa en la calidad del texto:** cuando SARA recibe un `tipo_amenaza` que no está enumerado en R17, no tiene instrucción de lenguaje. Cae al fallback genérico de "lluvia". Ejemplos:

- `tipo_amenaza = "ESTABLE"` (Regla 1 del hidrológico) → R17 no lo cubre → SARA escribe genéricamente.
- `tipo_amenaza = "VIGILANCIA_NORMAL"` (Regla 6) → R17 no lo cubre → SARA escribe genéricamente. **Y hoy el 95.6 % de las N2 son VIGILANCIA por niebla, así que este fallback es el caso más común.**
- `tipo_amenaza = "CONVECTIVO_NORMAL"` → R17 no lo cubre → SARA escribe genéricamente.
- `tipo_amenaza = "SUPERCELULA"` → R17 no lo cubre (espera `SUPER_CELULA` con guion bajo).

**Registro:**
- **N-MOTOR-05** en `06_PENDIENTES.md` §2.11: los subtipos convectivos del código no coinciden con los documentados.
- **N-MOTOR-29** en `06_PENDIENTES.md` §2.11: los subtipos del hidrológico no coinciden con los documentados.

**El fix requiere alinear código ↔ docs ↔ prompts en el mismo commit.** No se puede arreglar R17 solo sin corregir antes el código que emite los subtipos, y viceversa.

### R18, R19, R20 — Pendientes de implementar en v2.0

| # | Regla propuesta | Estado | Referencia |
|---|---|---|---|
| R18 | Traducir el vector a acciones operativas (usar `acciones_operativas` del foco en Sección 0 y II). | ❌ | H-PROMPT-08, H-PROMPT-10 |
| R19 | Sección V condicional: si un foco tiene un vector distinto de hidrológico, agregar una viñeta específica. | ❌ | H-PROMPT-08 |
| R20 | Subtipos específicos: usar `tipo_amenaza` para redactar la causa exacta. | ⚠️ Cubierto por R17, pero solo para los subtipos documentados, no los reales (ver nota arriba). | H-PROMPT-08 |

**Decisión:** las 3 reglas se implementan en `promptsMultivector.js` durante esta versión (v2.0), no se dejan para V3.0. La función de reportes es crítica y no puede quedar trunca (ver H-PROMPT-08 en `06_PENDIENTES.md`).

**Nota del 29/10/2026:** la implementación de R18, R19 y R20 debe coordinarse con la corrección de N-MOTOR-05 y N-MOTOR-29 para que los subtipos que los prompts reciban coincidan con los que el código emite. Si R17 se amplía para cubrir los subtipos reales sin antes alinear los nombres, la desalineación persiste.

---

## 5. Dictamen del runner

**Archivo:** `scripts/ejecutar_sara_autonomo.mjs`
**Salida:** `estado_situacion`, `color`, `titulo` y `comentario_oficial`.

El título y el color **no los decide el modelo**. Se fijan por el código:

| Condición | Estado | Color | Título determinista |
|---|---|---|---|
| Hay al menos una localidad en N4 | `SITUACION_CRITICA` | `#EF4444` | `generarTituloDictamen(4, vectorTop)` |
| No hay N4, pero hay N3 | `SITUACION_GRAVE` | `#F97316` | `generarTituloDictamen(3, vectorTop)` |
| Solo hay N1 y N2 | `SITUACION_NORMAL` | `#10B981` | `generarTituloDictamen(1, 'SIN_AMENAZA')` |

**Doble salvaguarda:**

1. El prompt instruye al modelo con la regla determinista de coherencia.
2. El código **sobrescribe** el `titulo` con `generarTituloDictamen()` y normaliza `estado_situacion` con `normalizarEstadoSituacion()`. Aunque el modelo se equivoque, el resultado determinista prevalece.

**Estado del dictamen (H-PROMPT-01 y H-PROMPT-02 cerrados):**

- El dictamen **ya importa** `REGLAS_MULTIVECTOR`.
- Utiliza `tipo_amenaza` para redactar el `comentario_oficial`.
- No menciona conteos numéricos en el comentario (los agrega la bitácora).
- **Falta `max_completion_tokens` en la llamada a Groq (H-PROMPT-05).** Sin límite, el modelo puede devolver JSON truncado en momentos de alta latencia.

**Nota del 29/10/2026:** el dictamen también está afectado por N-MOTOR-05 y N-MOTOR-29. Cuando el `tipo_amenaza` del top-1 es un subtipo no cubierto por R17 (por ejemplo, `VIGILANCIA_NORMAL` en un día de niebla), el modelo recibe instrucción de lenguaje solo para los subtipos enumerados. Para los reales, cae al fallback genérico. Como el dictamen **sobrescribe** `titulo` con `generarTituloDictamen()` (que sí cubre los 7 vectores principales en `NOMBRES_VECTOR`), el título se mantiene coherente; el riesgo está en el `comentario_oficial`.

**Nota adicional:** `generarTituloDictamen(nivelGlobal, vectorDominante)` en `dictamen.js` tiene un comportamiento especial cuando `nivelGlobal === 1`: devuelve `"Situación Diocesana de Calma"` **sin importar el vector**. Esto es coherente con la regla 5.0.1 del orquestador (N1 → `SIN_AMENAZA`). Pero para `nivelGlobal === 2` y `vectorDominante === 'SIN_AMENAZA'` produciría `"Vigilancia por Condiciones Normales"` (contradictorio). No se ha manifestado en producción porque el orquestador emite `SIN_AMENAZA` solo en N1. Registrado como **N-DICT-01** en `06_PENDIENTES.md` §2.11.

---

## 6. Datos que recibe SARA

### 6.1 Reportes

Cada reporte recibe en el mensaje del usuario:

- Fecha y hora de emisión, tipo de reporte (diario o bajo demanda) y, en el on-demand, el operador que lo generó.
- Bloque del SMN: aviso oficial o "sin aviso extraordinario".
- Bloque regional: datos de las 14 zonas con ventana de 72 horas.
- Semáforo: conteo de localidades en N4, N3, N2 y N1.
- Focos críticos: localidades en N3 y N4, con el JSON completo de cada una.

**Inyección de los focos críticos en el `userPrompt`:**

Ambos reportes inyectan los focos como `JSON.stringify(focosCriticos || [])`. Los 6 campos multivectoriales **viajan** en el JSON (confirmado en el frontend y en el diario: `vector_dominante`, `tipo_amenaza`, `niveles_por_vector`, `diagnosticos_por_vector`, `acciones_operativas`, `acoplamiento`).

**Asimetría importante:** el `userPrompt` **no extrae explícitamente** los 6 campos. El modelo los ve dentro del JSON serializado. La regla 17 le indica cómo usar 3 de ellos (`vector_dominante`, `tipo_amenaza`, `niveles_por_vector`), pero **no menciona `acciones_operativas`** (H-PROMPT-10). Hasta que R18 esté implementada, el modelo recibe las acciones pero **no tiene instrucción de usarlas**.

### 6.2 Vectores posibles

Los valores de `vector_dominante` vienen del orquestador. Son **7 vectores de amenaza + 1 estado neutro** (`SIN_AMENAZA`), en 3 grupos:

| Valor | Tipo |
|---|---|
| `HIDROLOGICO`, `VIENTO`, `TERMICO`, `CONVECTIVO` | Simples |
| `HIDRO_VIENTO`, `CONVECTIVO_VIENTO`, `HIDRO_TERMICO` | Compuestos |
| `SIN_AMENAZA` | Estado neutro (nivel global N1) |

En total son **8 entradas en la tabla `NOMBRES_VECTOR` de `dictamen.js`**: 7 vectores + el estado neutro. Versiones previas de este documento decían "son siete"; era impreciso.

Los subtipos específicos (`HELADA_AGRICOLA`, `NEVADA`, `GRANIZO`, `DOWNBURST`, `SUPER_CELULA`, etc.) viajan en `tipo_amenaza` (H-PROMPT-02 cerrado). SARA los recibe de forma estructurada, no solo en el texto del diagnóstico.

**Nota del 29/10/2026:** los subtipos que `tipo_amenaza` puede contener **no coinciden todos** con los enumerados en R17. Ver §4 y las deudas **N-MOTOR-05** y **N-MOTOR-29**.

### 6.3 Volumen real de focos críticos que SARA recibe hoy

**Confirmado empíricamente el 29/10/2026 (P9, P10, P12):** la corrida del 28/10/2026 19:03 MX publicó **N2=227, N3=0, N4=0** sobre 405 localidades. De esas 227 N2:

- **217 (95.6 %) son "Vigilancia por Niebla Densa"**, disparadas por la Regla 6 del motor hidrológico.
- Tienen `lluviaEvento24hMm = 0`, `saturacionTotalSueloMm < 30 mm` y `visibilidadMinKm ≤ 0.36 km`.
- Concentración: CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH al 100 % de sus localidades.

**Implicación directa para SARA:**

- En el on-demand (el único reporte que llega hoy al operador), el bloque `focosCriticos` está vacío porque el filtro es `nivel_alerta >= 3`. La lógica de `ejecutarGeneracionReporte` en `SatRCOperativo.jsx` cae al fallback de "focos N2 por población". Con 227 N2, los 7 focos que SARA recibe como "comunidades críticas bajo tensión" son **7 de esos 217** — todos por niebla.
- En el diario (cuando se arregle H-REPORTE-02), si el motor no se corrige primero, SARA recibiría **217 focos N2 por niebla** como "comunidades críticas bajo tensión" y redactaría lenguaje de vigilancia para algo que ya ocurrió hace 19 horas.
- Bajo DEC-011, esto es exactamente el efecto del niño que gritó lobo.

**Acción registrada:**
- El fix de H-MOTOR-05 (bloqueado por **PEND-06**) debe ejecutarse **antes** que el fix de H-REPORTE-02. Si se hace al revés, el diario publicaría lenguaje de emergencia sobre niebla habitual.
- El detalle de las causas raíz está en `03_MOTOR_RIESGO.md` §2.1 y en `06_PENDIENTES.md` §2.2 (N-MOTOR-11, N-MOTOR-13, N-MOTOR-14, N-MOTOR-15).

---

## 7. Validación y respaldos

1. **Parseo:** la respuesta del modelo se convierte con `JSON.parse` dentro de un `try/catch`. Si falla, se usa una plantilla estática.
2. **Campos obligatorios:** `titulo` y `comentario_oficial` deben existir y no estar vacíos. Si no, se usa la plantilla.
3. **HTTP 400 (JSON truncado):** se corrigió con el límite de tokens del diario y del on-demand. **En el dictamen del runner no hay límite (H-PROMPT-05).**
4. **HTTP 429 (límite de uso de Groq):** no hay una comprobación específica de `res.status === 429`. El bloque `try/catch` general devuelve la **plantilla estática de respaldo** ante cualquier error de HTTP o de parseo. La aplicación no se bloquea.
5. **Timeout:** `AbortSignal.timeout` está configurado en las 3 llamadas a Groq. Los valores son 8000 ms en on-demand, 45000 ms en diario y 45000 ms en el dictamen del runner.
6. **Codificación:** toda respuesta pasa por `repararMojibake` antes de guardarse o enviarse, en los reportes. En el dictamen se aplica al `titulo` y al `comentario_oficial`.

**Principio:** si SARA falla, la aplicación sigue funcionando con texto fijo. Un reporte sin redacción de IA no debe bloquear a los operadores. Este principio se validó durante la migración del 27/10/2026.

**Advertencia de estado actual:** el reporte diario **no llega al operador hoy** por H-REPORTE-02 (`reporteDiario.mjs` escribe en `@vercel/blob` sin token). Bajo DEC-011, esto es una regresión funcional crítica: la función principal de la aplicación (reporte automático de las 6:00 AM) no se está entregando. Ver §2.1.

---

## 8. Estado de la adaptación multivectorial

| Parte | Estado |
|---|---|
| R17 (leer vector y redactar según lenguaje) en los 3 prompts | ⚠️ **Parcial**: cubre los subtipos documentados, no los reales. Ver §4. |
| R18 (traducir el vector a `acciones_operativas`) | ❌ Pendiente (H-PROMPT-08, H-PROMPT-10) |
| R19 (Sección V condicional por vector) | ❌ Pendiente (H-PROMPT-08) |
| R20 (subtipos específicos) | ⚠️ Parcial: cubierto por R17 solo para los subtipos documentados |
| Campos multivectoriales en los focos críticos | ✅ Hecho (diario y frontend) |
| Sección 0 y Sección II redactadas con las acciones del motor | ⚠️ El modelo recibe las acciones pero no tiene instrucción de usarlas (H-PROMPT-10) |
| Dictamen del runner con lenguaje multivectorial | ✅ Hecho (H-PROMPT-01 cerrado) |
| Subtipos de amenaza disponibles para SARA | ⚠️ Parcial: disponibles pero no cubiertos por R17 (N-MOTOR-05, N-MOTOR-29) |
| Regla de control de emergencias en el diario | ❌ Pendiente (H-PROMPT-06, confirmado por P3) |
| Regla 12.bis en el on-demand | ❌ Pendiente (H-PROMPT-09) |
| Pruebas automáticas de los prompts | ❌ No existen (H-PROMPT-03) |

**Meta de esta versión:** las 4 reglas (R17, R18, R19, R20), el control de emergencias en el diario y la regla 12.bis en el on-demand se implementan en v2.0, no se difieren a V3.0. La función de reportes es crítica para la operación diocesana.

**Nota del 29/10/2026:** la "R17 parcial" refleja que R17 existe y se inyecta, pero enumera subtipos que el motor no emite. La cobertura efectiva es menor que la nominal. Requiere alineación código ↔ docs ↔ prompts.

---

## 9. Reglas para editar los prompts

1. **Cambiar el texto del prompt no es un cambio menor.** Afecta lo que lee cada operador. Verificar con una corrida real antes de dar el cambio por bueno.
2. **Las reglas multivectoriales viven en un solo archivo** (`promptsMultivector.js`) y se reutilizan en los tres prompts. No copiarlas a mano.
3. **La numeración de reglas es la del código.** Si se agrega una regla, usar el siguiente número libre y actualizar la tabla comparativa de este documento.
4. **No incluir valores de claves ni datos personales** en el texto de los prompts ni en la documentación.
5. **El dictamen del runner y los reportes tienen prompts separados.** Un cambio en uno no se propaga al otro. Verificar siempre los 3 archivos.
6. **El límite de salida es parte del diseño.** Subirlo sin revisar la longitud de los reportes puede volver a cortar el JSON o causar Timeout en Vercel.
7. **La asimetría entre diario y on-demand es una deuda activa**, no una decisión de diseño. Toda nueva regla debe agregarse a ambos reportes en el mismo commit, salvo justificación documentada.

**Regla adicional del 29/10/2026:** si el motor cambia los nombres de los subtipos de `tipo_amenaza`, R17 debe actualizarse en el mismo commit. Los prompts dependen de un contrato de datos que hoy está desalineado (N-MOTOR-05, N-MOTOR-29). Cualquier fix de prompts debe coordinar con el fix del motor.

---

## 10. Deuda de prompts

> **Confirmaciones empíricas del 29/10/2026 (P3 y P5):**
> - **H-PROMPT-06:** confirmada por grep. Diario → 0 coincidencias; on-demand → 1 coincidencia.
> - **H-REPORTE-02 y H-REPORTE-03:** confirmadas por bitácora. 22 corridas CRON, 0 reportes diarios en 23 h.
> - **N-MOTOR-05 y N-MOTOR-29:** confirmadas por código. Los subtipos reales no coinciden con los documentados en R17. Impacto directo en la calidad del texto.

| ID | Deuda | Sev. | Estado | Bloqueador |
|---|---|---|---|---|
| **H-PROMPT-03** | No hay pruebas automáticas de los prompts. | 🟡 | Abierta | — |
| **H-PROMPT-05** | El dictamen del runner llama a Groq sin `max_completion_tokens`. Puede devolver JSON truncado o timeouts. | 🟠 | Abierta | — |
| **H-PROMPT-06** | El `systemPrompt` del diario **no tiene la regla de control de emergencias**. **Confirmada por P3.** Bajo DEC-011, es crítico: el diario podría generar lenguaje de emergencia cuando el motor indica N1/N2. | 🔴 | **Confirmada, abierta** | Debe corregirse en el mismo lote que H-REPORTE-02. |
| **H-PROMPT-07** | La regla 10 del prompt (`<40 / 40-59 / ≥60`) usa umbrales más bajos que el motor (`45/65/90 +5 altitud`). Desfase de 5 a 30 km/h. | 🟢 | Abierta | — |
| **H-PROMPT-08** | `promptsMultivector.js` implementa solo R17. Faltan R18, R19, R20. Se implementan en v2.0. | 🟠 | Abierta | Coordinar con N-MOTOR-05 y N-MOTOR-29. |
| **H-PROMPT-09** | El `systemPrompt` del on-demand **no tiene la regla 12.bis** (coherencia Sección 0 ↔ Sección II). Riesgo de reintroducir el bug N29. | 🔴 | Abierta | — |
| **H-PROMPT-10** | R17 no menciona `acciones_operativas`. El modelo recibe las acciones pero no tiene instrucción de usarlas. Parte de H-PROMPT-08. | 🟠 | Abierta | — |
| **H-REPORTE-02** | `reporteDiario.mjs` usa `@vercel/blob` sin token inyectado. Falla silenciosamente. **Confirmada por P5.** | 🔴 | **Confirmada, abierta** | Prioridad #2 después de H-MOTOR-05 (ver §6.3). |
| **H-REPORTE-03** | `debeGenerarReporteDiario` reintenta 8×/día porque la bitácora nunca registra el intento. **Confirmada por P5.** | 🔴 | **Confirmada, abierta** | Se corrige al resolver H-REPORTE-02. |
| **N-MOTOR-05** | Subtipos convectivos del código (`CONVECTIVO_NORMAL`, `TORMENTA_DISPERSA`, `SUPERCELULA`) no coinciden con los documentados en R17 (`SIN_AMENAZA`, `CONVECTIVO`, `SUPER_CELULA`). | 🟠 | **Confirmada, abierta** | Requiere alineación código ↔ docs ↔ prompts. |
| **N-MOTOR-29** | Subtipos del hidrológico (`ESTABLE`, `VIGILANCIA_NORMAL`) no coinciden con §9.4 (`PROTECCION_ALTIPLANO`, `VIGILANCIA`). R17 no los cubre. **Especialmente crítico porque el 95.6 % de las N2 hoy son VIGILANCIA_NORMAL.** | 🟠 | **Confirmada, abierta** | Requiere alineación código ↔ docs ↔ prompts. |

**Deudas cerradas o refutadas en esta versión:**

- **H-PROMPT-01** y **H-PROMPT-02**: cerrados en sesiones del 22/10/2026 y 27/10/2026 respectivamente.
- **N-MOTOR-12** (hipótesis sobre umbral de niebla): **refutada** por P12. El umbral de 2 km no es alto; el problema es `min(24h)`.
- **N-MOTOR-10**: cerrada como duplicada de N-MOTOR-13.

**Nota sobre el orden de fixes (§11):** los tres bloqueadores del bloque de prompts son:
1. **H-MOTOR-05** (bloqueado por PEND-06): reduce los 217 N2 por niebla a un número realista. Sin esto, arreglar el diario publicaría lenguaje de vigilancia para niebla habitual.
2. **N-MOTOR-05 y N-MOTOR-29**: alinean los subtipos del código con los de R17. Sin esto, R17 tiene cobertura efectiva menor que su cobertura nominal.
3. **H-REPORTE-02 y H-REPORTE-03**: entregan el diario al operador.

Los tres son necesarios. El orden importa.

---

## 11. Propuesta de implementación de los fixes

Las propuestas de implementación (bloques de código, pruebas PowerShell, commits atómicos) de los fixes H-PROMPT-05, 06, 07, 08, 09 y 10 viven en `docs/archivo/FIXES_PROMPTS_2026-10-28.md`.

**Regla:** cuando un fix se aplique:

1. Se archiva el archivo temporal `FIXES_PROMPTS_2026-10-28.md` con la fecha de cierre (o se elimina si todos los fixes se aplican).
2. El fix aplicado se registra en `04_HISTORIAL.md` con síntoma, causa, solución, verificación y commit.
3. El ítem correspondiente de §10 se marca como cerrado con la fecha.
4. Este documento (§5) no contiene los bloques de código. Solo describe qué falta y remite al archivo temporal.

### 11.1 Orden correcto de implementación (agregado el 29/10/2026)

Los fixes de prompts **no son independientes**. La auditoría P0–P12 demostró que están acoplados. El orden correcto es:

| Orden | Fix | Bloqueador | Por qué primero |
|---|---|---|---|
| 1 | **H-MOTOR-05 + H-DIAG-04 + N-MOTOR-11/13/14/15** | **PEND-06** (decisión sobre criterio de N2 por niebla) | Sin este fix, el motor sigue emitiendo 217 N2 por niebla. Cualquier fix de prompts recibiría esos 217 focos y redactaría lenguaje inapropiado. |
| 2 | **N-MOTOR-05 + N-MOTOR-29** | Alineación código ↔ docs ↔ prompts | R17 enumera subtipos que el motor no emite. Alinear los nombres en el mismo commit evita que el fix de R17 sea cosmético. |
| 3 | **H-PROMPT-06 + H-REPORTE-02 + H-REPORTE-03** | En el mismo lote | Agregar la regla 17 al diario sin arreglar el diario no sirve (el diario no se entrega). Arreglar el diario sin la regla 17 hace que el diario salga sin control de emergencias. Ambas correcciones deben ir juntas. |
| 4 | **H-PROMPT-09** | Independiente | Agregar la regla 12.bis al on-demand (que sí se entrega hoy) es de bajo riesgo y alta prioridad. Puede hacerse en cualquier momento. |
| 5 | **H-PROMPT-05** | Independiente | Agregar `max_completion_tokens` al dictamen del runner. Bajo riesgo, una línea. |
| 6 | **H-PROMPT-08 + H-PROMPT-10** | Coordinar con R17 actualizada en el paso 2 | Implementar R18, R19, R20 en `promptsMultivector.js`. Requiere que R17 ya cubra los subtipos reales (paso 2). |
| 7 | **H-PROMPT-07** | Independiente | Alinear los umbrales de viento del prompt con el motor. Bajo impacto. |

**Por qué este orden y no otro:**

- Los pasos 1 y 2 son **precondiciones técnicas**. Sin ellos, los fixes de prompts (pasos 3–7) producen mejoras cosméticas pero no corrigen el problema real bajo DEC-011.
- El paso 3 es el **fix de mayor impacto visible** para el operador. Después de los pasos 1 y 2, es cuando el reporte diario se puede entregar sin generar ruido.
- Los pasos 4, 5, 6 y 7 son **mejoras incrementales** una vez que la base está sana.

**Ninguno de estos fixes se ha aplicado aún.** La sesión del 29/10/2026 fue de diagnóstico. Los pasos 1 y 3 están bloqueados por PEND-06 y por el orden de prioridad operativa. El paso 4 (H-PROMPT-09) y el paso 5 (H-PROMPT-05) son los únicos que se podrían ejecutar sin dependencias externas, en cualquier momento.

---

*Fin del documento.*