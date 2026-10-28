# SatRC V2.0 — Ingeniería de prompts (SARA)

> **Versión del documento:** 2.6 (28/10/2026)
> **Propósito:** describir los prompts que usa SARA, las reglas que contienen, cómo se alimentan con datos y qué falta por adaptar.
> **Fuente de verdad:** el código de los archivos citados. Si este documento y el código no coinciden, prevalece el código.
> **Cambios de esta versión:**
> - Reformula §3 con tabla comparativa explícita diario vs on-demand.
> - Reformula §4: existe **una sola regla multivectorial** (R17). R18, R19 y R20 están pendientes de implementar (H-PROMPT-08).
> - Reformula §7 sobre manejo de 429 (no hay check específico; el try/catch general aplica).
> - Reformula §8 como tabla de estado actual con las 3 reglas faltantes.
> - Amplía §10 con H-PROMPT-03, 05, 06, 07, 08, 09, 10 y H-REPORTE-02, 03.
> - Referencia a DEC-011 en §1 y §3.

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
| Reporte diario | `scripts/reportes/reporteDiario.mjs` | Reporte de 7 secciones (JSON) | Diario, 06:00 hora de México. **Actualmente falla por H-REPORTE-02; ver §7.** |
| Reporte bajo demanda | `api/reporte-ondemand.js` | Reporte de 7 secciones (JSON) | Cuando un operador lo solicita. **Es el único que llega al operador hoy.** |
| Dictamen del runner | `scripts/ejecutar_sara_autonomo.mjs` | Dictamen corto: estado, color, título y comentario | Cada 3 horas |

**Los dos reportes NO comparten las mismas reglas base.** Ver §3 para la tabla comparativa real. Cada uno tiene reglas exclusivas que el otro no incluye. Esta asimetría es una deuda de código activa (H-PROMPT-06, H-PROMPT-09).

**Límite de salida:** `max_completion_tokens: 4096` en el reporte diario, `2500` en el reporte on-demand, y **ninguno** en el dictamen del runner (H-PROMPT-05). Sin límite, el modelo puede devolver JSON truncado o generar timeouts. El límite del on-demand es menor porque Vercel Hobby tiene un tope de 10s por función.

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
| Usar `tipo_amenaza` para subtipos específicos | ✅ |
| Combinar lenguajes en vectores compuestos | ✅ |
| Traducir el vector a `acciones_operativas` | **❌ (H-PROMPT-10)** |
| Añadir viñeta específica en Sección V cuando el vector no es hidrológico | **❌ (R19 pendiente)** |

### R18, R19, R20 — Pendientes de implementar en v2.0

| # | Regla propuesta | Estado | Referencia |
|---|---|---|---|
| R18 | Traducir el vector a acciones operativas (usar `acciones_operativas` del foco en Sección 0 y II). | ❌ | H-PROMPT-08, H-PROMPT-10 |
| R19 | Sección V condicional: si un foco tiene un vector distinto de hidrológico, agregar una viñeta específica. | ❌ | H-PROMPT-08 |
| R20 | Subtipos específicos: usar `tipo_amenaza` para redactar la causa exacta. | ✅ cubierto por R17 | H-PROMPT-08 (consolidar como regla explícita) |

**Decisión:** las 3 reglas se implementan en `promptsMultivector.js` durante esta versión (v2.0), no se dejan para V3.0. La función de reportes es crítica y no puede quedar trunca (ver H-PROMPT-08 en `06_PENDIENTES.md`).

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

---

## 7. Validación y respaldos

1. **Parseo:** la respuesta del modelo se convierte con `JSON.parse` dentro de un `try/catch`. Si falla, se usa una plantilla estática.
2. **Campos obligatorios:** `titulo` y `comentario_oficial` deben existir y no estar vacíos. Si no, se usa la plantilla.
3. **HTTP 400 (JSON truncado):** se corrigió con el límite de tokens del diario y del on-demand. **En el dictamen del runner no hay límite (H-PROMPT-05).**
4. **HTTP 429 (límite de uso de Groq):** no hay una comprobación específica de `res.status === 429`. El bloque `try/catch` general devuelve la **plantilla estática de respaldo** ante cualquier error de HTTP o de parseo. La aplicación no se bloquea.
5. **Timeout:** `AbortSignal.timeout` está configurado en las 3 llamadas a Groq. Los valores son 8000 ms en on-demand, 45000 ms en diario y 45000 ms en el dictamen del runner.
6. **Codificación:** toda respuesta pasa por `repararMojibake` antes de guardarse o enviarse, en los reportes. En el dictamen se aplica al `titulo` y al `comentario_oficial`.

**Principio:** si SARA falla, la aplicación sigue funcionando con texto fijo. Un reporte sin redacción de IA no debe bloquear a los operadores. Este principio se validó durante la migración del 27/10/2026.

**Advertencia de estado actual:** el reporte diario **no llega al operador hoy** por H-REPORTE-02 (`reporteDiario.mjs` escribe en `@vercel/blob` sin token). Bajo DEC-011, esto es una regresión funcional crítica: la función principal de la aplicación (reporte automático de las 6:00 AM) no se está entregando.

---

## 8. Estado de la adaptación multivectorial

| Parte | Estado |
|---|---|
| R17 (leer vector y redactar según lenguaje) en los 3 prompts | ✅ Hecho |
| R18 (traducir el vector a `acciones_operativas`) | ❌ Pendiente (H-PROMPT-08, H-PROMPT-10) |
| R19 (Sección V condicional por vector) | ❌ Pendiente (H-PROMPT-08) |
| R20 (subtipos específicos) | ⚠️ Cubierto por R17, pero no como regla explícita |
| Campos multivectoriales en los focos críticos | ✅ Hecho (diario y frontend) |
| Sección 0 y Sección II redactadas con las acciones del motor | ⚠️ El modelo recibe las acciones pero no tiene instrucción de usarlas (H-PROMPT-10) |
| Dictamen del runner con lenguaje multivectorial | ✅ Hecho (H-PROMPT-01 cerrado) |
| Subtipos de amenaza disponibles para SARA | ✅ Hecho (H-PROMPT-02 cerrado) |
| Regla de control de emergencias en el diario | ❌ Pendiente (H-PROMPT-06) |
| Regla 12.bis en el on-demand | ❌ Pendiente (H-PROMPT-09) |
| Pruebas automáticas de los prompts | ❌ No existen (H-PROMPT-03) |

**Meta de esta versión:** las 4 reglas (R17, R18, R19, R20), el control de emergencias en el diario y la regla 12.bis en el on-demand se implementan en v2.0, no se difieren a V3.0. La función de reportes es crítica para la operación diocesana.

---

## 9. Reglas para editar los prompts

1. **Cambiar el texto del prompt no es un cambio menor.** Afecta lo que lee cada operador. Verificar con una corrida real antes de dar el cambio por bueno.
2. **Las reglas multivectoriales viven en un solo archivo** (`promptsMultivector.js`) y se reutilizan en los tres prompts. No copiarlas a mano.
3. **La numeración de reglas es la del código.** Si se agrega una regla, usar el siguiente número libre y actualizar la tabla comparativa de este documento.
4. **No incluir valores de claves ni datos personales** en el texto de los prompts ni en la documentación.
5. **El dictamen del runner y los reportes tienen prompts separados.** Un cambio en uno no se propaga al otro. Verificar siempre los 3 archivos.
6. **El límite de salida es parte del diseño.** Subirlo sin revisar la longitud de los reportes puede volver a cortar el JSON o causar Timeout en Vercel.
7. **La asimetría entre diario y on-demand es una deuda activa**, no una decisión de diseño. Toda nueva regla debe agregarse a ambos reportes en el mismo commit, salvo justificación documentada.

---

## 10. Deuda de prompts

| ID | Deuda | Sev. | Estado |
|---|---|---|---|
| **H-PROMPT-03** | No hay pruebas automáticas de los prompts. | 🟡 | Abierta |
| **H-PROMPT-05** | El dictamen del runner llama a Groq sin `max_completion_tokens`. Puede devolver JSON truncado o timeouts. | 🟠 | Abierta |
| **H-PROMPT-06** | El `systemPrompt` del diario **no tiene la regla de control de emergencias**. Bajo DEC-011, es crítico: el diario podría generar lenguaje de emergencia cuando el motor indica N1/N2. | 🔴 | Abierta |
| **H-PROMPT-07** | La regla 10 del prompt (`<40 / 40-59 / ≥60`) usa umbrales más bajos que el motor (`45/65/90 +5 altitud`). Desfase de 5 a 30 km/h. | 🟢 | Abierta |
| **H-PROMPT-08** | `promptsMultivector.js` implementa solo R17. Faltan R18, R19, R20. Se implementan en v2.0. | 🟠 | Abierta |
| **H-PROMPT-09** | El `systemPrompt` del on-demand **no tiene la regla 12.bis** (coherencia Sección 0 ↔ Sección II). Riesgo de reintroducir el bug N29. | 🔴 | Abierta |
| **H-PROMPT-10** | R17 no menciona `acciones_operativas`. El modelo recibe las acciones pero no tiene instrucción de usarlas. Parte de H-PROMPT-08. | 🟠 | Abierta |
| **H-REPORTE-02** | `reporteDiario.mjs` usa `@vercel/blob` sin token inyectado. Falla silenciosamente. | 🔴 | Abierta (ver `06_PENDIENTES.md` §2.2) |
| **H-REPORTE-03** | `debeGenerarReporteDiario` reintenta 8 veces/día porque la bitácora nunca registra el intento (el diario falla antes de devolver el `registro_bitacora`). | 🔴 | Abierta |

*(H-PROMPT-01 y H-PROMPT-02 fueron cerrados en las sesiones del 22/10/2026 y 27/10/2026 respectivamente).*

---

## 11. Propuesta de implementación de los fixes

Las propuestas de implementación (bloques de código, pruebas PowerShell, commits atómicos) de los fixes H-PROMPT-05, 06, 07, 08, 09 y 10 viven en `docs/archivo/FIXES_PROMPTS_2026-10-28.md`.

**Regla:** cuando un fix se aplique:

1. Se archiva el archivo temporal `FIXES_PROMPTS_2026-10-28.md` con la fecha de cierre (o se elimina si todos los fixes se aplican).
2. El fix aplicado se registra en `04_HISTORIAL.md` con síntoma, causa, solución, verificación y commit.
3. El ítem correspondiente de §10 se marca como cerrado con la fecha.
4. Este documento (§5) no contiene los bloques de código. Solo describe qué falta y remite al archivo temporal.

