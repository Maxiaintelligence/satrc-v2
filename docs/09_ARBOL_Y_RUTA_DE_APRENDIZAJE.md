# SatRC V2.0 — Árbol del repositorio y ruta de aprendizaje

> **Versión del documento:** 2.0 (28/10/2026)
> **Audiencia:** Nuevos desarrolladores, asistentes de IA o cualquier persona que retome el proyecto en un cambio de etapa o versión.
> **Propósito:** Explicar para qué sirve cada archivo, cómo está estructurado el repositorio y proponer un camino lógico para entender el código sin perderse.
> **Regla de oro:** Este documento **debe ser actualizado al inicio de cada Etapa o Versión** para reflejar la estructura real del código en ese momento. Si un archivo del repo no está aquí, es deuda documental (ver §5).

---

## 1. El árbol del repositorio (Ruta comentada)

A continuación se detalla la estructura real del proyecto (excluyendo `node_modules`, `dist`, `.git`). Total de archivos del repo acotado: **~130**.

### 1.1 Raíz del proyecto y configuración

**Archivos versionados (12):**

- `package.json`: Dependencias y scripts (`dev`, `build`, `lint`, `test`, `preview`). No declara `engines.node` (el 22 lo impone el workflow de CI, ver §1.4).
- `package-lock.json`: Lockfile de npm. Versionado intencionalmente.
- `vite.config.js`, `tailwind.config.js`, `postcss.config.js`: Configuración del frontend (React 19 + Vite 8 + Tailwind 3).
- `.oxlintrc.json`: Configuración del linter (`oxlint`). El `npm run lint` lo consume.
- `.gitignore`: Exclusiones de git (ver §5 para deudas detectadas).
- `.env.local`: Variables de entorno **solo para desarrollo local**. Ignorado por la regla `*.local` de `.gitignore`. **Nunca debe subirse al repo.**
- `index.html`: Punto de entrada del frontend HTML.
- `README.md`: Archivo de bienvenida del proyecto. Menciona los docs `00`-`08` pero **no menciona `09` ni `VERIFICACION_MULTIFACTOR.md`** (deuda H-DOC-README-01). Tiene mojibake que se limpiará en la siguiente pasada.
- `procesar_datos.cjs`: Script histórico de Node usado para generar `localidades.json` a partir del CSV. **No está en ningún workflow ni script de npm** (deuda H-NOM-01). Se conserva como referencia histórica.
- `localidades_crudo.csv`: El CSV fuente original con los datos de las 405 localidades.
- `run_39688819491.log`: Residuo local de una corrida de diagnóstico. Ignorado por `*.log`. Purgable.

**Archivos residuales de auditoría (5):**

- `diagnostico_calibracion.json` — Ignorado (`diagnostico_calibracion.json` en `.gitignore` L27).
- `series_historicas_14_zonas.json` — Ignorado (`.gitignore` L28).
- `simulacion_nodos_resultado.json` — Ignorado (`.gitignore` L29).
- `simulacion_nodos_resultado_v2.json` — Ignorado (`.gitignore` L30).
- **`salida_lint.txt`** — ⚠️ **NO ignorado por git**. Deuda H-DOC-GIT-01. Puede trackearse por accidente.
- **`salida_npm_test.txt`** — ⚠️ **NO ignorado por git**. Deuda H-DOC-GIT-01.

**Carpetas de la raíz (10):**

- `.github/`: Workflows de CI. Ver §1.4.
- `api/`: Funciones serverless. Ver §1.3.
- `diagnostico_externo/`: 3 archivos de pruebas externas ejecutadas manualmente contra producción (`prueba_hmotor07.mjs`, `prueba_orquestador_produccion.mjs`, `resultado_PMN_2026-10-23.json`). **No documentado en versiones previas de este doc.** No es parte del runtime; es de diagnóstico histórico.
- `diagnostico_thermal/`: Snapshot local (`sara_snapshot.json`). **Ignorado por git** (`.gitignore` L36). Contiene datos de producción y nombres de operadores. **Nunca debe subirse al repo.**
- `docs/`: Documentación. Ver §1.2.
- `notas_personales/`: Notas de desarrollo (`CONTINUA_dev_anterior.MD`, `deepseek_text_20261010_2bab1a.txt`). **Ignorado por git** (`.gitignore` L33). No debe subirse al repo.
- `public/`: **Activos estáticos de la PWA.** Ver §1.5.
- `scripts/`: Proceso autónomo. Ver §1.4.
- `src/`: Frontend y motores. Ver §1.5 y §1.6.
- `test/`: **Carpeta vacía.** Deuda H-DOC-TEST-01. Purgar o poblar.

---

### 1.2 Documentación (`docs/`)

**Documentos vigentes (12 archivos `.md`):**

- `LEEME_PRIMERO.md`: Punto de entrada. Resume el estado actual y dicta el orden de lectura.
- `00_METODOLOGIA.md`: Reglas de trabajo obligatorias (commits atómicos, pruebas, protocolo de modificación estricto, Fase 2.5 con 5 puntos).
- `01_CONTEXTO.md`: Qué es SatRC, principios (incluye DEC-011) y glosario.
- `02_ARQUITECTURA.md`: Capas, flujo de datos, endpoints, almacenamiento y contratos Zod.
- `03_MOTOR_RIESGO.md`: Fórmulas físicas del motor (hidrológico, viento, térmico, convectivo, orquestador).
- `04_HISTORIAL.md`: Registro cronológico de bugs resueltos, hitos y commits.
- `05_PROMPT_SARA.md`: Ingeniería de prompts del agente IA.
- `06_PENDIENTES.md`: La **única lista vigente** de deuda técnica y riesgos activos. (Documento vital.)
- `07_GUIA_OPERACION.md`: Cómo desplegar, verificar en producción y recuperarse de fallos.
- `08_DECISIONES.md`: Registro de ADRs (arquitectura) y DEC (alcance y proceso). Incluye DEC-011.
- `09_ARBOL_Y_RUTA_DE_APRENDIZAJE.md`: Este documento.
- `VERIFICACION_MULTIFACTOR.md`: Documento histórico sobre el hallazgo del consenso en el runner y su corrección.

**Carpeta `docs/archivo/` (12 archivos):**

Contiene documentos de Etapas 3 y 4, más un archivo de la sesión del 28/10/2026:

- **Históricos (Etapa 3 y 4, 9 archivos):** `08_ETAPA3_PLAN.md`, `09_HALLAZGOS_ETAPA3.md`, `10_HANDOVER.md`, `11_E4_WIND_EVALUATOR.md`, `12_E4_THERMAL_EVALUATOR.MD`, `13_E4_CONVECTIVE_EVALUATOR.md`, `14_E4_CROSS_THREAT_ORCHESTRATOR.md`, `15_ETAPA4_PLAN.md`, `16_E4_HYDRO_ADAPTER.md`, `AUDITORIA_MOTOR.md`, `HANDOVER_SESION_2026-10-22.md`. **No citar como fuente de verdad.**
- **Vigente (28/10/2026):** `FIXES_PROMPTS_2026-10-28.md`. ⚠️ **Sí es fuente de verdad.** Contiene las propuestas de implementación de los fixes H-PROMPT-05, 06, 07, 08, 09, 10. **No es un archivo histórico**; está aquí por convención de carpeta, pero es operativo. Ver `05_PROMPT_SARA.md` §11.

**Inconsistencia de extensión:** `12_E4_THERMAL_EVALUATOR.MD` (mayúsculas). Deuda H-DOC-EXT-01.

---

### 1.3 Funciones Serverless (`api/`)

Vercel ejecuta estas 6 funciones como endpoints de Node 22.

- `sara.js`: Endpoint principal (`GET /api/sara`). Lee **`estado_ligero.json` de Google Drive**, valida con Zod y entrega el estado al frontend. Si falla, cae al fallback en vivo (`RESPUESTA_EN_VIVO`).
- `smn.js`: Scraping de la página del SMN para extraer el aviso oficial vigente.
- `latest-gif.js`: Se conecta a los servidores de NOAA para devolver la imagen satelital más reciente de GOES-19.
- `reporte-ondemand.js`: Recibe un POST autenticado con `x-user-key`, llama a Groq para redactar el reporte y lo guarda en **Google Drive** (vía `escribirJSONBlob`). Es el **único reporte que llega al operador hoy** (ver H-REPORTE-02).
- `disparar-workflow.js`: Endpoint protegido con `x-cron-secret`. Recibe el webhook de `cron-job.org` y dispara GitHub Actions.
- `auth-operativo.js`: Valida la clave de acceso a la Sala Operativa contra `CLAVE_SALA_OPERATIVA`.

**Nota:** `api/` no tiene tests directos. La cobertura de estos endpoints es deuda (`06_PENDIENTES.md`).

---

### 1.4 Proceso Autónomo (`scripts/` y `.github/`)

**Workflows (`.github/workflows/`):**

- `sara_cron.yml`: Cron autónomo cada 3 horas (`21 */3 * * *` en UTC). Ejecuta `scripts/ejecutar_sara_autonomo.mjs` con Node 22.
- `tests.yml`: CI de pruebas (`npm test`). **No corre `npm run build`** (deuda H-CI-01).

**Scripts (`scripts/`):**

- `ejecutar_sara_autonomo.mjs`: El script principal que corre en GitHub Actions cada 3 horas. Descarga el clima, evalúa 405 localidades, publica el estado en Drive y genera el dictamen.
- `engine/riskEvaluatorRunner.mjs`: Copia del motor hidrológico adaptada para correr en el entorno de Node del runner.
- `engine/__tests__/riskEvaluatorRunner.test.js`: 3 pruebas de paridad entre el motor del runner y el canónico.
- `reportes/reporteDiario.mjs`: Módulo que genera el reporte diario de las 6:00 AM. ⚠️ **Actualmente falla por H-REPORTE-02**: usa `@vercel/blob` y como `BLOB_READ_WRITE_TOKEN` no se inyecta en `sara_cron.yml`, el reporte falla silenciosamente. Debe migrarse a `googleDrive.js` en v2.0.
- `diagnostico/`: 10 scripts PowerShell (`.ps1`) usados en el pasado para auditar el motor, verificar bitácoras y reproducir bugs. **No están referenciados en ningún workflow ni script activo.** Uso histórico. Deuda H-DOC-PS1-01.
- `diagnostico/output/watchdog_vectores.log`: Log residual de un watchdog. Contiene un error del script (`Invalid URI`), sin datos sensibles. Ignorado por `*.log`.

**Total en `scripts/`:** 15 archivos (10 `.ps1` + 1 `.log` + 4 `.mjs`/`.js`).

---

### 1.5 Frontend (`src/` y `public/`)

**Activos estáticos de la PWA (`public/`):**

⚠️ **La app es una PWA funcional.** `public/` no estaba documentado en la versión 1.0 de este documento. Contiene:

- `manifest.json` (514 bytes): Manifest de la PWA.
- `sw.js` (708 bytes): Service Worker para cache offline.
- `favicon.svg`, `icon.svg`, `icons.svg`: Íconos de la app.

**Nota:** El Service Worker indica que la PWA puede operar offline al menos parcialmente. Verificar su comportamiento en `04_HISTORIAL.md`.

**Frontend (`src/`):**

- `main.jsx` / `App.jsx`: Punto de entrada y enrutamiento principal. `App.jsx` incluye el modal de login para la Sala Operativa.
- `index.css` / `App.css`: Estilos globales y configuración de Tailwind.
- `views/MonitorPublico.jsx`: Interfaz pública. Selector zona → municipio → localidad, semáforo y gráficas.
- `views/SatRCOperativo.jsx`: Interfaz interna (Sala Operativa). Semáforo N1-N4, mapa, bitácora, botón para generar reportes.
- `assets/`: 3 archivos sin referencias en el código: `hero.png`, `react.svg`, `vite.svg`. Los 3 son residuales (los 2 últimos del template de Vite). Deuda H-DOC-ASSETS-01.
- `config/noaa-goes.js`: Configuración de los productos satelitales de NOAA.
- `data/localidades.json`: Base de datos maestra de las 405 localidades (topografía, vulnerabilidad, etc.).
- `schemas/estadoDiocesanoSchema.js`: Contratos de datos validados con Zod.

**Componentes de React (`src/components/`, 8 archivos):**

- `DisclaimerModal.jsx`: Deslinde institucional.
- `OfficialAlertBanner.jsx`: Cinta del aviso vigente del SMN.
- `ReporteCuerpo.jsx`: Cuerpo del reporte (compartido entre modal público y operativo).
- `ReporteModalOperativo.jsx`: Modal de reporte bajo demanda.
- `ReporteModalPublico.jsx`: Modal de reporte público.
- `RiskMap.jsx`: Mapa de localidades.
- `SatelliteViewer.jsx`: Visor satelital GOES-19.
- `VectorBar.jsx`: Barra de nivel continuo por vector.

---

### 1.6 Motores de Evaluación (`src/engine/`)

El cerebro del sistema. Aquí no hay interfaz, solo matemáticas puras.

**Motores (9 archivos):**

- `riskEvaluator.js`: Motor hidrológico canónico (Reglas 1 a 6).
- `hydroAdapter.js`: Envuelve al anterior para añadir un nivel continuo (para el orquestador).
- `windEvaluator.js`: Evalúa viento normalizando por densidad (3 subtipos: `VIENTO_NORMAL`, `VIENTO_FUERTE`, `VIENTO_DESTRUCTIVO`).
- `thermalEvaluator.js`: Evalúa frío, heladas, nevadas y calor.
- `convectiveEvaluator.js`: Evalúa CAPE, granizo y downbursts.
- `crossThreatOrchestrator.js`: Recibe los 4 motores y calcula el nivel global con acoplamiento.
- `consensusEngine.js`: Toma datos de GFS, ICON y GEM, y calcula la mediana.
- `meteoFetcher.js`: Peticiones HTTP a Open-Meteo (15 variables, 3 modelos).
- `reportesRegionales.js`: Agrupa los datos de las 14 zonas para los reportes.

**Carpetas `__tests__/` (4 en total):**

- `src/engine/__tests__/`: 9 archivos `.test.js`. **Nota:** el doc 09 v1.0 mencionaba solo esta carpeta.
- `src/engine/__tests__/fixtures/openmeteo_sample.json`: 240h de datos reales de Pachuca (55847 bytes, 8 pruebas lo usan). Fixture crítico referenciado en `03_MOTOR_RIESGO.md` §4.4.
- `src/lib/compartido/__tests__/`: 7 archivos `.test.js`.
- `src/lib/__tests__/`: **Carpeta vacía.** Deuda H-DOC-TEST-01.
- `scripts/engine/__tests__/`: 1 archivo (paridad del motor del runner).

**Total en `src/`:** 56 archivos.

---

### 1.7 Módulos Compartidos (`src/lib/compartido/`)

Lógica compartida entre backend y frontend (10 archivos).

- `googleDrive.js`: **El adaptador de base de datos actual.** Habla con Google Apps Script para leer/escribir JSONs. (No es "lógica pura"; es I/O.)
- `bitacora.js`: Cálculo de hashes SHA-256 y resumen multivector.
- `dictamen.js`: Generación del título operativo del dictamen.
- `regionales.js` / `nodos.js`: Normalización de zonas y selección de nodos regionales.
- `mojibake.js`: Reparación de texto con doble codificación UTF-8.
- `promptsMultivector.js`: Reglas multivectoriales para los prompts de SARA. **No estaba en el doc 09 v1.0.** Actualmente implementa solo la regla 17 (R18, R19, R20 pendientes — H-PROMPT-08).
- `fechas.js` / `markdown.jsx` / `noaa.js`: Utilidades de formato.

---

## 2. Ruta de aprendizaje (Para empezar a picar código)

Si eres nuevo, **no empieces a leer todos los archivos de golpe**. Sigue este orden:

1. **Entiende el "qué":** Lee `LEEME_PRIMERO.md` y `01_CONTEXTO.md`. Principio rector: precisión sobre cobertura (DEC-011).
2. **Entiende el "cómo se trabaja":** Lee `00_METODOLOGIA.md` (especialmente la Fase 2.5, protocolo de 5 puntos) y `06_PENDIENTES.md` (para ver qué está roto o en deuda).
3. **Entiende la física:** Abre `src/engine/riskEvaluator.js` y `windEvaluator.js`. Son los más fáciles de leer. Usa `03_MOTOR_RIESGO.md` como manual de fórmulas.
4. **Entiende el flujo de datos:** Abre `src/engine/crossThreatOrchestrator.js`. Mira cómo une los 4 vectores.
5. **Entiende la base de datos:** Mira `src/lib/compartido/googleDrive.js` para ver cómo se comunica con el exterior.
6. **Entiende el runner:** Lee `scripts/ejecutar_sara_autonomo.mjs`. Es el proceso que hace todo el trabajo cada 3 horas. Luego revisa `scripts/reportes/reporteDiario.mjs` (el reporte diario, actualmente roto por H-REPORTE-02).
7. **Entiende la API:** Lee `api/sara.js`. Verás cómo lee **`estado_ligero.json` de Google Drive**, valida con Zod (`estadoDiocesanoSchema.js`) y entrega. El fallback (`RESPUESTA_EN_VIVO`) es deuda H-SARA-01..05.
8. **Entiende los prompts:** Lee `src/lib/compartido/promptsMultivector.js` y `05_PROMPT_SARA.md` para entender cómo SARA redacta el texto.
9. **Entiende la UI:** Finalmente, revisa `src/views/SatRCOperativo.jsx` y `MonitorPublico.jsx`.

**Prueba de fuego:** Una vez leído lo anterior, abre las 4 carpetas `__tests__/` (`src/engine/__tests__/`, `src/lib/compartido/__tests__/`, `scripts/engine/__tests__/`) y corre `npm test`. Lee un test y modifica el código para hacerlo fallar, luego arréglalo. Esa es la mejor manera de entender cómo encajan las piezas.

---

## 3. Reglas para actualizar este archivo

1. **Obligatorio al iniciar Etapa/Versión:** Al crear una nueva rama para una etapa o versión, actualizar la lista si se agregaron nuevos archivos.
2. **Si renombras o mueves un archivo:** Actualizar su ruta en este documento.
3. **No listar `node_modules`, `dist`, ni archivos temporales** (`*.log`, `*.tmp`).
4. **Mantener el foco en la utilidad:** Si agregas una carpeta compleja (ej. un sistema de cache), explica brevemente por qué está ahí.
5. **`docs/archivo/FIXES_PROMPTS_2026-10-28.md` es vigente:** aunque esté en `archivo/`, contiene propuestas de implementación activas (H-PROMPT-05..10). No tratarlo como histórico.
6. **`public/` es parte de la PWA:** no omitirlo del árbol. Contiene `manifest.json` y `sw.js`.

---

## 4. Documentos relacionados

- `docs/LEEME_PRIMERO.md`: punto de entrada y estado actual.
- `docs/00_METODOLOGIA.md`: reglas de trabajo y protocolo de modificación.
- `docs/01_CONTEXTO.md`: qué es SatRC, principios, glosario (incluye DEC-011).
- `docs/02_ARQUITECTURA.md`: capas, flujo de datos, endpoints, almacenamiento, contratos.
- `docs/03_MOTOR_RIESGO.md`: motor de riesgo, evaluadores, orquestador.
- `docs/04_HISTORIAL.md`: cronología de bugs resueltos y lecciones.
- `docs/05_PROMPT_SARA.md`: prompts de SARA y estado de la adaptación multivectorial.
- `docs/06_PENDIENTES.md`: **única lista vigente** de deudas y riesgos.
- `docs/07_GUIA_OPERACION.md`: procedimientos de operación, despliegue y recuperación.
- `docs/08_DECISIONES.md`: ADRs y DEC (incluye DEC-011).
- `docs/VERIFICACION_MULTIFACTOR.md`: documento histórico del hallazgo H-MULTI.
- `docs/archivo/FIXES_PROMPTS_2026-10-28.md`: **propuestas de implementación de los fixes de prompts** (H-PROMPT-05, 06, 07, 08, 09, 10).

---

## 5. Deudas documentales detectadas (a integrar en `06_PENDIENTES.md`)

| ID | Deuda | Sev. | Referencia |
|---|---|---|---|
| **H-DOC-README-01** | `README.md` menciona los docs `00`-`08` pero no `09` ni `VERIFICACION_MULTIFACTOR.md`. Tiene mojibake pendiente. | 🟢 | §1.1 |
| **H-DOC-GIT-01** | `salida_lint.txt` y `salida_npm_test.txt` **no están en `.gitignore`**. Riesgo de trackearse. | 🟡 | §1.1 |
| **H-DOC-TEST-01** | Carpetas vacías: `src/lib/__tests__/` y `test/`. Purgar o poblar. | 🟢 | §1.6, §1.1 |
| **H-DOC-ASSETS-01** | `src/assets/` contiene 3 archivos (`hero.png`, `react.svg`, `vite.svg`) sin referencias en el código. Residuos del template de Vite. | 🟢 | §1.5 |
| **H-DOC-PS1-01** | `scripts/diagnostico/*.ps1` son 10 scripts de diagnóstico histórico, no referenciados en workflows ni scripts activos. Decidir si archivar en `docs/archivo/` o eliminar. | 🟢 | §1.4 |
| **H-DOC-EXT-01** | `12_E4_THERMAL_EVALUATOR.MD` tiene extensión en mayúsculas (`.MD`). Renombrar a `.md`. | 🟢 | §1.2 |
| **H-DOC-PUBLIC-01** | `public/` (manifest, service worker, íconos de la PWA) no estaba documentado en el doc 09 v1.0. Ya corregido en esta versión 2.0, pero conviene registrar que se omitió. | 🟢 | §1.5 |
| **H-DOC-DIAGEXT-01** | `diagnostico_externo/` (3 archivos de pruebas externas) no estaba documentado en el doc 09 v1.0. Ya agregado en esta versión 2.0. | 🟢 | §1.1 |