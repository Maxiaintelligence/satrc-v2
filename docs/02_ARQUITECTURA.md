# SatRC V2.0 — Arquitectura Técnica

## 1. Stack Tecnológico
- **Frontend:** React 19 + Vite + Tailwind CSS. Mapas con Leaflet.
- **Backend:** Vercel Serverless Functions (Node.js 22).
- **Runner Autónomo:** GitHub Actions (Node.js 22).
- **Almacenamiento:** Vercel Blob (3 archivos JSON: `estado_diocesano.json`, `bitacora_sara.json`, `reporte_diocesano_vigente.json`).
- **Base de Datos Local:** `src/data/localidades.json` (incluida en el bundle).
- **Servicios Externos:** Open-Meteo (clima), Groq (IA), SMN/CONAGUA (avisos), NOAA (satélite).

## 2. Las 5 Capas
1.  **Capa 1 (Presentación):** PWA en Vercel Static. Vistas: `MonitorPublico` y `SatRCOperativo`.
2.  **Capa 2 (API Serverless):** Endpoints en `/api`. Destacan `/api/sara` (lectura estado), `/api/smn` (parser avisos), `/api/reporte-ondemand` (generación Groq).
3.  **Capa 3 (Motor Autónomo):** `scripts/ejecutar_sara_autonomo.mjs`. Disparado por `cron-job.org` cada 3 horas. Consume Open-Meteo, evalúa 405 localidades y publica en Blob.
4.  **Capa 4 (Almacenamiento):** Vercel Blob. Es la "fuente de verdad" para el frontend.
5.  **Capa 5 (Datos Externos):** APIs de terceros.

## 3. Flujo de Datos (Runner Autónomo)
1. `cron-job.org` dispara una petición HTTP al endpoint `/api/disparar-workflow`.
2. Este endpoint, usando un PAT de GitHub, dispara el workflow `sara_cron.yml`.
3. El runner descarga los datos de 14 nodos regionales (Open-Meteo).
4. Genera consenso (GFS + ICON + GEM).
5. Evalúa las 405 localidades con el `riskEvaluator.js`.
6. Consulta el SMN y a Groq para el dictamen diario.
7. Si es la ventana de las 6:00 AM, genera el Reporte Diario Automático.
8. Publica el estado y la bitácora en Vercel Blob.

## 4. Puntos Críticos de Diseño (ADRs)
- **ADR-001 (Nodos):** Se usan 14 nodos (uno por zona) en lugar de 1 solo (Huauchinango) para evitar el sesgo climático (Bug original).
- **ADR-007 (Bitácora):** Encadenamiento SHA-256 para auditar decisiones y evitar manipulaciones.
- **ADR-009 (Semáforo):** 4 niveles (N1-N4) alineados con Protección Civil.