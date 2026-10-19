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

Cada zona usa la **localidad más poblada** como nodo meteorológico de referencia (ADR-001, Etapa 2).

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

┌─────────────────────────────────────────────────────────────────┐
│ CAPA 1 — PWA (React 19 + Vite 8 + Tailwind 3) │
│ Monitor Climático (público) · Sala Operativa (operadores) │
│ Hosting: Vercel Static │
└─────────────────────────────────────────────────────────────────┘
↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 2 — API Serverless (Vercel Functions, Node 22) │
│ /api/sara · /api/smn · /api/reporte-ondemand │
│ /api/disparar-workflow · /api/latest-gif │
└─────────────────────────────────────────────────────────────────┘
↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 3 — Motor Autónomo (GitHub Actions, cada 3h) │
│ scripts/ejecutar_sara_autonomo.mjs │
│ Disparado por cron-job.org → /api/disparar-workflow → GitHub │
│ Genera reporte diario 6 AM vía scripts/reportes/reporteDiario.mjs │
└─────────────────────────────────────────────────────────────────┘
↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 4 — Almacenamiento (Vercel Blob) │
│ estado_diocesano.json · bitacora_sara.json · reporte_diocesano_vigente.json │
└─────────────────────────────────────────────────────────────────┘
↕
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 5 — Datos externos │
│ Open-Meteo · Groq · SMN/CONAGUA · NOAA GOES-19 │
└─────────────────────────────────────────────────────────────────┘

text

**No hay `vercel.json`.** El deploy usa autodetección de Vercel.

**El repo en GitHub se llama `satrc-v2`.** La carpeta local se llama `satrc-v3` (por la **Etapa 3**, no por una versión 3.0).

---

## 7. Modelo de datos (simplificado)

### `localidades.json` (405 entradas)

Cada localidad tiene:
- `id`, `nombre`, `municipio`, `estado`, `zona_id`, `zona_nombre`.
- `coords: { lat, lon }`.
- `topografia: { altitud_msnm, pendiente_max_deg, relieve, twi }`.
- `hidrologia: { subcuenca_cve, subcuenca_nom, posicion, distancia_cauce_km, tc_horas, poblacion_aguas_arriba }`.
- `vulnerabilidad: { poblacion, marginacion, acceso_vial, dist_hospital_km, ... }`.

### `estado_diocesano.json` (Blob)

- `dictamen: { estado_situacion, color, titulo, comentario_oficial, ... }`.
- `semaforo: { totalNivel4, totalNivel3, totalNivel2, totalNivel1 }`.
- `evaluaciones: [405 objetos con nivel_alerta, diagnostico, tiempos, geografia, impactoSistemico]`.
- `series_por_zona: { ACT: { nodo_referencia, ok, horas, ... }, ... }`.
- `zonas_sin_datos: [...]`.
- `motor_consenso: "GFS + ICON + GEM (mediana con filtro de ceros)"`.

### `bitacora_sara.json` (Blob)

- `bitacora: [{ id, fecha_dia_mexico, hora_exacta_mexico, timestamp_iso_utc, origen_evento, estado_situacion, titulo, resumen, prev_hash, hash, hash_completo }]`.
- `ultimo_dictamen: { ... }`.

**Cadena SHA-256:** cada entrada incluye `prev_hash` (primeros 16 caracteres del hash anterior) y `hash_completo` (hash de 64 caracteres). El `BLOQUE_GENESIS` son 64 ceros.

---

## 8. Stack tecnológico

### Frontend
- **React 19.2.8** + **Vite 8.3.2**.
- **Tailwind CSS 3.4.19** + PostCSS.
- **Leaflet 1.9.4** + **react-leaflet 5.0.0** (mapas).
- **lucide-react 1.50.0** (iconos).
- **Zod 4.6.5** (validación de esquemas).

### Backend (Vercel Functions)
- **Node.js 22**.
- **@vercel/blob 2.8.0** (almacenamiento).
- **Groq API** (`openai/gpt-oss-120b`) para SARA.
- **crypto** (SHA-256, timingSafeEqual).

### Runner autónomo
- **Node.js 22**.
- **GitHub Actions** (Ubuntu 24.04).
- **cron-job.org** (scheduler externo).

### Servicios externos
- **Open-Meteo** (GFS + ICON + GEM).
- **Groq** (LLM).
- **SMN/CONAGUA** (avisos oficiales, scraping).
- **NOAA GOES-19** (imágenes satelitales).

---

## 9. Glosario

| Término | Significado |
|---|---|
| **SEIAG** | Sistema Experto de Interpretación y Asesoría Geofísica (el motor de riesgo). |
| **ADR-001** | Decisión arquitectónica: migrar de 1 nodo (Huauchinango) a 14 nodos (uno por zona). |
| **N1/N2/N3/N4** | Niveles de alerta: Normal / Vigilancia / Alerta Temprana / Emergencia. |
| **API (en contexto meteorológico)** | Antecedent Precipitation Index (no confundir con API de software). |
| **TWI** | Topographic Wetness Index. |
| **Mojibake** | Texto corrupto por doble encoding UTF-8 (`ó` → `Ã³`). |
| **Blob** | Vercel Blob Storage (almacenamiento de archivos JSON). |
| **Runner** | Script autónomo que corre cada 3h en GitHub Actions. |
| **SARA** | El agente de IA (Groq) que redacta reportes. |
| **Etapa 3** | Trabajo actual de deuda técnica (Oct 2026). |
| **Versión 3.0** | Salto mayor futuro (nuevos vectores, auth real, percentiles). NO en Etapa 3. |

---

## 10. Enlaces importantes

- **Repo GitHub:** `https://github.com/Maxiaintelligence/satrc-v2`
- **Producción:** `https://satrc-v2.vercel.app`
- **GitHub Actions:** `https://github.com/Maxiaintelligence/satrc-v2/actions/workflows/sara_cron.yml`
- **Portal SMN:** `https://smn.conagua.gob.mx/`
- **Open-Meteo:** `https://open-meteo.com/`
- **Groq:** `https://console.groq.com/`

---

## 11. Documentación relacionada

- `docs/00_METODOLOGIA.md` — Reglas de oro del proyecto.
- `docs/02_ARQUITECTURA.md` — Arquitectura detallada (nivel ingeniería).
- `docs/03_MOTOR_RIESGO.md` — Las 6 reglas del motor.
- `docs/04_HISTORIAL_BUGS.md` — Historial de bugs.
- `docs/05_PROMPT_SARA.md` — Ingeniería de prompts.
- `docs/06_PENDIENTES.md` — Backlog de pendientes.
- `docs/07_GUIA_OPERACION.md` — Guía de operación y despliegue.
- `docs/08_ETAPA3_PLAN.md` — Plan de Etapa 3.
- `docs/09_HALLAZGOS_ETAPA3.md` — 36 hallazgos de Etapa 3.
- `docs/10_HANDOVER.md` — Handover (traspaso de contexto).

---

**Fin del documento de contexto.**