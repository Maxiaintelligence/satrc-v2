# SatRC V2.0 — Ingeniería de Prompts (Agente SARA)

El sistema usa **Groq** (`openai/gpt-oss-120b`) para redactar los reportes. Hay dos prompts distintos.

---

## 1. Prompt del Reporte Diario / On-Demand

- **Ubicación:** `scripts/reportes/reporteDiario.mjs` y `api/reporte-ondemand.js`.
- **Estructura:** devuelve un JSON estricto con 7 secciones (`seccion_0_decision` a `seccion_VI_deslinde`).

### Reglas críticas del prompt

| Regla | Descripción |
|---|---|
| **Regla 3 (Síntesis)** | No enumerar las 14 zonas. Destacar 2-3 activas y agrupar el resto. |
| **Regla 10 (Viento)** | < 40 km/h (suave), 40-59 km/h (moderado), ≥ 60 km/h (fuerte). Contextualizar zonas altas. |
| **Regla 12.bis (Coherencia)** | Las zonas de la Sección 0 **DEBEN** ser las mismas de la Sección II. |
| **Regla anti-alucinación** | Prohibido inventar sistemas sinópticos (frentes, ciclones) si los datos no lo dicen. |

> **Nota de Etapa 3:** el bloque de datos regionales siempre incluye la ventana de 72 h (ayer, hoy, mañana) para dar contexto temporal completo al LLM.

---

## 2. Prompt del Dictamen (Runner cada 3 horas)

- **Ubicación:** `scripts/ejecutar_sara_autonomo.mjs`.
- **Estructura:** devuelve un JSON corto (`estado_situacion`, `color`, `titulo`, `comentario_oficial`).

### Regla crítica de coherencia (N34)

| Condición | Título | Color |
|---|---|---|
| N4 > 0 | **Emergencia** | `#EF4444` |
| N4 = 0 y N3 > 0 | **Alerta** | `#F97316` |
| N4 = 0 y N3 = 0 | **Normal** | `#10B981` |

> **El LLM no puede decidir el nivel**, solo redactar basándose en los números que le da el sistema.