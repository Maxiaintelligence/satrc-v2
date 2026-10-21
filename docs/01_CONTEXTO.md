# SatRC V2.0 — Contexto y Manifiesto

## 1. ¿Qué es SatRC V2.0?

SatRC (Sistema de Alerta Temprana y Riesgos Climáticos) es una **PWA (Progressive Web App)** diseñada para la **Cáritas Pastoral Social de la Arquidiócesis de Tulancingo**. Su propósito es proteger la vida y el patrimonio de las comunidades rurales frente a amenazas meteorológicas (lluvias, deslaves, inundaciones, vientos, niebla).

**En una frase:** traduce datos meteorológicos abiertos (GFS + ICON + GEM vía Open-Meteo) y avisos oficiales (SMN/CONAGUA) en un semáforo diocesano de 4 niveles, con reportes redactados por IA (SARA) y una bitácora auditable con hash SHA-256.

---

## 2. Usuarios objetivo

1. **Operadores diocesanos:** Coordinadores de Cáritas con acceso a la "Sala Operativa" (protegida por clave personal). Generan reportes, monitorean el semáforo, consultan la bitácora.
2. **Público general:** Párrocos, brigadistas y fieles. Consultan el "Monitor Climático" (público) para ver el estado del clima en su localidad.
3. **Sistema autónomo:** Un runner (GitHub Actions) que corre cada 3 horas sin intervención humana. Actualiza el Blob con el estado diocesano y la bitácora.

---

## 3. Alcance geográfico

- **14 zonas de resguardo** (5 en Altiplano, 9 en Sierra/Huasteca).
- **405 localidades** monitoreadas (población > 1,000 hab).
- **Territorio:** Hidalgo, Sierra Norte de Puebla y una porción de Veracruz.

**Zonas:**
- **Altiplano (5):** ACT, APN, PMN, PMS, TIZ.
- **Sierra (9):** ATG, CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH.

Cada zona usa la **localidad más poblada** como nodo meteorológico de referencia (ADR-001).

---

## 4. Principios éticos

- **Subordinación institucional:** SatRC no sustituye a Protección Civil ni a CONAGUA. Las reconoce y se subordina a ellas.
- **Transparencia:** Todas las decisiones quedan registradas en una bitácora auditable SHA-256.
- **Preferencia por el falso positivo:** Es mejor alertar de más que no alertar. El costo de una falsa alarma es bajo; el costo de no avisar es una vida.
- **Trazabilidad:** Cada acción del sistema (corrida cron, reporte on-demand, reporte diario) deja una entrada en la bitácora con hash encadenado.

---

## 5. Límites del sistema

- **No emite avisos oficiales**, los traduce.
- **No ordena evacuaciones**, las recomienda.
- **No tiene fines de lucro.**
- **No predice el clima**, consensúa modelos existentes.
- **No reemplaza a Protección Civil ni a CONAGUA.**

---

## 6. Arquitectura de un vistazo

```text
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 1 — PWA (React 19 + Vite 8 + Tailwind 3)                   │
│ Monitor Climático (público) · Sala Operativa (operadores)       │
│ Hosting: Vercel Static                                          │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 2 — API Serverless (Vercel Functions, Node 22)             │
│ /api/sara · /api/smn · /api/reporte-ondemand                    │
│ /api/disparar-workflow · /api/latest-gif                        │
│ [Validación estricta de contratos con Zod]                      │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 3 — Motor Autónomo (GitHub Actions, cada 3h)               │
│ scripts/ejecutar_sara_autonomo.mjs                              │
│ Disparado por cron-job.org → /api/disparar-workflow → GitHub    │
│ Genera reporte diario 6 AM vía scripts/reportes/reporteDiario.mjs│
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 4 — Almacenamiento (Vercel Blob)                           │
│ estado_diocesano.json · bitacora_sara.json · reporte_vigente.json│
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 5 — Datos externos                                         │
│ Open-Meteo · Groq · SMN/CONAGUA · NOAA GOES-19                  │
└─────────────────────────────────────────────────────────────────┘