# SatRC V2.0 — Ingeniería de Prompts (Agente SARA)

El sistema usa **Groq** (`openai/gpt-oss-120b`) para redactar los reportes. Hay dos prompts distintos.

---

## 1. Prompt del Reporte Diario / On-Demand

- **Ubicación:** `scripts/reportes/reporteDiario.mjs` y `api/reporte-ondemand.js`.
- **Estructura:** devuelve un JSON estricto con 7 secciones (`seccion_0_decision` a `seccion_VI_deslinde`).
- **Límite de tokens:** `max_completion_tokens: 4096` (Hotfix H8.5). *Sin este límite, el LLM cortaba el JSON a la mitad y Groq devolvía error 400.*

### System Prompt (Extracto de las Reglas de Oro)

El System Prompt instruye a SARA a actuar como una Oficial Meteoróloga, con las siguientes reglas obligatorias:

1. **USA NOMBRES RECONOCIBLES:** Refiérete a las zonas por su nombre común (Altiplano Tula-Actopan, Pachuca Norte, Tulancingo). NUNCA uses claves técnicas (ACT, APN, HUA, etc.).
2. **SECCIÓN 0 (DECISIÓN OPERATIVA):** Es la más importante. Debe contener qué debe hacer la red de brigadas, en qué zonas y con qué prioridad. Máximo 3 líneas.
3. **SECCIÓN I (SÍNTESIS):** Menciona SOLO las 2-3 zonas con mayor actividad. Agrupa el resto en una frase ("las demás zonas permanecen en condiciones normales"). NO enumeres las 14 zonas.
4. **SECCIÓN II (FOCO):** Para las 3 zonas más críticas del día, incluye: (a) zona, (b) dato reportado, (c) qué hacer. Si hay N3/N4, esas van primero.
5. **SECCIÓN III (EVOLUCIÓN):** Describe qué cambió respecto a AYER. ¿Qué zonas empeoraron? ¿Qué mejoró?
6. **SECCIÓN IV (CICLO 48H):** Dividida en 3 viñetas: "Ayer", "Hoy", "Mañana". Incluye el aviso SMN vigente.
7. **SECCIÓN V (CHECKLIST):** Recomendaciones por MOMENTO: (a) Antes de salir, (b) Durante la actividad, (c) Si empeora, (d) Para reanudar.
8. **SECCIÓN VI (DESLINDE):** Texto formal breve de subordinación a Protección Civil y CONAGUA.
9. **TRADUCCIÓN A DECISIONES:** N1 = continuar; N2 = reforzar precauciones; N3 = restringir actividades específicas; N4 = suspender actividades expuestas.
10. **CLASIFICACIÓN DE VIENTO:** Ráfagas < 40 = suaves; 40-59 = moderadas; ≥ 60 = fuertes. (Contextualizar zonas altas).
11. **ANTI-ALUCINACIÓN:** Usa EXCLUSIVAMENTE los datos del bloque "DATOS REGIONALES" y del "AVISO OFICIAL". PROHIBIDO inventar sistemas sinópticos (frentes, ciclones) si los datos no lo dicen.
12. **COHERENCIA INTER-SECCIONES:** Verifica que ninguna sección contradiga a otra.
12.bis **COHERENCIA SECCIÓN 0 ↔ SECCIÓN II (CRÍTICO):** Las zonas mencionadas en la Sección 0 DEBEN ser EXACTAMENTE las mismas de la Sección II. No puede haber divergencia.
13. **VOCABULARIO:** Usa "localidades" (no "municipios" ni "comunidades").
14. **FORMATO:** Usa viñetas en las secciones 0, II, III, IV y V.

### User Prompt (Estructura de Datos)

Se le inyectan los siguientes bloques a SARA:
- Fecha y hora de emisión.
- Tipo de reporte (DIARIO AUTOMÁTICO o ON-DEMAND).
- Bloque SMN: (Aviso Oficial o "Sin aviso extraordinario").
- Bloque Regional: (Datos de las 14 zonas, ventana de 72h).
- Semáforo Diocesano (N4, N3, N2, N1).
- Comunidades críticas bajo tensión (JSON).

---

## 2. Prompt del Dictamen (Runner cada 3 horas)

- **Ubicación:** `scripts/ejecutar_sara_autonomo.mjs`.
- **Estructura:** devuelve un JSON corto (`estado_situacion`, `color`, `titulo`, `comentario_oficial`).
- **Límite de tokens:** `max_completion_tokens: 4096` (Hotfix H8.5).

### Regla crítica de coherencia (N34)

El System Prompt del runner es **determinista** para evitar alucinaciones:

| Condición | Título | Color |
|---|---|---|
| N4 > 0 | **Emergencia** | `#EF4444` |
| N4 = 0 y N3 > 0 | **Alerta** | `#F97316` |
| N4 = 0 y N3 = 0 | **Normal** | `#10B981` |

> **El LLM no puede decidir el nivel**, solo redactar basándose en los números que le da el sistema. El prompt incluye la instrucción textual: *"Esta regla es determinista. NO puedes declarar 'Normal' si hay N4 > 0 o N3 > 0".*

---

## 3. Manejo de Errores y Fallbacks

### Groq HTTP 400 (JSON truncado)
- **Problema:** El modelo se quedaba sin tokens antes de cerrar el JSON.
- **Solución (H8.5):** Se agregó `max_completion_tokens: 4096`. Si Groq sigue fallando, el backend usa un fallback de plantilla segura (sin IA).

### Groq HTTP 429 (Rate Limit)
- **Problema:** Muchas peticiones en poco tiempo.
- **Solución:** El código captura el error y devuelve una plantilla estática para que la app no se rompa.

### Mojibake en los textos (N27)
- **Problema:** Groq devuelve el texto con doble encoding UTF-8.
- **Solución:** El runner y la API pasan todas las respuestas por `repararMojibake()` y `repararObjeto()` antes de guardar en el Blob o enviar al frontend.

---

## 4. Validación de Respuestas

La respuesta de Groq es validada antes de ser aceptada:
1. **Si es JSON:** Se intenta parsear con `JSON.parse()`.
2. **Si falla el parseo:** Se loguea el error (`Groq devolvió formato inválido`) y se usa el fallback estático.
3. **Validación de campos:** Se verifica que `titulo` y `comentario_oficial` no estén vacíos y sean strings válidos antes de aceptar la respuesta del LLM.