# SatRC V2.0 — Documento Maestro de Handover Técnico y Operativo

**Sistema de Alerta Temprana y Riesgos Climáticos**
Cáritas Pastoral Social • Arquidiócesis de Tulancingo (Hidalgo, Sierra Norte de Puebla y Veracruz)

| Campo | Detalle |
|---|---|
| **Versión del documento** | 2.2.0 (Cierre de Etapa 3) |
| **Fecha de corte y actualización** | 21 de octubre de 2026 |
| **Estado del sistema en producción** | Operativo y Estable (Etapa 3 finalizada; H0 a H9 cerrados) |
| **Audiencia** | Ingenieros de software, administradores de sistemas, líderes técnicos y auditores que asuman la operación y evolución del proyecto |

---

## Índice General

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Puesta en Marcha (Local y Servidor)](#3-puesta-en-marcha)
4. [Operación, Despliegue y Runbook](#4-operación-despliegue-y-runbook)
5. [Accesos, Credenciales y Dependencias Externas](#5-accesos-credenciales-y-dependencias-externas)
6. [Estado Actual del Proyecto y Deuda Técnica](#6-estado-actual-del-proyecto-y-deuda-técnica)
7. [Calidad del Código, Convenciones y Pruebas](#7-calidad-del-código-convenciones-y-pruebas)
8. [Modelo de Datos y Cadena Criptográfica](#8-modelo-de-datos-y-cadena-criptográfica)
9. [Personas, Responsabilidades y Escalamiento](#9-personas-responsabilidades-y-escalamiento)
10. [Transferencia de Conocimiento y Checklist de Aceptación](#10-transferencia-de-conocimiento-y-checklist-de-aceptación)

---

## 1. Visión General

### 1.1 Propósito y Problema que Resuelve

SatRC V2.0 es una plataforma sociotécnica humanitaria orientada a la protección de la vida humana frente a eventos hidrometeorológicos severos (lluvias torrenciales, saturación geomecánica de suelo, riesgo de deslave en cañadas, inundaciones repentinas, vientos y bancos de niebla).

Cubre **405 localidades** rurales y semiurbanas de alta marginación y relieve accidentado pertenecientes a la jurisdicción de la Arquidiócesis de Tulancingo, comprendida territorialmente en el estado de Hidalgo, la Sierra Norte de Puebla y laderas limítrofes de Veracruz.

#### El Problema

- Los boletines meteorológicos oficiales federales (CONAGUA/SMN) se emiten a nivel estatal o por macrorregiones. Carecen de resolución a nivel de cañadas y laderas específicas de la Sierra Madre Oriental.
- Los modelos numéricos globales (GFS, ICON, GEM) ofrecen datos crudos incomprensibles para párrocos, brigadistas y coordinadores locales que deben tomar decisiones de auxilio en minutos.
- En zonas de montaña, el peligro no es únicamente la precipitación instantánea, sino la **memoria de lluvia de los últimos 7 días**, la **pendiente del terreno** (taludes > 45°) y el **aislamiento vial** por caminos de terracería o brechas.

#### La Solución de SatRC

- Procesa pronósticos numéricos horarios de 3 supercomputadoras meteorológicas globales (NOAA de EE. UU., DWD de Alemania y ECCC de Canadá) mediante una API abierta (Open-Meteo).
- Aplica un **consenso determinista multi-modelo** (mediana con filtro de ceros espurios) sobre una ventana temporal de 240 horas (168 h pasadas + 72 h proyectadas).
- Evalúa cada localidad con un motor de reglas de riesgo geofísico y vulnerabilidad sistémica (tiempo de concentración de cuenca, pendiente, distancia a ríos, aislamiento hospitalario y tipo de camino).
- Clasifica el territorio en un semáforo de 4 niveles:

| Nivel | Color | Significado | Criterio |
|---|---|---|---|
| **4** | 🔴 Rojo | Emergencia | Fallo geomecánico inminente en ladera escarpada (≥ 45°) o crecida fluvial repentina |
| **3** | 🟠 Naranja | Alerta Temprana | Saturación crítica en pendientes de 25° a 44° o tormenta convectiva severa |
| **2** | 🟡 Amarillo | Vigilancia Preventiva | Valles inundables, ráfagas moderadas (> 40 km/h) o niebla densa |
| **1** | 🟢 Verde | Estable / Calma | Condiciones normales de temporada |

- Dispone del agente meteorológico **SARA** (Sistema de Alerta y Respuesta Automatizada), que sintetiza la situación en informes de 7 secciones orientados a brigadas y redactados con tono técnico-pastoral.
- Registra cada corrida y reporte en una bitácora auditada e inmutable enlazada mediante hashes criptográficos SHA-256 (arquitectura tipo blockchain de bloque génesis).

### 1.2 Contexto, Restricciones y Decisiones de Diseño

- **Presupuesto cero ($0 MXN / USD):** el proyecto es una iniciativa de caridad eclesiástica sin financiamiento recurrente. No puede depender de servidores dedicados de pago, licencias de APIs comerciales ni suscripciones mensuales. Todo el stack opera en capas gratuitas permanentes o servicios de dominio público.
- **Preferencia por el falso positivo:** en protección civil humanitaria, el costo de una falsa alarma preventiva es menor; el costo de omitir una alerta es la pérdida de vidas humanas.
- **Subordinación legal obligatoria:** SatRC no emite alertas oficiales ni ordena evacuaciones. Traduce y orienta. Los decretos y mandatos de Protección Civil (nacional, estatal y municipal) y de CONAGUA prevalecen jerárquicamente en todo momento.

### 1.3 Alcance y Límites Deliberados

**Incluido:**

- PWA pública para consulta ciudadana (`MonitorPublico.jsx`).
- Consola operativa diocesana para coordinadores (`SatRCOperativo.jsx`).
- Generación de reportes bajo demanda y reporte diario automático matutino (06:00 hrs México).
- Integración en tiempo real con GOES-19 (imágenes de 5 canales satelitales).
- Bitácora inmutable en memoria/blob con folio criptográfico.

**Fuera de alcance deliberado:**

- No predice el clima desde cero; consensúa salidas deterministas preexistentes.
- No reemplaza a las autoridades de Protección Civil.
- La versión actual (V2.0) utiliza claves operativas en cabecera HTTP (`x-user-key` y `x-admin-token`), dejando la migración a autenticación federada (OAuth / Firebase Auth) para la futura V3.0.

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Componentes y Flujo de Datos

```text
                              [FUENTES METEOROLÓGICAS EXTERNAS]
                                              │
             ┌────────────────────────────────┼───────────────────────────────┐
             │                                │                               │
             ▼                                ▼                               ▼
     Open-Meteo Archive /             CONAGUA / SMN Portal           NOAA STAR GOES-19
      Forecast (GFS+ICON+GEM)          (Scraping Avisos)              (CDN Satelital)
             │                                │                               │
             │ 14 series horarias             │ Aviso oficial regional        │ GIFs de 5 canales
             ▼                                ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       CAPA BACKEND / RUNNER / API SERVERLESS (Node.js 22)                   │
│                                                                                             │
│  [Runner Autónomo] (scripts/ejecutar_sara_autonomo.mjs) ──► Cada 3h vía GitHub Actions      │
│  [API Endpoints]                                                                            │
│    • /api/sara               ◄── Entrega estado diocesano (validado con Zod)                │
│    • /api/smn                ◄── Scraper tolerante a fallos de avisos CONAGUA               │
│    • /api/latest-gif         ◄── Resuelve el bucle animado más reciente de GOES-19          │
│    • /api/reporte-ondemand   ◄── LLM Groq (gpt-oss-120b) + Fallback Determinista            │
│    • /api/disparar-workflow  ◄── Disparador autenticado vía webhook cron-job.org            │
│                                                                                             │
│  [Almacenamiento de Estado]                                                                 │
│    • Vercel Blob (Producción en la nube). En local no hay almacenamiento disponible.        │
│      - estado_diocesano.json (Evaluaciones de 405 localidades)                              │
│      - bitacora_sara.json (Historial SHA-256 encadenado)                                    │
│      - reporte_diocesano_vigente.json (Último informe oficial de SARA)                      │
└───────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                                │
                                                ▼ JSON HTTP (polling)
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            CAPA FRONTEND — PWA (React 19 + Tailwind)                        │
│                                                                                             │
│   ├── MonitorPublico.jsx          (Vista abierta para párrocos, brigadas y fieles)          │
│   ├── SatRCOperativo.jsx          (Sala de mando diocesana con clave de operador)           │
│   ├── OfficialAlertBanner.jsx     (Cinta superior con aviso oficial sincronizado)           │
│   ├── SatelliteViewer.jsx         (Visor GOES-19 de 5 canales con zoom dinámico)            │
│   ├── RiskMap.jsx                 (Cartografía interactiva Leaflet con 405 localidades)     │
│   └── ReporteModalOperativo.jsx   (Visor de dictamen SARA, descarga TXT y exportación)      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Stack Tecnológico con Versiones Exactas

| Componente | Tecnología / Librería | Versión | Rol / Justificación |
|---|---|---|---|
| Runtime Base | Node.js (Linux x64) | v22.x | Motor de ejecución del servidor y runner |
| Framework Frontend | React / React-DOM | ^19.2.8 | Interfaz reactiva SPA con renderizado eficiente |
| Herramienta de Build | Vite | ^8.3.0 | Empaquetador ultrarrápido y servidor de desarrollo |
| Estilos | Tailwind CSS / PostCSS | ^3.4.19 | Utility-first CSS, paletas contrastadas para rescate |
| Cartografía | Leaflet / React-Leaflet | 1.9.4 / 5.0.0 | Renderizado geoespacial de mapas sin costo de API |
| Validación de Schemas | Zod | ^4.6.5 | Validación estricta en el borde de contratos (H8) |
| Linter / Análisis | Oxlint | ^1.81.0 | Linter de alto rendimiento en Rust |
| Iconografía | Lucide React | ^1.50.0 | Iconografía táctica ligera |
| LLM Inference | Groq (`openai/gpt-oss-120b`) | API v1 | Redacción de reportes estructurados en < 3 seg |
| Satélite | NOAA NESDIS STAR GOES-19 | CDN Público | Monitoreo de nubes, celdas convectivas y fuego |
| Testing | Vitest | ^5.0.5 | Suite de 79 tests unitarios y de integración (H7a/H7b) |

### 2.3 Estructura de Directorios Explicada

```text
satrc-v3/
├── .github/
│   └── workflows/
│       ├── sara_cron.yml           # Cronjob: ejecuta el runner autónomo cada 3h
│       └── tests.yml               # CI: corre los 79 tests de Vitest en cada push
│
├── api/                            # Vercel Serverless Functions (Backend Node.js)
│   ├── disparar-workflow.js        # Endpoint webhook (cron-job.org) para disparar el runner
│   ├── latest-gif.js               # Scraper de NOAA: obtiene el último GIF del satélite
│   ├── reporte-ondemand.js         # Generador de reportes manuales con Groq (valida auth)
│   ├── sara.js                     # Endpoint principal: entrega el estado y la bitácora
│   └── smn.js                      # Scraper del SMN/CONAGUA: detecta avisos oficiales
│
├── docs/                           # Documentación fundacional del proyecto (00 a 10)
│   ├── 00_METODOLOGIA.md           # Reglas de oro de desarrollo y commits
│   ├── 01_CONTEXTO.md              # Manifiesto, alcance y glosario
│   ├── 02_ARQUITECTURA.md          # Diagramas de componentes y flujo de datos
│   ├── 03_MOTOR_RIESGO.md          # Explicación física de las 6 reglas y el consenso
│   ├── 04_HISTORIAL_BUGS.md        # Registro de todos los fixes aplicados
│   ├── 05_PROMPT_SARA.md           # Ingeniería de prompts para el LLM de SARA
│   ├── 06_PENDIENTES.md            # Backlog de deuda técnica (V3.0)
│   ├── 07_GUIA_OPERACION.md        # Runbook de fallos, despliegue y rollback
│   ├── 08_ETAPA3_PLAN.md           # Roadmap detallado de la deuda técnica
│   ├── 09_HALLAZGOS_ETAPA3.md      # Catálogo de los 36 hallazgos de auditoría
│   └── 10_HANDOVER.md              # Este documento maestro
│
├── public/                         # Activos estáticos servidos por Vite
│   ├── favicon.svg                 # Icono de la pestaña del navegador
│   ├── icon.svg, icons.svg         # Identidad visual de Cáritas
│   ├── manifest.json               # Configuración de la PWA (Progressive Web App)
│   └── sw.js                       # Service Worker para capacidades offline
│
├── scripts/                        # Scripts de automatización y CLI
│   ├── diagnostico/                # Scripts auxiliares en PowerShell (calibración)
│   ├── engine/
│   │   ├── __tests__/
│   │   │   └── riskEvaluatorRunner.test.js # Tests de paridad del motor (H4)
│   │   └── riskEvaluatorRunner.mjs # Gemelo del motor de riesgo para el runner (H4)
│   ├── reportes/
│   │   └── reporteDiario.mjs       # Generador del reporte automático de las 6:00 AM
│   └── ejecutar_sara_autonomo.mjs  # Orquestador principal (se corre cada 3h)
│
├── src/                            # Código fuente del Frontend (React)
│   ├── assets/                     # Imágenes y SVGs estáticos
│   ├── components/                 # Componentes React reutilizables
│   │   ├── DisclaimerModal.jsx     # Aviso legal y subordinación a PC
│   │   ├── OfficialAlertBanner.jsx # Banner superior de alertas SMN
│   │   ├── ReporteCuerpo.jsx       # Renderizador de las 7 secciones de SARA
│   │   ├── ReporteModalOperativo.jsx # Modal de reportes (Operadores)
│   │   ├── ReporteModalPublico.jsx # Modal de reportes (Público)
│   │   ├── RiskMap.jsx             # Mapa Leaflet con los 405 puntos de riesgo
│   │   └── SatelliteViewer.jsx     # Visor de los GIFs de NOAA
│   ├── config/
│   │   └── noaa-goes.js            # Configuración de los 5 canales satelitales
│   ├── data/
│   │   └── localidades.json        # Base de datos de las 405 localidades
│   ├── engine/                     # Núcleo lógico del frontend
│   │   ├── __tests__/              # Tests del motor, consenso y regresión
│   │   ├── consensusEngine.js      # Mediana de GFS+ICON+GEM
│   │   ├── meteoFetcher.js         # Peticiones a Open-Meteo
│   │   ├── reportesRegionales.js   # Caché y agrupación de datos por zona
│   │   └── riskEvaluator.js        # Motor canónico de las 6 reglas
│   ├── lib/                        # Librerías y utilidades
│   │   └── compartido/             # Módulos DRY compartidos con el backend (H6)
│   │       ├── __tests__/          # Tests de utilidades (mojibake, noaa, etc.)
│   │       ├── fechas.js           # Formateo de fechas a hora México
│   │       ├── markdown.jsx        # Renderizador de viñetas y negritas
│   │       ├── mojibake.js         # Limpiador de UTF-8 corrupto
│   │       ├── noaa.js             # Parser de timestamps satelitales (H7b)
│   │       ├── nodos.js            # Selecciona el nodo de referencia por zona
│   │       └── regionales.js       # Normalizador de bloques regionales
│   ├── schemas/
│   │   └── estadoDiocesanoSchema.js # Contrato Zod de validación (H8)
│   ├── views/                      # Vistas principales de la PWA
│   │   ├── MonitorPublico.jsx      # Vista pública
│   │   └── SatRCOperativo.jsx      # Sala de mando con autenticación
│   ├── App.css, index.css          # Estilos globales
│   ├── App.jsx                     # Componente raíz y enrutamiento
│   └── main.jsx                    # Punto de entrada de React
│
├── .env.local                      # Variables de entorno locales (no commiteado)
├── .gitignore                      # Archivos ignorados por Git
├── .oxlintrc.json                  # Configuración del linter Oxlint
├── AUDITORIA_MOTOR.md              # Notas de la auditoría inicial
├── index.html                      # HTML raíz de la PWA
├── localidades_crudo.csv           # CSV fuente original de datos
├── package.json                    # Dependencias del proyecto
├── package-lock.json               # Árbol exacto de dependencias
├── postcss.config.js               # Configuración de PostCSS (Tailwind)
├── procesar_datos.cjs              # Script de generación del JSON de localidades
├── README.md                       # Readme principal
├── series_historicas_14_zonas.json # Datos históricos de prueba
├── simulacion_nodos_resultado.json # Resultados de simulación
├── simulacion_nodos_resultado_v2.json
├── tailwind.config.js              # Configuración de Tailwind CSS
└── vite.config.js                  # Configuración del bundler Vite

⚠️ Nota de arquitectura: Existen carpetas temporales como test/ o notas_personales/ que no forman parte del código de producción. El núcleo del sistema se concentra en src/, api/ y scripts/.

```

### 2.4 Registro de Decisiones de Arquitectura (ADRs)

#### ADR-001: Adopción de 14 Nodos Regionales de Referencia

- **Contexto:** en V1, las 405 localidades se evaluaban con el pronóstico de Huauchinango, causando falsas alarmas en el Altiplano.
- **Decisión:** dividir en 14 zonas de resguardo. Cada zona usa su localidad más poblada como nodo.
- **Consecuencia:** se eliminó el 86 % de las falsas emergencias N4.

#### ADR-002: Consenso Determinista Multi-Modelo (GFS + ICON + GEM)

- **Decisión:** calcular la mediana hora a hora entre GFS, ICON y GEM, con filtro de ceros espurios.
- **Consecuencia:** máxima confiabilidad sin comprar pronósticos privados.

#### ADR-003: Cadena de Bloques Criptográfica en la Bitácora

- **Decisión:** cada registro incluye `prev_hash` y un `hash_completo` calculado con SHA-256. El primer registro enlaza con `BLOQUE_GENESIS`.
- **Consecuencia:** imposibilidad técnica de adulterar el orden temporal.

#### ADR-004: Arquitectura DRY en Módulos Compartidos (H6)

- **Decisión:** extraer toda la lógica común a `src/lib/compartido/`.
- **Consecuencia:** una sola fuente de verdad.

---

## 3. Puesta en Marcha

### 3.1 Requisitos Previos

- **Sistema operativo:** Linux (Ubuntu 22.04+), macOS o Windows con WSL2.
- **Node.js:** versión 22.x (LTS).
- **NPM:** v10.x o superior.
- **Git:** instalado en el PATH.

### 3.2 Instalación Paso a Paso desde Cero

```bash
# 1. Clonar el repositorio
git clone https://github.com/Maxiaintelligence/satrc-v2.git
cd satrc-v2

# 2. Las variables de entorno se configuran en Vercel (ver Sección 5.1).

# 3. Instalar las dependencias exactas
npm install

# 4. Iniciar el entorno de desarrollo (Vite, puerto 5173)
npm run dev
```

El servidor iniciará en `http://localhost:5173`. Los endpoints `/api/*` no están disponibles en local (se ejecutan como Vercel Functions en la nube).

### 3.3 Variables de Entorno (Configuradas en Vercel)

| Variable | Tipo | Requerida en Prod | Descripción |
|---|---|---|---|
| `SARA_ADMIN_TOKEN` | String | Sí | Token para forzar revaluaciones manuales en `/api/sara`. |
| `SARA_ONDEMAND_TOKEN` | String | Sí | Token del backend para autorizar la emisión de reportes. |
| `VITE_SARA_ONDEMAND_TOKEN` | String | Sí | Token expuesto al cliente Vite para autenticar llamadas. |
| `GROQ_API_KEY` | String | Opcional | Clave API de Groq (`openai/gpt-oss-120b`). |
| `BLOB_READ_WRITE_TOKEN` | String | Sí (Vercel) | Token de lectura/escritura de Vercel Blob. |
| `GITHUB_PAT` | String | Opcional | Token para disparar GitHub Actions. |
| `CRON_SECRET` | String | Opcional | Secreto compartido con cron-job.org. |

### 3.4 Comandos de Ejecución, Pruebas y Construcción

```bash
npm run dev         # Vite + HMR
npm run lint        # Oxlint
npm test            # Vitest (79 tests)
npm run test:watch  # Vitest en modo watch
npm run build       # Compilación de producción
```

---

## 4. Operación, Despliegue y Runbook

### 4.1 Entornos y Diferencias

| Aspecto | Local | Producción (Vercel + GitHub Actions) |
|---|---|---|
| Almacenamiento | No disponible | Vercel Blob Storage |
| Generador SARA | No disponible | Groq LLM |
| Runner automático | Manual | GitHub Actions (cada 3 h) |

### 4.2 Proceso de Despliegue y Rollback

- **CI/CD:** cada `git push origin main` despliega en Vercel y activa el workflow en GitHub.
- **Rollback:**

```bash
git revert <HASH_DEFECTUOSO> --no-edit
git push origin main
```

### 4.3 Monitoreo y Puntos de Observación

- **Bitácora:** `GET /api/sara`. Verificar antigüedad de `dictamen.timestamp` (< 3.5 h).
- **Logs del Runner:** GitHub → Actions.
- **Logs de API:** Vercel Dashboard → Logs.

### 4.4 Runbook de Contingencias

#### Caso 1: El Runner falla (rojo)

- **Causas:** Open-Meteo 503 (transitorio), `BLOB_READ_WRITE_TOKEN` expirado, o Zod rechazó el `paqueteMaestro` (H8).
- **Acción:** revisar el log. Si es Zod, el error indica el campo exacto que falló. Corregir el motor y reintentar.

#### Caso 2: Error 400 en Groq (On-Demand)

- **Causa:** el JSON de 7 secciones se cortó por falta de tokens.
- **Solución (H8.5):** se configuró `max_completion_tokens: 4096`. Si persiste, revisar los logs.

#### Caso 3: Mojibake

- **Solución:** el frontend y la API limpian automáticamente con `repararMojibake()`.

---

## 5. Accesos, Credenciales y Dependencias Externas

### 5.1 Matriz de Servicios y Credenciales

| Servicio | Propósito | Dónde se Guarda |
|---|---|---|
| GitHub | Código y Runner CI/CD | github.com |
| Vercel | Hosting y Blob | Vercel Env Vars |
| Groq | LLM SARA | Secrets |
| cron-job.org | Scheduler externo | Web |
| Open-Meteo | Datos meteorológicos | Libre |
| SMN / CONAGUA | Avisos oficiales | Scraping público |
| NOAA GOES-19 | Imágenes satelitales | CDN público |

> **SEGURIDAD:** ninguna credencial se registra en el control de versiones.

### 5.2 Costos

**Costo total:** $0.00 MXN mensuales (Free Tier).

---

## 6. Estado Actual del Proyecto y Deuda Técnica

### 6.1 Lo que está Terminado y Operativo al 100 %

- [x] Motor de consenso multi-modelo de 240 h.
- [x] Algoritmo de riesgo sobre 405 localidades.
- [x] Arquitectura de 14 nodos.
- [x] Scraper de avisos SMN.
- [x] Visor satelital GOES-19 (con parser validado en H7b).
- [x] Consola operativa con generación de reportes.
- [x] Bitácora auditable SHA-256.
- [x] Validación estricta de contratos con Zod (H8).
- [x] Módulos DRY.

### 6.2 Deuda Técnica Conocida y Roadmap

**Etapa 3 (finalizada):**

- [x] **H0:** documentación de línea base.
- [x] **H1:** cobertura del runner con lotes de 4.
- [x] **H2a:** sincronización del parser SMN del runner.
- [x] **H2b:** eliminación de `api/glm.js` huérfano.
- [x] **H2c:** aplicación de aviso SMN restringida a estados afectados.
- [x] **H3:** fallback en vivo del frontend expandido a 14 nodos.
- [x] **H4:** creación del gemelo desacoplado del motor en runner.
- [x] **H5:** corrección de variable `visibility_gfs_seamless` (N18).
- [x] **H6:** refactorización DRY en `src/lib/compartido/`.
- [x] **H7a:** Vitest instalado, 36 tests, CI en GitHub Actions.
- [x] **H7b:** pruebas unitarias de utilidades y extracción NOAA.
- [x] **H8:** activación de validación estricta Zod en tiempo de ejecución.
- [x] **H9:** cierre documental formal de Etapa 3.

---

## 7. Calidad del Código, Convenciones y Pruebas

### 7.1 Convenciones de Código y Commits

- **Regla:** "Un commit = Una causa".
- **Formato:** `tipo(área): descripción corta`.
- **Ramas:** trunk-based simplificado.

### 7.2 Estrategia de Pruebas

#### Suite formal con Vitest

El proyecto cuenta con 79 tests unitarios ejecutados con Vitest.

**Archivos de test:**

- `src/engine/__tests__/consensusEngine.test.js` (13 tests).
- `src/engine/__tests__/riskEvaluator.test.js` (16 tests).
- `src/engine/__tests__/regresionFase1.test.js` (8 tests).
- `scripts/engine/__tests__/riskEvaluatorRunner.test.js` (3 tests).
- `src/lib/compartido/__tests__/mojibake.test.js` (6 tests).
- `src/lib/compartido/__tests__/regionales.test.js` (7 tests).
- `src/lib/compartido/__tests__/fechas.test.js` (7 tests).
- `src/lib/compartido/__tests__/noaa.test.js` (12 tests).
- `src/lib/compartido/__tests__/estadoDiocesanoSchema.test.js` (7 tests).

---

## 8. Modelo de Datos y Cadena Criptográfica

### 8.1 Catálogo Geoespacial (`src/data/localidades.json`)

Contiene 405 registros con topografía, hidrología y vulnerabilidad.

### 8.2 Estructura del Bloque de Bitácora Criptográfica

```json
{
  "id": "SARA_LOG_142",
  "fecha_dia_mexico": "20 de octubre de 2026",
  "timestamp_iso_utc": "2026-10-20T12:00:15.120Z",
  "origen_evento": "PROGRAMADO_CRON",
  "estado_situacion": "SITUACION_NORMAL",
  "titulo": "Situación Diocesana de Calma",
  "prev_hash": "4a7f8b9c1d2e3f4a...",
  "hash_completo": "8e2b1c0d4f5a6b7c..."
}
```

---

## 9. Personas, Responsabilidades y Escalamiento

### 9.1 Matriz de Roles

| Rol | Titular |
|---|---|
| Arquitecto y Desarrollador Líder | Ing. Antonio G. Madrigal |
| Coordinador Pastoral Diocesano | Padre Roberto López Medina |
| Oficial de Enlace de Emergencias | Padre Omar Martínez Vázquez |
| Autoridad Eclesiástica Máxima | Mons. Oscar Roberto Domínguez C. |

### 9.2 Canales de Comunicación

- **Canal operativo:** grupo de WhatsApp de Emergencias.
- **Canal oficial:** portal y boletines de la Arquidiócesis.
- **Autoridades civiles:** Protección Civil (Hidalgo, Puebla), CENAPRED.

---

## 10. Transferencia de Conocimiento y Checklist de Aceptación

### 10.1 Ruta Sugerida de Capacitación

1. **Fundamentos:** `docs/01_CONTEXTO.md` y `docs/03_MOTOR_RIESGO.md`.
2. **Arquitectura:** `docs/02_ARQUITECTURA.md` y `src/lib/compartido/`.
3. **Pruebas:** `npm run dev`, `npm run lint`, `npm test` (79 tests).
4. **Sala operativa:** probar con clave `emergencia` y operador `Antonio2026`.
5. **Cloud:** revisar workflows y `/api/sara`.

### 10.2 Checklist Formal de Aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | El repositorio clona limpiamente. | [x] Conforme |
| 2 | El servidor inicia en el puerto 5173. | [x] Conforme |
| 3 | El linter `npm run lint` reporta 0 errores. | [x] Conforme |
| 4 | La suite de tests (`npm test`) pasa los 79 tests. | [x] Conforme |
| 5 | La compilación `npm run build` genera `dist/`. | [x] Conforme |
| 6 | `/api/smn` conecta con CONAGUA. | [x] Conforme |
| 7 | `/api/latest-gif` resuelve bucles de NOAA. | [x] Conforme |
| 8 | La sala operativa emite reportes. | [x] Conforme |
| 9 | La bitácora encadena hashes SHA-256. | [x] Conforme |
| 10 | Las credenciales están fuera del código. | [x] Conforme |

---

*Fin del Documento de Handover. SatRC V2.0 — Cáritas Pastoral Social • Arquidiócesis de Tulancingo.*