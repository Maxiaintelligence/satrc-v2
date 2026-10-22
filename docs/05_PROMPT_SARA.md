# SatRC V2.0 — Ingeniería de Prompts (Agente SARA)

> **Versión:** 2.3.0 (Cierre de Etapa 4)
> **Última actualización:** 22 de octubre de 2026.
> **Estado:** los prompts actuales son de Etapa 3 (solo hidrología). La Etapa 4 agregó 3 evaluadores más (viento, térmico, convectivo) y el orquestador. **Los prompts todavía no se adaptaron a multiamenaza** (deuda H7, V3.0). Ver [§5](#5-prompts-multiamenaza-pendiente-h7).

El sistema usa **Groq** (`openai/gpt-oss-120b`) para redactar los reportes. Hay dos prompts distintos.

---

## 1. Prompt del Reporte Diario / On-Demand

- **Ubicación:** `scripts/reportes/reporteDiario.mjs` y `api/reporte-ondemand.js`.
- **Estructura:** devuelve un JSON estricto con 7 secciones (`seccion_0_decision` a `seccion_VI_deslinde`).
- **Límite de tokens:** `max_completion_tokens: 4096` (Hotfix H8.5). *Sin este límite, el LLM cortaba el JSON a la mitad y Groq devolvía error 400.*

### 1.1 System Prompt (extracto de las Reglas de Oro)

El System Prompt instruye a SARA a actuar como una Oficial Meteoróloga, con las siguientes reglas obligatorias:

1. **USA NOMBRES RECONOCIBLES:** refiérete a las zonas por su nombre común (Altiplano Tula-Actopan, Pachuca Norte, Tulancingo). NUNCA uses claves técnicas (ACT, APN, HUA, etc.).
2. **SECCIÓN 0 (DECISIÓN OPERATIVA):** es la más importante. Debe contener qué debe hacer la red de brigadas, en qué zonas y con qué prioridad. Máximo 3 líneas.
3. **SECCIÓN I (SÍNTESIS):** menciona SOLO las 2-3 zonas con mayor actividad. Agrupa el resto en una frase ("las demás zonas permanecen en condiciones normales"). NO enumeres las 14 zonas.
4. **SECCIÓN II (FOCO):** para las 3 zonas más críticas del día, incluye: (a) zona, (b) dato reportado, (c) qué hacer. Si hay N3/N4, esas van primero.
5. **SECCIÓN III (EVOLUCIÓN):** describe qué cambió respecto a AYER. ¿Qué zonas empeoraron? ¿Qué mejoró?
6. **SECCIÓN IV (CICLO 48H):** dividida en 3 viñetas: "Ayer", "Hoy", "Mañana". Incluye el aviso SMN vigente.
7. **SECCIÓN V (CHECKLIST):** recomendaciones por MOMENTO: (a) antes de salir, (b) durante la actividad, (c) si empeora, (d) para reanudar.
8. **SECCIÓN VI (DESLINDE):** texto formal breve de subordinación a Protección Civil y CONAGUA.
9. **TRADUCCIÓN A DECISIONES:** N1 = continuar; N2 = reforzar precauciones; N3 = restringir actividades específicas; N4 = suspender actividades expuestas.
10. **CLASIFICACIÓN DE VIENTO:** ráfagas < 40 = suaves; 40-59 = moderadas; ≥ 60 = fuertes. (Contextualizar zonas altas).
11. **ANTI-ALUCINACIÓN:** usa EXCLUSIVAMENTE los datos del bloque "DATOS REGIONALES" y del "AVISO OFICIAL". PROHIBIDO inventar sistemas sinópticos (frentes, ciclones) si los datos no lo dicen.
12. **COHERENCIA INTER-SECCIONES:** verifica que ninguna sección contradiga a otra.
    - **12.bis — COHERENCIA SECCIÓN 0 ↔ SECCIÓN II (CRÍTICO):** las zonas mencionadas en la Sección 0 DEBEN ser EXACTAMENTE las mismas de la Sección II. No puede haber divergencia.
13. **VOCABULARIO:** usa "localidades" (no "municipios" ni "comunidades").
14. **FORMATO:** usa viñetas en las secciones 0, II, III, IV y V.

### 1.2 User Prompt (estructura de datos)

Se le inyectan los siguientes bloques a SARA:

- Fecha y hora de emisión.
- Tipo de reporte (DIARIO AUTOMÁTICO o ON-DEMAND).
- Bloque SMN: (Aviso Oficial o "Sin aviso extraordinario").
- Bloque Regional: (datos de las 14 zonas, ventana de 72 h).
- Semáforo Diocesano (N4, N3, N2, N1).
- Comunidades críticas bajo tensión (JSON).

> **Nota de Etapa 4:** desde H6.4, el `paqueteMaestro` incluye también `vector_dominante` y `niveles_por_vector` en cada evaluación. **Pero SARA todavía no los usa en el prompt.** El User Prompt actual solo inyecta los conteos del semáforo (N4/N3/N2/N1) y los focos críticos como `{nombre, municipio, nivel, causa, pendiente, acceso}`. Los campos nuevos están disponibles para H7 (ver §5).

---

## 2. Prompt del Dictamen (Runner cada 3 horas)

- **Ubicación:** `scripts/ejecutar_sara_autonomo.mjs`.
- **Estructura:** devuelve un JSON corto (`estado_situacion`, `color`, `titulo`, `comentario_oficial`).
- **Límite de tokens:** `max_completion_tokens: 4096` (Hotfix H8.5).

### 2.1 Regla crítica de coherencia (N34)

El System Prompt del runner es **determinista** para evitar alucinaciones:

| Condición | Título | Color |
|---|---|---|
| N4 > 0 | **Emergencia** | `#EF4444` |
| N4 = 0 y N3 > 0 | **Alerta** | `#F97316` |
| N4 = 0 y N3 = 0 | **Normal** | `#10B981` |

> **El LLM no puede decidir el nivel**, solo redactar basándose en los números que le da el sistema. El prompt incluye la instrucción textual: *"Esta regla es determinista. NO puedes declarar 'Normal' si hay N4 > 0 o N3 > 0".*

> **Nota de Etapa 4:** desde H6.4, los conteos N4/N3/N2/N1 que recibe SARA reflejan el semáforo multiamamenaza (no solo hidrológico). Pero el prompt **sigue redactando como "experta en lluvia"** (ver §5).

---

## 3. Manejo de Errores y Fallbacks

### 3.1 Groq HTTP 400 (JSON truncado)

- **Problema:** el modelo se quedaba sin tokens antes de cerrar el JSON.
- **Solución (H8.5):** se agregó `max_completion_tokens: 4096`. Si Groq sigue fallando, el backend usa un fallback de plantilla segura (sin IA).

### 3.2 Groq HTTP 429 (Rate Limit)

- **Problema:** muchas peticiones en poco tiempo.
- **Solución:** el código captura el error y devuelve una plantilla estática para que la app no se rompa.

### 3.3 Mojibake en los textos (N27)

- **Problema:** Groq devuelve el texto con doble encoding UTF-8.
- **Solución:** el runner y la API pasan todas las respuestas por `repararMojibake()` y `repararObjeto()` antes de guardar en el Blob o enviar al frontend.

---

## 4. Validación de Respuestas

La respuesta de Groq es validada antes de ser aceptada:

1. **Si es JSON:** se intenta parsear con `JSON.parse()`.
2. **Si falla el parseo:** se loguea el error (`Groq devolvió formato inválido`) y se usa el fallback estático.
3. **Validación de campos:** se verifica que `titulo` y `comentario_oficial` no estén vacíos y sean strings válidos antes de aceptar la respuesta del LLM.

---

## 5. Prompts Multiamenaza (pendiente H7)

### 5.1 Diagnóstico: SARA sigue redactando como "experta en lluvia"

**Estado actual (post-Etapa 4):** el motor evalúa 4 vectores de riesgo (hidrología, viento, térmico, convectivo). El `paqueteMaestro` incluye `vector_dominante` y `niveles_por_vector` por cada localidad.

**Pero los prompts de SARA no lo reflejan.** El System Prompt sigue diciendo:

> *"Eres SARA, Oficial Meteoróloga de Cáritas Pastoral Social... Tu misión es redactar el REPORTE OPERATIVO DE SITUACIÓN METEOROLÓGICA para brigadistas y coordinadores pastorales."*

Y las reglas de las secciones describen solo lluvia (lluvias torrenciales, deslaves, inundaciones). **No mencionan viento, frío, calor, granizo ni downbursts.**

**Consecuencia:** si una localidad es N4 por un downburst (convectivo + viento), SARA va a redactar "Emergencia por lluvias torrenciales" (aunque no haya lluvia). **Confunde a los operadores.**

### 5.2 Qué falta adaptar

#### En el System Prompt del reporte diario / on-demand

Agregar una regla 15 (o similar) que instruya a SARA a leer `vector_dominante` de cada foco crítico y redactar según el vector:

| Vector | Lenguaje sugerido | Acción operativa sugerida |
|---|---|---|
| `HIDROLOGICO` | Lluvias, deslaves, inundaciones | Restringir caminos, evacuar riberas |
| `VIENTO` | Ráfagas fuertes, caída de árboles, techos | Asegurar láminas, evitar actividades al aire libre |
| `TERMICO` (FRIO_EXTREMO / HELADA_AGRICOLA / NEVADA) | Frío extremo, heladas, nevadas | Abrigo, proteger cultivos, cerrar accesos |
| `TERMICO` (CALOR_EXTREMO) | Golpe de calor, estrés térmico | Hidratación, evitar sol |
| `CONVECTIVO` (GRANIZO / DOWNBURST / SUPERCELL) | Granizo, ráfagas descendentes, supercélula | Resguardo de vehículos, evacuación preventiva |
| `HIDRO_VIENTO` | Lluvia + viento = árboles caídos | Restringir circulación, reportar caídas |
| `CONVECTIVO_VIENTO` | Downburst (tormenta + viento) | Refugio en estructuras sólidas |

#### En el User Prompt

Inyectar el `vector_dominante` y `niveles_por_vector` de cada foco crítico:

```js
// Antes:
focosCriticos: [
  { nombre, municipio, nivel, causa, pendiente, acceso }
]

// Después (H7):
focosCriticos: [
  {
    nombre, municipio, nivel, causa, pendiente, acceso,
    vector_dominante,           // "VIENTO", "HIDROLOGICO", etc.
    niveles_por_vector,         // { hidrologico, viento, termico, convectivo }
    acoplamiento                // 0.0 a 1.0
  }
]
```

#### En la Sección 0 (Decisión Operativa)

Si el `vector_dominante` no es hidrológico, SARA debe redactar la decisión con el lenguaje del vector. Ejemplo:

> "Alerta por vientos fuertes en Pachuca Norte. Acción: asegurar techos y láminas, evitar actividades al aire libre. Brigadas de Pachuca: revisar caída de árboles en caminos de terracería."

#### En la Sección II (Foco)

Describir el vector dominante de cada foco:

> "Pachuca Metropolitana Norte — Viento N4 (vEq 95 km/h) + acoplamiento hidro-viento (0.35). Causa: ráfagas huracanadas con suelo saturado. Acción: evacuación preventiva de estructuras ligeras."

### 5.3 Estado actual y decisión

**Estado:** deuda aceptada para V3.0. No se implementó en Etapa 4 porque:

1. El motor multiamenaza se validó primero (Etapa 4).
2. Los prompts actuales describen correctamente el 90 % de los casos (lluvia en Sierra).
3. La adaptación de prompts requiere re-evaluación de 90 días con eventos reales de viento, frío y granizo para calibrar el lenguaje.
4. Requiere cambios en `reporte-ondemand.js` y `reporteDiario.mjs` (dos archivos separados, con prompts ligeramente distintos).

**Trabajo estimado para H7:** 1-2 h. **Riesgo:** bajo (solo strings). No toca el motor.

**Mitigación actual:** mientras tanto, SARA incluye `comentario_oficial` con los conteos reales (N4=11, N3=1, etc.). El operador puede ver que hay 11 N4 aunque SARA diga "lluvias torrenciales". El semáforo de la UI muestra el nivel correcto. El problema es de narrativa, no de datos.

Documentado en `06_PENDIENTES.md` como H7. Se implementará en V3.0 junto con los prompts de los nuevos vectores (heladas, incendios, etc.).

---

*Fin del documento de prompts. SatRC V2.0 — Cáritas Pastoral Social • Arquidiócesis de Tulancingo.*