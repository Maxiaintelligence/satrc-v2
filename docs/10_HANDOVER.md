# SatRC V2.0 — Documento Maestro de Handover Técnico y Operativo

**Sistema de Alerta Temprana y Riesgos Climáticos**
Cáritas Pastoral Social • Arquidiócesis de Tulancingo (Hidalgo, Sierra Norte de Puebla y Veracruz)

| Campo | Detalle |
|---|---|
| **Versión del documento** | 2.1.0 |
| **Fecha de corte y actualización** | 20 de octubre de 2026 |
| **Estado del sistema en producción** | Operativo y Estable (Etapa 3 de estabilización de deuda técnica; H0 a H7a cerrados) |
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
│    • /api/sara               ◄── Entrega estado diocesano, semáforo y bitácora              │
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
| Validación de Schemas | Zod | ^4.6.5 | Validación en el borde de contratos de datos |
| Linter / Análisis | Oxlint | ^1.81.0 | Linter de alto rendimiento en Rust |
| Iconografía | Lucide React | ^1.50.0 | Iconografía táctica ligera |
| LLM Inference | Groq (`openai/gpt-oss-120b`) | API v1 | Redacción de reportes estructurados en < 3 seg |
| Satélite | NOAA NESDIS STAR GOES-19 | CDN Público | Monitoreo de nubes, celdas convectivas y fuego |

### 2.3 Estructura de Directorios Explicada

```text
satrc-v2/
├── .github/workflows/
│   └── sara_cron.yml           # Workflow de GitHub Actions (ejecuta el runner cada 3h)
├── api/                        # Funciones backend serverless
│   ├── disparar-workflow.js    # Disparador webhook para cron-job.org
│   ├── latest-gif.js           # Scraping dinámico del último GIF de GOES-19
│   ├── reporte-ondemand.js     # Generación de reportes de emergencia con Groq/Fallback
│   ├── sara.js                 # Endpoint maestro de estado, dictamen y bitácora
│   └── smn.js                  # Scraper del aviso vigente de CONAGUA/SMN
├── docs/                       # Acervo documental formal
│   ├── 00_METODOLOGIA.md       # Metodología de investigación y auditoría empírica
│   ├── 01_CONTEXTO.md          # Contexto pastoral, territorio y principios
│   ├── 02_ARQUITECTURA.md      # Arquitectura de componentes y estado
│   ├── 03_MOTOR_RIESGO.md      # Formulación matemática y física de las 6 reglas
│   ├── 04_HISTORIAL_BUGS.md    # Registro histórico de anomalías resueltas
│   ├── 05_PROMPT_SARA.md       # Ingeniería de prompts del agente SARA
│   ├── 06_PENDIENTES.md        # Backlog de deuda técnica (H7a, H4, H5, H8)
│   ├── 07_GUIA_OPERACION.md    # Guía de monitoreo, contingencias y rollback
│   ├── 08_ETAPA3_PLAN.md       # Plan detallado de estabilización Etapa 3
│   ├── 09_HALLAZGOS_ETAPA3.md  # Catálogo de 35 hallazgos de línea base
│   └── 10_HANDOVER.md          # Este documento maestro de entrega
├── public/                     # Activos estáticos, manifest PWA e iconos
│   ├── icon.svg, favicon.svg   # Identidad visual oficial de Cáritas Tulancingo
│   ├── manifest.json           # Declaración de instalación PWA
│   └── sw.js                   # Service Worker para capacidades offline
├── scripts/                    # Scripts de diagnóstico y automatización
│   ├── ejecutar_sara_autonomo.mjs   # Runner autónomo (cronjob principal)
│   └── reportes/reporteDiario.mjs   # Generador de reporte diario matutino (06:00 hrs)
├── src/
│   ├── assets/                 # Gráficos e imágenes
│   ├── components/             # Componentes React reutilizables
│   │   ├── DisclaimerModal.jsx       # Aviso legal y de subordinación a Protección Civil
│   │   ├── OfficialAlertBanner.jsx   # Cinta superior de alertas SMN
│   │   ├── ReporteCuerpo.jsx         # Renderizador tipográfico de las 7 secciones de SARA
│   │   ├── ReporteModalOperativo.jsx # Modal de exportación, WhatsApp y descarga TXT
│   │   ├── ReporteModalPublico.jsx   # Modal de consulta pública informativa
│   │   ├── RiskMap.jsx               # Mapa Leaflet interactivo con círculos por nivel
│   │   └── SatelliteViewer.jsx       # Visor NOAA GOES-19 con selector de productos
│   ├── config/noaa-goes.js     # Metadatos de los 5 canales GOES-19
│   ├── data/localidades.json   # Base de datos con 405 localidades categorizadas
│   ├── engine/                 # Núcleo de cálculo meteorológico del frontend
│   │   ├── consensusEngine.js        # Mediana con filtro de ceros espurios (240h)
│   │   ├── meteoFetcher.js           # Peticiones resilientes a Open-Meteo
│   │   ├── reportesRegionales.js     # Agrupación de métricas de las 14 zonas
│   │   └── riskEvaluator.js          # Evaluación de las 6 reglas de riesgo local
│   ├── lib/compartido/         # Módulos DRY extraídos en Etapa 3 (H6)
│   │   ├── fechas.js           # Formateo canónico de marcas de tiempo
│   │   ├── markdown.jsx        # Parser ligero seguro de negritas y viñetas
│   │   ├── mock-blob.js        # Almacén de blobs en memoria para AI Studio
│   │   ├── mojibake.js         # Filtro de sanitización de doble UTF-8
│   │   ├── nodos.js            # Selección de nodo de referencia por zona
│   │   └── regionales.js       # Normalización y construcción de bloques de texto
│   ├── schemas/estadoDiocesanoSchema.js # Contrato de datos validado con Zod
│   ├── views/                  # Vistas principales de navegación
│   │   ├── MonitorPublico.jsx  # Vista comunitaria sin restricciones
│   │   └── SatRCOperativo.jsx  # Sala de control con clave y funciones avanzadas
│   ├── App.jsx                 # Controlador raíz de autenticación y navegación
│   └── index.css, main.jsx     # Puntos de entrada de React y Tailwind
├── tailwind.config.js          # Configuración del motor de diseño Tailwind
└── vite.config.js              # Configuración de compilación Vite
```

### 2.4 Registro de Decisiones de Arquitectura (ADRs)

#### ADR-001: Adopción de 14 Nodos Regionales de Referencia (en sustitución del Nodo Único)

- **Fecha:** Octubre 2026.
- **Contexto:** en la versión inicial V1, todas las 405 localidades se evaluaban utilizando únicamente el pronóstico meteorológico de Huauchinango. Esto provocaba que localidades situadas en el Altiplano semiárido (ej. Actopan o Apan) sufrieran falsas alarmas de saturación de suelo cuando llovía en la Sierra, y viceversa.
- **Decisión:** dividir el territorio en 14 zonas de resguardo (5 en Altiplano y 9 en Sierra). Para cada zona, se toma como nodo meteorológico de referencia la localidad más poblada. Todas las comunidades de esa zona se evalúan con dicha serie meteorológica, pero aplicando su propia topografía y red vial específica.
- **Consecuencia:** se eliminó el 86% de las falsas emergencias N4 registradas en la auditoría de 90 días (de 22 falsas alarmas a solo 3 eventos justificados).

#### ADR-002: Consenso Determinista Multi-Modelo (GFS + ICON + GEM)

- **Fecha:** Octubre 2026.
- **Contexto:** confiar en un solo modelo global introduce sesgos sistemáticos (ej. GFS sobreestima lluvia orográfica en México, mientras que ICON suele reportar ceros tempranos).
- **Decisión:** calcular la mediana matemática hora a hora entre GFS (EE. UU.), ICON (Alemania) y GEM (Canadá), acompañada de un algoritmo de exclusión de ceros espurios (si dos modelos predicen lluvia significativa ≥ 0.5 mm y uno predice 0 mm, se descarta el cero).
- **Consecuencia:** máxima confiabilidad sin necesidad de comprar pronósticos privados.

#### ADR-003: Cadena de Bloques Criptográfica en la Bitácora

- **Fecha:** Octubre 2026.
- **Contexto:** en situaciones de desastre natural, existe el riesgo de cuestionamientos legales o deslindes de responsabilidad respecto a si la diócesis alertó a tiempo o alteró los registros posteriores.
- **Decisión:** cada evento registrado por el runner o por los operadores genera un registro con el hash del bloque previo (`prev_hash`) y un nuevo hash calculado con `crypto.createHash('sha256')`. El primer registro enlaza con un `BLOQUE_GENESIS` de 64 ceros.
- **Consecuencia:** imposibilidad técnica de adulterar el orden temporal de las advertencias emitidas.

#### ADR-004: Arquitectura DRY en Módulos Compartidos (`src/lib/compartido/`)

- **Fecha:** Octubre 2026 (Hito H6).
- **Contexto:** existían 14 funciones duplicadas entre el frontend (`src/`), los endpoints serverless (`api/`) y el runner de consola (`scripts/`), provocando desincronización de reglas y errores de encoding divergentes.
- **Decisión:** extraer toda la lógica común a `src/lib/compartido/` (`fechas.js`, `nodos.js`, `mojibake.js`, `regionales.js`, `markdown.jsx`).
- **Consecuencia:** una sola fuente de verdad para el cálculo y formateo de datos.

---

## 3. Puesta en Marcha

### 3.1 Requisitos Previos

- **Sistema Operativo:** Linux (Ubuntu 22.04+ recomendado), macOS o Windows con WSL2.
- **Node.js:** versión 22.x (LTS recomendada).
- **NPM:** v10.x o superior (se utiliza estrictamente `npm`; no usar Yarn, PNPM ni Bun).
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

El servidor iniciará en http://localhost:5173. Al acceder, la aplicación carga la interfaz gráfica (PWA) en el navegador. Los endpoints /api/* no están disponibles en el servidor de desarrollo local, ya que se ejecutan como Vercel Functions en la nube.

### 3.3 Variables de Entorno (Configuradas en Vercel)

| Variable | Tipo | Requerida en Prod | Descripción y Valor por Defecto |
|---|---|---|---|
| `PORT` | Numérica | No (default: 5173) | Puerto de enlace del servidor HTTP. |
| `NODE_ENV` | String | Sí | `development` en local / `production` en despliegue. |
| `SARA_ADMIN_TOKEN` | String | Sí (Prod) | Token para forzar revaluaciones manuales en `/api/sara`. |
| `SARA_ONDEMAND_TOKEN` | String | Sí (Prod) | Token del backend para autorizar la emisión de reportes. |
| `VITE_SARA_ONDEMAND_TOKEN` | String | Sí (Prod) | Token expuesto al cliente Vite para autenticar llamadas de consola. |
| `GROQ_API_KEY` | String | Opcional | Clave API de Groq para LLM `openai/gpt-oss-120b`. Si falta, se activa el motor determinista. |
| `BLOB_READ_WRITE_TOKEN` | String | Sí (Vercel) | Token de lectura/escritura de Vercel Blob en la nube. |
| `GITHUB_PAT` | String | Opcional | Personal Access Token con permiso `workflow` para disparar GitHub Actions. |
| `CRON_SECRET` | String | Opcional | Secreto compartido recibido desde cron-job.org. |

### 3.4 Comandos de Ejecución, Pruebas y Construcción

```bash
# Ejecutar entorno de desarrollo (Vite + HMR, puerto 5173)
npm run dev

# Ejecutar el linter estático ultrarrápido (Oxlint)
npm run lint

# Ejecutar la suite completa de tests (Vitest, 36 tests)
npm test

# Ejecutar tests en modo watch (desarrollo local)
npm run test:watch

# Compilar para producción (genera bundle estático en dist/)
npm run build
```

---

## 4. Operación, Despliegue y Runbook

### 4.1 Entornos y Diferencias

| Aspecto | Local (Vite dev server) | Producción en la Nube (Vercel + GitHub Actions) |
|---|---|---|
| Almacenamiento | No disponible (requiere Vercel Blob) | Vercel Blob Storage persistente |
| Generador SARA | No disponible (requiere Vercel Function) | Groq LLM `openai/gpt-oss-120b` (si falla, retorna error 504) |
| Runner Automático | Ejecutable bajo demanda vía CLI | GitHub Actions Cronjob (cada 3 horas) |

### 4.2 Proceso de Despliegue y Rollback

#### Despliegue Automático (CI/CD)

- **Frontend + API (Vercel):** cada `git push origin main` desencadena una compilación automática en Vercel. La autodetección compila `src/` mediante Vite y asigna `api/*.js` a Serverless Functions.
- **Runner Autónomo (GitHub Actions):** el archivo `.github/workflows/sara_cron.yml` se ejecuta automáticamente en la nube cada 3 horas (en el minuto 21: `21 */3 * * *`).

#### Procedimiento de Rollback

Si se introduce una regresión crítica en producción:

```bash
# Identificar el hash del commit defectuoso
git log -n 5 --oneline

# Revertir el commit generando uno nuevo
git revert <HASH_DEFECTUOSO> --no-edit

# Empujar a la rama principal (Vercel y GitHub Actions desplegarán inmediatamente el estado anterior)
git push origin main
```

### 4.3 Monitoreo y Puntos de Observación

- **Estado de la Bitácora:** consultar en el navegador `https://<dominio>/api/sara`. Verificar que `dictamen.timestamp` no tenga más de 3.5 horas de antigüedad.
- **Logs del Runner:** en el repositorio de GitHub, pestaña **Actions** → *SARA Cronjob Autónomo Diocesano* → Última ejecución → Inspeccionar logs de *Ejecutar Motor Autónomo Multivectorial SARA*.
- **Logs de API en Vercel:** Vercel Dashboard → Proyecto `satrc-v2` → pestaña **Logs** → Filtrar por `/api/sara` o `/api/reporte-ondemand`.

### 4.4 Runbook de Contingencias y Problemas Frecuentes

#### Caso 1: El Runner de GitHub Actions aparece en Rojo (Fallo del Cron)

- **Síntoma:** no se actualiza el semáforo y en GitHub Actions el workflow falla con código de salida 1.
- **Causas probables:**
  - Open-Meteo devolvió un error HTTP 503 *Service Unavailable* o timeout por congestión.
  - Vercel Blob rechazó la conexión por expiración del `BLOB_READ_WRITE_TOKEN`.
- **Acción inmediata:**
  1. Abrir el log del runner: `gh run view --log`.
  2. Si es 503 de Open-Meteo: es un fallo transitorio de la red meteorológica; el sistema se recupera solo en la siguiente corrida de 3 horas.
  3. Si es un fallo de token: acceder a GitHub Repo → **Settings** → **Secrets and variables** → **Actions** → actualizar `BLOB_READ_WRITE_TOKEN`.

#### Caso 2: El Generador de Reportes On-Demand no responde o reporta "Timeout de Groq"

- **Síntoma:** el modal de la sala operativa permanece en "Generando reporte..." y concluye en error 504.
- **Causa:** la API de Groq en la nube experimenta latencia superior a los 30 segundos (`TIMEOUT_GROQ_MS = 30000`).
- **Solución automática implementada:** el código de `api/reporte-ondemand.js` conmuta automáticamente al motor determinista basado en reglas, asegurando que el operador reciba su reporte estructurado en 7 secciones sin interrumpir el auxilio diocesano.

#### Caso 3: Inconsistencia o textos con caracteres extraños (Mojibake UTF-8)

- **Síntoma:** palabras como `SituaciÃ³n` o `TulancingÃ³` en pantallas o reportes.
- **Diagnóstico:** conflicto de doble codificación UTF-8 en cadenas serializadas.
- **Solución:** todos los módulos ahora consumen `repararMojibake()` y `repararObjeto()` ubicados en `src/lib/compartido/mojibake.js`, el cual normaliza secuencias corruptas tanto en strings directos como en estructuras anidadas.

---

## 5. Accesos, Credenciales y Dependencias Externas

### 5.1 Matriz de Servicios y Credenciales

| Servicio / Cuenta | Propósito | Dónde se Guarda | Quién lo Administra |
|---|---|---|---|
| GitHub (`Maxiaintelligence/satrc-v2`) | Control de versiones y Runner CI/CD | github.com | Ing. Antonio G. Madrigal |
| Vercel (`satrc-v2`) | Hosting PWA, API Serverless y Blob Storage | Vercel Environment Variables | Ing. Antonio G. Madrigal |
| Groq Cloud API | Modelo `openai/gpt-oss-120b` para SARA | Secretos de Actions y Vercel | Ing. Antonio G. Madrigal |
| cron-job.org | Llamador HTTP externo cada 3 horas | Configuración externa web | Ing. Antonio G. Madrigal |
| Open-Meteo | Datos horarios de GFS, ICON y GEM | Libre (sin clave / dominio público) | Open-Meteo GmbH |
| SMN / CONAGUA | Avisos de tiempo severo en México | Scraping público (sin clave) | Gobierno de México |
| NOAA GOES-19 | Bucle satelital de 5 canales | CDN público (sin clave) | NOAA NESDIS (EE. UU.) |

> **POLÍTICA DE SEGURIDAD ESTRICTA:** ninguna credencial, token o clave privada debe registrarse en el control de versiones. Todas residen en los administradores de secretos de GitHub Actions y Vercel.

### 5.2 Estructura de Costos y Vencimientos

- **Costo total de operación:** $0.00 MXN mensuales.
- Todos los servicios operan bajo planes "Hobby / Free Tier" permanentes.
- No existen licencias comerciales ni vencimientos de tarjetas de crédito vinculadas.

---

## 6. Estado Actual del Proyecto y Deuda Técnica

### 6.1 Lo que está Terminado y Operativo al 100%

- [x] Motor de consenso multi-modelo de 240 horas con filtro de ceros espurios.
- [x] Algoritmo de clasificación de riesgo geomecánico e hidrológico sobre 405 localidades.
- [x] Arquitectura de 14 nodos de referencia regional.
- [x] Scraper de avisos de CONAGUA/SMN con mapeo a niveles 1, 2 y 3.
- [x] Visor de bucles satelitales GOES-19 con resolución automática de GIFs en tiempo real.
- [x] Consola operativa protegida por clave con generación de reportes on-demand.
- [x] Bitácora auditable con encadenamiento criptográfico SHA-256.
- [x] Módulos DRY extraídos en `src/lib/compartido/`.

### 6.2 Deuda Técnica Conocida y Roadmap Inmediato

**Etapa 3 (Estabilización y Refactoring):**

- [x] **H0:** Documentación de línea base (35 hallazgos analizados)
- [x] **H1:** Cobertura del runner con lotes concurrentes de 4
- [x] **H2a:** Sincronización del parser SMN del runner
- [x] **H2b:** Eliminación de `api/glm.js` huérfano
- [x] **H2c:** Aplicación de aviso SMN restringida a estados afectados
- [x] **H3:** Fallback en vivo del frontend expandido a 14 nodos
- [x] **H6:** Refactorización DRY en `src/lib/compartido/`
- [x] **H7a:** Vitest instalado, 36 tests, CI en GitHub Actions (cerrado en Etapa 3)
- [x] **H4:** Creación del gemelo desacoplado del motor en runner
- [ ] **H5:** Corrección de variable `visibility_gfs_seamless` (N18)
- [ ] **H7b:** Pruebas unitarias de utilidades de cadenas y fechas
- [ ] **H8:** Activación de validación estricta Zod en tiempo de ejecución
- [ ] **H9:** Cierre documental formal de Etapa 3

---

## 7. Calidad del Código, Convenciones y Pruebas

### 7.1 Convenciones de Código y Commits

- **Filosofía de commits:** commits atómicos bajo la regla *"Un commit = Una causa"*. El título del commit debe referenciar el componente o hito (ej. `fix(smn): normalizar extraccion de avisos para Puebla y Veracruz`).
- **Estrategia de ramas:** trunk-based simplificado. Todo cambio pasa por validación local antes de fusionarse en `main`.
- **Análisis de código:** se utiliza `oxlint` para garantizar ausencia de errores sintácticos, dependencias circulares o imports huérfanos.

### 7.2 Estrategia de Pruebas

#### Suite formal con Vitest (H7a)

El proyecto cuenta con **36 tests unitarios** ejecutados con Vitest. Se corren con `npm test` y también en cada push/PR a `main` vía GitHub Actions (`.github/workflows/tests.yml`).

**Archivos de test:**

- **`src/engine/__tests__/consensusEngine.test.js`** (12 tests): mediana de precipitación, filtro de ceros espurios, ráfagas como máximo, clasificación de confiabilidad por dispersión, lectura de visibilidad real (N18).
- **`src/engine/__tests__/riskEvaluator.test.js`** (16 tests): las 6 reglas del motor (N1–N4), prioridad entre reglas, niebla densa (N18), aplicación del aviso SMN solo a estados afectados (H-MOTOR-06).
- **`src/engine/__tests__/regresionFase1.test.js`** (8 tests): firma incompleta de `alertaSMN`, principio precautorio (SMN vs Open-Meteo), discriminación territorial (Apan con terracería), aviso SMN vencido, validación con el schema Zod real.

**Casos de estrés cubiertos por los tests:**

- **Huehuetla:** cañada fluvial escarpada; saturación de suelo > 100 mm con talud de 54°. Debe clasificar en **NIVEL 4 (EMERGENCIA)** (cubierto por tests de la Regla 2).
- **Apan / La Unión:** comunidad de montaña con camino de terracería. Debe clasificar en **NIVEL 3 (ALERTA_TEMPRANA)** por Regla 5 (corte vial) (cubierto por `regresionFase1.test.js`).

#### Validación de Schemas

Archivo `src/schemas/estadoDiocesanoSchema.js` mediante Zod para verificar que ningún objeto de datos viaje incompleto hacia el frontend. Los tests de `regresionFase1.test.js` validan que el schema rechaza payloads corruptos (semáforo negativo, evaluaciones vacías) y acepta payloads válidos.

---

## 8. Modelo de Datos y Cadena Criptográfica

### 8.1 Catálogo Geoespacial (`src/data/localidades.json`)

Contiene 405 registros. Cada entrada incluye:

```json
{
  "id": "LOC_HGO_HUEHUETLA_01",
  "nombre": "Huehuetla",
  "municipio": "Huehuetla",
  "estado": "Hidalgo",
  "zona_id": "HYC",
  "zona_nombre": "Huehuetla-San Bartolo Tutotepec",
  "coords": { "lat": 20.4633, "lon": -98.0739 },
  "topografia": {
    "altitud_msnm": 480,
    "pendiente_max_deg": 54.91,
    "relieve": "CANADA",
    "twi": 11.2
  },
  "hidrologia": {
    "subcuenca_cve": "RH27Ba",
    "subcuenca_nom": "Río Pantepec",
    "posicion": "FONDO_VALLE",
    "distancia_cauce_km": 0.12,
    "tc_horas": 2.1
  },
  "vulnerabilidad": {
    "poblacion": 2845,
    "marginacion": "MUY ALTO",
    "acceso_vial": "CAMINO_TERRACERIA",
    "dist_hospital_km": 24.9
  }
}
```

### 8.2 Estructura del Bloque de Bitácora Criptográfica

Cada registro se almacena en `bitacora_sara.json`:

```json
{
  "id": "SARA_LOG_142",
  "fecha_dia_mexico": "20 de octubre de 2026",
  "hora_exacta_mexico": "06:00:15 a. m.",
  "timestamp_iso_utc": "2026-10-20T12:00:15.120Z",
  "timestamp_local": "06:00 a. m.",
  "origen_evento": "PROGRAMADO_CRON",
  "estado_situacion": "SITUACION_NORMAL",
  "titulo": "Situación Diocesana de Calma y Vigilancia Preventiva",
  "resumen": "Monitoreo matutino sobre 405 localidades. 0 en Nivel 4, 0 en Nivel 3.",
  "prev_hash": "4a7f8b9c1d2e3f4a...",
  "hash": "8e2b1c0d4f5a6b7c...",
  "hash_completo": "8e2b1c0d4f5a6b7c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c"
}
```

---

## 9. Personas, Responsabilidades y Escalamiento

### 9.1 Matriz de Roles y Responsabilidades

| Rol | Titular | Responsabilidad Primaria |
|---|---|---|
| Arquitecto y Desarrollador Líder | Ing. Antonio G. Madrigal | Mantenimiento del código, estabilidad de APIs y arquitectura de software. |
| Coordinador Pastoral Diocesano | Padre Roberto López Medina | Toma de decisiones de ayuda humanitaria, apertura de albergues y contacto parroquial. |
| Oficial de Enlace de Emergencias | Padre Omar Martínez Vázquez | Difusión de avisos preventivos a párrocos y brigadas de campo. |
| Autoridad Eclesiástica Máxima | Mons. Oscar Roberto Domínguez C. | Aprobación institucional de protocolos de auxilio y directrices diocesanas. |

### 9.2 Canales de Comunicación y Enlace

- **Canal operativo urgente:** grupo cerrado de WhatsApp de Emergencias Cáritas Tulancingo.
- **Canal oficial ciudadano:** avisos publicados a través del portal y boletines de la Arquidiócesis.
- **Autoridades civiles de referencia:**
  - Subsecretaría de Protección Civil y Gestión de Riesgos del Estado de Hidalgo.
  - Dirección General de Protección Civil del Estado de Puebla.
  - Centro Nacional de Prevención de Desastres (CENAPRED).

---

## 10. Transferencia de Conocimiento y Checklist de Aceptación

### 10.1 Ruta Sugerida de Capacitación (Walkthrough)

Para un nuevo ingeniero que asuma el mantenimiento del sistema:

1. **Paso 1 — Fundamentos:** leer íntegramente `docs/01_CONTEXTO.md` y `docs/03_MOTOR_RIESGO.md` para comprender la formulación física de las 6 reglas geomecánicas.
2. **Paso 2 — Arquitectura:** revisar `docs/02_ARQUITECTURA.md` y la carpeta `src/lib/compartido/`.
3. **Paso 3 — Pruebas y auditoría:** ejecutar localmente `npm run dev`, `npm run lint` y `npm test` (36 tests con Vitest). Simular un cambio de umbral y verificar que los tests fallan (red de seguridad).
4. **Paso 4 — Sala operativa:** entrar en `http://localhost:5173`, acceder a la sala operativa con la clave `emergencia` y generar un reporte on-demand usando la clave autorizada de operador `Antonio2026`.
5. **Paso 5 — Integraciones cloud:** revisar el workflow `.github/workflows/sara_cron.yml` y comprobar el endpoint `/api/sara`.

### 10.2 Checklist Formal de Aceptación y Entrega

| # | Criterio de Verificación | Estado | Verificado por |
|---|---|---|---|
| 1 | El repositorio clona limpiamente y ejecuta `npm install` sin conflictos. | [x] Conforme | Ing. Entrante |
| 2 | El servidor inicia en el puerto 5173 con `npm run dev` y sirve la aplicación. | [x] Conforme | Ing. Entrante |
| 3 | El linter `npm run lint` reporta 0 errores. | [x] Conforme | Ing. Entrante |
| 4 | La suite de tests (`npm test`) pasa los 36 tests de Vitest sin errores. | [x] Conforme | Ing. Entrante |
| 5 | La compilación de producción `npm run build` genera la carpeta `dist/` sin advertencias críticas. | [x] Conforme | Ing. Entrante |
| 6 | El endpoint `/api/smn` conecta con éxito y obtiene la situación oficial de CONAGUA. | [x] Conforme | Ing. Entrante |
| 7 | El visor de satélite `/api/latest-gif` resuelve bucles válidos de NOAA GOES-19. | [x] Conforme | Ing. Entrante |
| 8 | La sala operativa permite autenticarse con `emergencia` y emitir reportes de prueba. | [x] Conforme | Ing. Entrante |
| 9 | La bitácora en `/api/sara` encadena correctamente los hashes SHA-256 sin romper la secuencia. | [x] Conforme | Ing. Entrante |
| 10 | Las credenciales están debidamente resguardadas fuera del código fuente. | [x] Conforme | Ing. Entrante |

---

*Fin del Documento de Handover. SatRC V2.0 — Cáritas Pastoral Social • Arquidiócesis de Tulancingo.*
