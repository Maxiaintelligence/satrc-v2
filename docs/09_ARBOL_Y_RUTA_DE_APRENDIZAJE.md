# SatRC V2.0 — Árbol del repositorio y ruta de aprendizaje

> **Versión del documento:** 1.0 (27/10/2026)
> **Audiencia:** Nuevos desarrolladores, asistentes de IA o cualquier persona que retome el proyecto en un cambio de etapa o versión.
> **Propósito:** Explicar para qué sirve cada archivo, cómo está estructurado el repositorio y proponer un camino lógico para entender el código sin perderse.
> **Regla de oro:** Este documento **debe ser actualizado al inicio de cada Etapa o Versión** para reflejar la estructura real del código en ese momento.

---

## 1. El árbol del repositorio (Ruta comentada)

A continuación se detalla la estructura real del proyecto (excluyendo `node_modules` y `dist`). 

### 1.1 Raíz del proyecto y configuración
- `package.json`: Lista de dependencias y scripts (`dev`, `build`, `test`, `lint`). El proyecto usa Node 22+.
- `vite.config.js` / `tailwind.config.js` / `postcss.config.js`: Configuración del frontend.
- `.env.local`: Variables de entorno **solo para desarrollo local**. No debe subirse a Git (está en `.gitignore`).
- `.github/workflows/`: Contiene `sara_cron.yml` (el proceso autónomo de GitHub Actions) y `tests.yml` (integración continua).
- `index.html`: Punto de entrada del frontend HTML.
- `procesar_datos.cjs`: Script histórico de Node usado para generar `localidades.json` a partir del CSV.
- `localidades_crudo.csv`: El archivo CSV fuente original con los datos de las 405 localidades.

*⚠️ Archivos residuales en la raíz (ignorar):* `diagnostico_calibracion.json`, `run_*.log`, `salida_lint.txt`, `salida_npm_test.txt`, `series_historicas_14_zonas.json`, `simulacion_nodos_resultado*.json`. Son residuos de pruebas de Etapa 3 y pueden borrarse.

### 1.2 Documentación (`docs/`)
- `LEEME_PRIMERO.md`: Punto de entrada. Resume el estado actual y dicta el orden de lectura.
- `00_METODOLOGIA.md`: Reglas de trabajo obligatorias (commits atómicos, pruebas, protocolo de modificación estricto).
- `01_CONTEXTO.md`: Qué es SatRC, principios y glosario.
- `02_ARQUITECTURA.md`: Capas, flujo de datos y descripción de componentes.
- `03_MOTOR_RIESGO.md`: Fórmulas físicas del motor (hidrológico, viento, térmico, convectivo, orquestador).
- `04_HISTORIAL.md`: Registro cronológico de bugs resueltos y commits.
- `05_PROMPT_SARA.md`: Ingeniería de prompts del agente IA.
- `06_PENDIENTES.md`: La **única lista vigente** de deuda técnica y riesgos activos. (Documento vital).
- `07_GUIA_OPERACION.md`: Cómo desplegar, verificar en producción y recuperarse de fallos.
- `08_DECISIONES.md`: Registro de ADRs (decisiones de arquitectura y alcance).
- `09_ARBOL_Y_RUTA_DE_APRENDIZAJE.md`: Este documento.
- `VERIFICACION_MULTIFACTOR.md`: Documento histórico sobre el hallazgo del consenso en el runner.
- `archivo/`: Documentos de Etapas 3 y 4 que ya no son vigentes. **No citar como fuente de verdad.**

### 1.3 Funciones Serverless (`api/`)
Vercel ejecuta estas funciones como endpoints de Node.
- `sara.js`: Endpoint principal (`GET /api/sara`). Lee Google Drive, valida con Zod y entrega el estado al frontend.
- `smn.js`: Hace scraping a la página del SMN para extraer el aviso oficial.
- `latest-gif.js`: Se conecta a los servidores de NOAA para devolver la imagen satelital más reciente.
- `reporte-ondemand.js`: Recibe un POST autenticado, llama a Groq para redactar el reporte, y lo guarda en Google Drive.
- `disparar-workflow.js`: Endpoint protegido que recibe un webhook de `cron-job.org` y dispara GitHub Actions.
- `auth-operativo.js`: Valida la clave de acceso a la Sala Operativa contra la variable de entorno `CLAVE_SALA_OPERATIVA`.

### 1.4 Proceso Autónomo (`scripts/`)
- `ejecutar_sara_autonomo.mjs`: El script principal que corre en GitHub Actions cada 3 horas. Descarga el clima, evalúa 405 localidades, y publica el estado.
- `engine/riskEvaluatorRunner.mjs`: Una copia del motor hidrológico adaptada para correr en el entorno de Node del runner.
- `reportes/reporteDiario.mjs`: Módulo que genera el reporte diario de las 6:00 AM y lo guarda.
- `diagnostico/`: Scripts de PowerShell (`.ps1`) usados en el pasado para auditar el motor, verificar bitácoras y reproducir bugs. Son útiles para debugging.

### 1.5 Frontend (`src/`)
- `main.jsx` / `App.jsx`: Punto de entrada y enrutamiento principal. `App.jsx` incluye el modal de login para la Sala Operativa.
- `index.css` / `App.css`: Estilos globales y configuración de Tailwind.
- `views/MonitorPublico.jsx`: La interfaz pública. Muestra el clima, el mapa y el semáforo para la comunidad.
- `views/SatRCOperativo.jsx`: La interfaz interna (Sala Operativa). Semáforo N1-N4, mapa, bitácora y botón para generar reportes.
- `components/`: Componentes de React reutilizables (mapas, modales de reportes, visor satelital, barras de vectores).
- `data/localidades.json`: La base de datos maestra de las 405 localidades (topografía, vulnerabilidad, etc.).
- `config/noaa-goes.js`: Configuración de los productos satelitales.
- `schemas/estadoDiocesanoSchema.js`: Contratos de datos validados con Zod. Vital para entender qué forma tiene el JSON del estado.

### 1.6 Motores de Evaluación (`src/engine/`)
El cerebro del sistema. Aquí no hay interfaz, solo matemáticas puras.
- `riskEvaluator.js`: El motor hidrológico original (Reglas 1 a 6).
- `hydroAdapter.js`: Envuelve al anterior para añadirle un nivel continuo (para el orquestador).
- `windEvaluator.js`: Evalúa el viento normalizando por densidad.
- `thermalEvaluator.js`: Evalúa frío, heladas y calor.
- `convectiveEvaluator.js`: Evalúa CAPE, granizo y downbursts.
- `crossThreatOrchestrator.js`: Recibe los 4 motores y calcula el nivel global con acoplamiento.
- `consensusEngine.js`: Toma los datos de GFS, ICON y GEM, y calcula la mediana.
- `meteoFetcher.js`: Hace las peticiones HTTP a Open-Meteo.
- `reportesRegionales.js`: Agrupa los datos de las 14 zonas para los reportes.

### 1.7 Módulos Compartidos (`src/lib/compartido/`)
Lógica pura que usan tanto el backend como el frontend.
- `googleDrive.js`: **El adaptador de base de datos actual.** Habla con Google Apps Script para leer/escribir JSONs.
- `bitacora.js`: Funciones para calcular hashes SHA-256 y generar resúmenes multivector.
- `dictamen.js`: Lógica para asignar títulos operativos.
- `regionales.js` / `nodos.js`: Lógica de agrupación y normalización de zonas.
- `mojibake.js`: Función de reparación de texto (UTF-8 doble).
- `fechas.js` / `markdown.jsx` / `noaa.js`: Utilidades varias de formato.

---

## 2. Ruta de aprendizaje (Para empezar a picar código)

Si eres nuevo, **no empieces a leer todos los archivos de golpe**. Sigue este orden:

1. **Entiende el "qué":** Lee `LEEME_PRIMERO.md` y `01_CONTEXTO.md`.
2. **Entiende el "cómo se trabaja":** Lee `00_METODOLOGIA.md` (especialmente la Fase 2.5 de instrucciones estrictas) y `06_PENDIENTES.md` (para ver qué está roto o en deuda).
3. **Entiende la física:** Abre `src/engine/riskEvaluator.js` y `windEvaluator.js`. Son los más fáciles de leer. Usa `03_MOTOR_RIESGO.md` como manual de fórmulas.
4. **Entiende el flujo de datos:** Abre `src/engine/crossThreatOrchestrator.js`. Mira cómo une los 4 vectores.
5. **Entiende la base de datos:** Mira `src/lib/compartido/googleDrive.js` para ver cómo se comunica con el exterior.
6. **Entiende el runner:** Lee `scripts/ejecutar_sara_autonomo.mjs`. Es el proceso que hace todo el trabajo cada 3 horas.
7. **Entiende la API:** Lee `api/sara.js`. Verás cómo lee el Blob, valida con Zod (`estadoDiocesanoSchema.js`) y entrega.
8. **Entiende la UI:** Finalmente, revisa `src/views/SatRCOperativo.jsx` y `MonitorPublico.jsx`.

**Prueba de fuego:** Una vez leído lo anterior, abre `src/engine/__tests__/` y corre `npm test`. Lee un test y modifica el código para hacerlo fallar, luego arréglalo. Esa es la mejor manera de entender cómo encajan las piezas.

---

## 3. Reglas para actualizar este archivo

1. **Obligatorio al iniciar Etapa/Versión:** Al crear una nueva rama para una etapa o versión, se debe actualizar esta lista si se agregaron nuevos archivos.
2. **Si renombras o mueves un archivo:** Actualiza su ruta en este documento.
3. **No listar `node_modules` ni archivos temporales.** 
4. **Mantener el foco en la utilidad:** Si agregas una carpeta compleja (ej. un sistema de cache), explica brevemente por qué está ahí.