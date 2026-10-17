# SatRC V2.0 — Ingeniería de Prompts (Agente SARA)

El sistema usa Groq (`openai/gpt-oss-120b`) para redactar los reportes. Hay dos prompts distintos:

## 1. Prompt del Reporte Diario / On-Demand
Ubicación: `scripts/reportes/reporteDiario.mjs` y `api/reporte-ondemand.js`.
Estructura: Devuelve un JSON estricto con 7 secciones (`seccion_0_decision` a `seccion_VI_deslinde`).

**Reglas Críticas del Prompt:**
- **Regla 3 (Síntesis):** No enumerar las 14 zonas. Destacar 2-3 activas y agrupar el resto.
- **Regla 10 (Viento):** <40 km/h (suave), 40-59 (moderado), ≥60 (fuerte). Contextualizar zonas altas.
- **Regla 12.bis (Coherencia):** Las zonas de la Sección 0 DEBEN ser las mismas de la Sección II.
- **Regla Anti-Alucinación:** Prohibido inventar sistemas sinópticos (frentes, ciclones) si los datos no lo dicen.

## 2. Prompt del Dictamen (Runner cada 3 horas)
Ubicación: `scripts/ejecutar_sara_autonomo.mjs`.
Estructura: Devuelve un JSON corto (`estado_situacion`, `color`, `titulo`, `comentario_oficial`).

**Regla Crítica de Coherencia (N34):**
- Si `N4 > 0` -> Título DEBE ser de Emergencia, color `#EF4444`.
- Si `N4 = 0` y `N3 > 0` -> Título DEBE ser de Alerta, color `#F97316`.
- Si `N4 = 0` y `N3 = 0` -> Título Normal, color `#10B981`.
- *El LLM no puede decidir el nivel, solo redactar basándose en los números que le da el sistema.*