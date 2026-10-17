# SatRC V2.0 — Backlog de Pendientes (Post-Octubre 2026)

## 1. Bugs Pendientes de C2c
- **N32 (Cosmético):** Unificar el nombre "Protección Civil estatal" en el prompt on-demand (actualmente dice "Oficina de Protección Civil" a veces).
- **N26 (Estructural):** Aumentar la cobertura de zonas en el runner. Actualmente a veces falla 5/14 zonas. Requiere aplicar el mismo fix de concurrencia limitada que se hizo en el frontend.

## 2. Deuda Técnica Aceptada (Para V3.0)
- **Mojibake en Blob:** Investigar por qué `@vercel/blob` en GitHub Actions guarda con doble encoding.
- **Funciones Duplicadas:** `repararMojibake`, `normalizarDatosRegionales` y `construirBloqueRegional` están duplicadas en `api/reporte-ondemand.js` y `scripts/reportes/reporteDiario.mjs`. Extraer a módulo compartido.
- **Confiabilidad del Banner:** El banner de SMN usa scraping. Si el HTML del SMN cambia, el parser fallará.

## 3. Roadmap V3.0 (Sistema Experto)
- **Percentiles Históricos:** Calcular umbrales dinámicos basados en los últimos 30 años (no números estáticos como 65mm).
- **Vectores de Riesgo Faltantes:**
  - Temperatura (Olas de calor / Heladas).
  - Viento (Sistemas ciclónicos / Nortes).
  - Convección (Tormentas severas con GLM).
  - Incendios (Índice de sequía).
- **Autenticación Real:** Reemplazar la clave hardcodeada por un sistema de login real.

## 4. Estado de los Fixes Recientes (Octubre 2026)
- [x] N29: Coherencia Sección 0 / Sección II.
- [x] N33: Parser SMN en página principal.
- [x] N34: Coherencia de Groq con N4/N3.
- [x] N27: Parche de mojibake en lectura.
- [x] N30/N31: Reintento automático y Sección 0 en TXT.