# SatRC V2.0 — Ingeniería de prompts (SARA)

> **Versión del documento:** 2.5 (27/10/2026)
> **Propósito:** describir los prompts que usa SARA, las reglas que contienen, cómo se alimentan con datos y qué falta por adaptar.
> **Fuente de verdad:** el código de los archivos citados. Si este documento y el código no coinciden, prevalece el código.

---

## 1. Qué es SARA

SARA es el agente que redacta los textos de la situación meteorológica a partir de datos que el sistema ya calculó. Se llama **Sistema de Alerta y Respuesta Automatizada**.

**Principio:** SARA redacta; no decide. El nivel de cada localidad, el vector dominante y las acciones operativas los calcula el motor (ver `03_MOTOR_RIESGO.md`). SARA convierte esos datos en texto para brigadas y coordinadores.

**Modelo:** `openai/gpt-oss-120b` a través de Groq. Se intentó migrar a un modelo más rápido, pero el modelo `gpt-oss-120b` es el que está disponible en la cuenta y responde en un tiempo aceptable (4-5 segundos).

---

## 2. Prompts vigentes

| Prompt | Archivo | Salida | Frecuencia |
|---|---|---|---|
| Reporte diario | `scripts/reportes/reporteDiario.mjs` | Reporte de 7 secciones (JSON) | Diario, 06:00 hora de México |
| Reporte bajo demanda | `api/reporte-ondemand.js` | Reporte de 7 secciones (JSON) | Cuando un operador lo solicita |
| Dictamen del runner | `scripts/ejecutar_sara_autonomo.mjs` | Dictamen corto: estado, color, título y comentario | Cada 3 horas |

Los dos reportes comparten las mismas reglas base y las mismas reglas multivectoriales. El dictamen del runner tiene su propio prompt, más breve (ver §5).

**Límite de salida:** `max_completion_tokens: 4096` en los reportes, y `2500` en el endpoint on-demand. Sin este límite, el modelo cortaba el JSON a la mitad y Groq devolvía error 400 (ver §7).

---

## 3. Reglas base de los reportes

El prompt de los reportes contiene reglas numeradas. Su contenido vigente es:

| # | Regla |
|---|---|
| 1 | Usar los nombres reconocibles de las zonas (por ejemplo, "Pachuca Norte"). Nunca usar claves técnicas. |
| 2 | Sección 0 (decisión operativa): qué debe hacer la red de brigadas, en qué zonas y con qué prioridad. Máximo tres líneas. |
| 3 | Sección I (síntesis): mencionar solo las dos o tres zonas con más actividad. El resto se agrupa en una frase. |
| 4 | Sección II (foco): para las tres zonas más críticas, indicar zona, dato reportado y qué hacer. Las de nivel 3 y 4 van primero. |
| 5 | Sección III (evolución): qué cambió respecto al día anterior. |
| 6 | Sección IV (ciclo de 48 horas): tres viñetas, "Ayer", "Hoy" y "Mañana". Incluye el aviso del SMN vigente. |
| 7 | Sección V (recomendaciones): por momento: antes de salir, durante la actividad, si empeora y para reanudar. |
| 8 | Sección VI (deslinde): texto breve de subordinación a Protección Civil y CONAGUA. |
| 9 | Traducción a decisiones: nivel 1 continuar; nivel 2 reforzar precauciones; nivel 3 restringir actividades específicas; nivel 4 suspender actividades expuestas. |
| 10 | Clasificación del viento: ráfagas menores a 40 km/h son suaves; de 40 a 59 son moderadas; de 60 en adelante son fuertes. |
| 11 | Anti-alucinación: usar solo los datos del bloque regional y del aviso oficial. No inventar sistemas sinópticos. |
| 12 | Coherencia entre secciones. La regla 12.bis exige que las zonas de la Sección 0 sean exactamente las de la Sección II. |
| 13 | Vocabulario: "localidades", no "municipios" ni "comunidades". |
| 14 | Formato: viñetas en las secciones 0, II, III, IV y V. |
| 15 | CONTROL ESTRICTO DE EMERGENCIAS: Si Nivel 4 = 0 y Nivel 3 = 0, BAJO NINGUNA CIRCUNSTANCIA usar "suspender actividades", "evacuar" o "emergencia". Usar lenguaje de precaución y vigilancia. |

> **Nota de numeración:** las reglas 15 y 16 no existen en la versión original, pero ahora la Regla 17 (multivectorial) y la regla de control de emergencias se inyectan dinámicamente.

---

## 4. Reglas multivectoriales (Etapa 5)

**Archivo:** `src/lib/compartido/promptsMultivector.js` (constante `REGLAS_MULTIVECTOR`)
**Se inyectan en:** `api/reporte-ondemand.js` y `scripts/reportes/reporteDiario.mjs`

| # | Regla | Qué pide a SARA |
|---|---|---|
| 17 | Leer el vector dominante y redactar según su lenguaje | Cada foco trae `vector_dominante`, `tipo_amenaza` y `niveles_por_vector`. Hidrológico habla de lluvias; viento, de ráfagas y daños a techos; térmico, de frío, heladas, nevadas o calor; convectivo, de granizo y downbursts; los compuestos combinan ambos lenguajes. |
| 18 | Traducir el vector a acciones operativas | Usar el arreglo `acciones_operativas` del foco en la Sección 0 y en la Sección II. No inventar acciones genéricas. |
| 19 | Sección V condicional | Si un foco tiene un vector distinto de hidrológico, agregar una viñeta específica para ese vector. |
| 20 | Subtipos específicos | Usar el campo `tipo_amenaza` (NEVADA, GRANIZO, DOWNBURST, etc.) para redactar la causa exacta. |

**Verificado:** las reglas se inyectan en los dos prompts de reporte.

---

## 5. Dictamen del runner

**Archivo:** `scripts/ejecutar_sara_autonomo.mjs`
**Salida:** `estado_situacion`, `color`, `titulo` y `comentario_oficial`.

El título y el color no los decide el modelo. Se fijan según el conteo de niveles:

| Condición | Estado | Color | Título |
|---|---|---|---|
| Hay al menos una localidad en N4 | `SITUACION_CRITICA` | `#EF4444` | Emergencia |
| No hay N4, pero hay N3 | `SITUACION_GRAVE` | `#F97316` | Alerta temprana |
| Solo hay N1 y N2 | `SITUACION_NORMAL` | `#10B981` | Sereno |

El prompt indica que la regla es determinista y que el conteo de niveles es la fuente de verdad.

**Estado (H-PROMPT-01 cerrado):** El dictamen del runner **ya importa** `REGLAS_MULTIVECTOR` y utiliza el campo `tipo_amenaza` para redactar el comentario. Los ejemplos de título ahora reflejan la amenaza real.

---

## 6. Datos que recibe SARA

### 6.1 Reportes

Cada reporte recibe, en el mensaje del usuario:

- Fecha y hora de emisión, y tipo de reporte (diario automático o bajo demanda).
- Bloque del SMN: aviso oficial o "sin aviso extraordinario".
- Bloque regional: datos de las 14 zonas, con ventana de 72 horas.
- Semáforo: conteo de localidades en N4, N3, N2 y N1.
- Focos críticos: localidades en N3 y N4.

Cada foco crítico incluye, en el reporte diario:

| Campo | Origen |
|---|---|
| `nombre`, `municipio`, `nivel`, `causa`, `pendiente`, `acceso` | Motor hidrológico y catálogo de localidades |
| `vector_dominante` | Orquestador (Etapa 4 y 5) |
| `tipo_amenaza` | Orquestador (Etapa 5) |
| `niveles_por_vector` | Orquestador |
| `acciones_operativas` | Orquestador |

### 6.2 Vectores posibles

Los valores de `vector_dominante` vienen del orquestador. Son siete, en tres grupos:

| Valor | Tipo |
|---|---|
| `HIDROLOGICO`, `VIENTO`, `TERMICO`, `CONVECTIVO` | Simples |
| `HIDRO_VIENTO`, `CONVECTIVO_VIENTO`, `HIDRO_TERMICO` | Compuestos |
| `SIN_AMENAZA` | Cuando el nivel global es N1 (Etapa 5) |

Los subtipos de los evaluadores (helada agrícola, nevada, granizo, downburst, supercélula) ahora viajan en el campo `tipo_amenaza` (H-PROMPT-02 cerrado). SARA los recibe de forma estructurada, no solo en el texto del diagnóstico.

---

## 7. Validación y respaldos

1. **Parseo:** la respuesta se convierte con `JSON.parse`. Si falla, se registra el error y se usa una plantilla estática.
2. **Campos obligatorios:** `titulo` y `comentario_oficial` deben existir y no estar vacíos. Si no, se usa la plantilla.
3. **HTTP 400 (JSON truncado):** se corrigió con el límite de tokens. Si vuelve a ocurrir, la plantilla estática evita que la aplicación falle.
4. **HTTP 429 (límite de uso de Groq):** se devuelve la **plantilla estática de respaldo** (Plan B), avisando que la IA está saturada, pero sin romper la app.
5. **Codificación:** toda respuesta pasa por `repararMojibake` antes de guardarse o enviarse.

**Principio:** si SARA falla, la aplicación sigue funcionando con texto fijo. Un reporte sin redacción de IA no debe bloquear a los operadores. Este principio se validó durante la migración del 27/10/2026.

---

## 8. Estado de la adaptación multivectorial (H7)

| Parte | Estado |
|---|---|
| Reglas 17 a 20 en los dos prompts de reporte | ✅ Hecho |
| Campos `vector_dominante`, `niveles_por_vector`, `tipo_amenaza` y `acciones_operativas` en los focos | ✅ Hecho |
| Sección 0 y Sección II redactadas con las acciones del motor | ✅ Hecho |
| Dictamen del runner con lenguaje multivectorial | ✅ Hecho (H-PROMPT-01 cerrado) |
| Subtipos de amenaza disponibles para SARA | ✅ Hecho (H-PROMPT-02 cerrado) |
| Pruebas automáticas de los prompts | ❌ No existen (H-PROMPT-03) |

---

## 9. Reglas para editar los prompts

1. **Cambiar el texto del prompt no es un cambio menor.** Afecta lo que lee cada operador. Verificar con una corrida real antes de dar el cambio por bueno.
2. **Las reglas 17 a 20 viven en un solo archivo** (`promptsMultivector.js`) y se reutilizan en los dos reportes. No copiarlas a mano.
3. **La numeración de reglas es la del código.** Si se agrega una regla, usar el siguiente número libre y actualizar la tabla de este documento.
4. **No incluir valores de claves ni datos personales** en el texto de los prompts ni en la documentación.
5. **El dictamen del runner y los reportes tienen prompts separados.** Un cambio en uno no se propaga al otro; hay que revisar ambos.
6. **El límite de salida es parte del diseño.** Subirlo sin revisar la longitud de los reportes puede volver a cortar el JSON o causar Timeout en Vercel.

---

## 10. Deuda de prompts

| ID | Deuda | Sev. | Referencia |
|---|---|---|---|
| H-PROMPT-03 | No hay pruebas automáticas que verifiquen que los prompts reciben los campos esperados y que la salida cumple las reglas. | 🟡 | §8 |

*(H-PROMPT-01 y H-PROMPT-02 fueron cerrados en la sesión del 22/10/2026 y 27/10/2026, respectivamente).*