# SatRC V2.0 — Handover (Documento de Traspaso de Contexto)

> **Fecha del corte:** Octubre 2026 (Etapa 3 en curso, H0–H6 cerrados).
> **Estado del sistema:** en producción (estable, con deuda técnica documentada).

Este documento es el punto de entrada para cualquier desarrollador (o IA) que se sume al proyecto. Resume el estado del arte, las decisiones arquitectónicas, los bugs evitados y el plan de trabajo vigente.

## Índice

1. [Reglas de oro (metodología obligatoria)](#1-reglas-de-oro-metodología-obligatoria)
2. [¿Dónde estamos parados? (Etapa 3)](#2-dónde-estamos-parados-etapa-3)
3. [Cambios arquitectónicos y de código recientes](#3-cambios-arquitectónicos-y-de-código-recientes)
4. [Deuda técnica pendiente (post-Etapa 3)](#4-deuda-técnica-pendiente-post-etapa-3)
5. [Mapa de archivos críticos](#5-mapa-de-archivos-críticos)
6. [Instrucciones de arranque para el nuevo desarrollador](#6-instrucciones-de-arranque-para-el-nuevo-desarrollador)

---

## 1. Reglas de oro (metodología obligatoria)

Antes de tocar una sola línea de código, el nuevo desarrollador debe entender que este sistema está en producción y atiende una red de emergencia pastoral. Romperlo tiene implicaciones reales.

1. **Diagnóstico antes de código:** nunca asumas el estado del sistema. Usa comandos de PowerShell para consultar el Blob y los logs de Vercel/GitHub Actions.
2. **Un commit = una causa:** los commits deben ser atómicos. Si un hito es grande (ej. H6), se divide en sub-hitos. Si algo falla, debes poder hacer `git revert <hash>` sin afectar otras funcionalidades.
3. **Verificación cruzada:**
   - Si tocas el Backend (`api/`), verifica que el Frontend haga `npm run build`.
   - Si tocas el Runner (`scripts/`), verifica con `node --check` y dispara un workflow para confirmar que el import resuelve en GitHub Actions.
4. **Cuidado con los prompts de la IA:** los prompts de Groq están hardcodeados en los archivos JS. Cambiar una palabra puede causar alucinaciones en el reporte. Siempre prueba con datos reales antes de commitear.
5. **Seguridad institucional:** el público general **NUNCA** debe poder exportar ni compartir por WhatsApp el reporte oficial. Esa capacidad es exclusiva de los operadores autenticados.

---

## 2. ¿Dónde estamos parados? (Etapa 3)

La Etapa 3 es de **deuda técnica, no de nuevas features**. La Versión 3.0 (con nuevos vectores, auth real y percentiles) es un trabajo futuro.

### Hitos cerrados en Etapa 3

| Hito | Descripción |
|---|---|
| **H0** | Documentación de línea base (35 hallazgos). |
| **H1** | Cierre de N26 (cobertura del runner con lotes de 4). |
| **H2a** | Sincronización del parser SMN del runner (H-MOTOR-02). |
| **H2b** | Eliminación de `api/glm.js` (H-API-07). |
| **H2c** | Fix de H-MOTOR-06 (aplicación del aviso SMN solo a estados afectados). |
| **H3** | Fallback del frontend con 14 nodos (H-MOTOR-04). |
| **H6** | Refactor DRY (5 módulos compartidos en `src/lib/compartido/`, 14 copias eliminadas). |

### Hitos pendientes

| Hito | Descripción |
|---|---|
| **H7a** | Vitest bloqueante (tests reales de `riskEvaluator` y `consensusEngine`). |
| **H4** | Motor unificado (gemelo `riskEvaluatorRunner.mjs`). |
| **H5** | Fix de N18 + documentar H-SEG-01. |
| **H7b** | Tests del resto de los módulos compartidos. |
| **H8** | Zod activo en `/api/sara` y runner. |
| **H9** | Cierre documental de Etapa 3. |

---

## 3. Cambios arquitectónicos y de código recientes

### A. Módulos compartidos (H6)

Para eliminar la duplicación, se crearon 5 módulos en `src/lib/compartido/`:

- `fechas.js`: `formatearTimestamp`.
- `markdown.jsx`: `TextoEnriquecido`.
- `nodos.js`: `seleccionarNodosRegionales`.
- `mojibake.js`: `repararMojibake` y `repararObjeto`.
- `regionales.js`: `normalizarDatosRegionales` y `construirBloqueRegional`.

Todos los callers (frontend, api y scripts) ahora importan desde ahí.

### B. Aviso SMN (H2a y H2c)

El runner ya no usa el webservice `method=1`. Ahora hace scraping a la página principal y genera `alertaSMN` con `activo`, `nivel` y `severidad`.

Además, el piso de lluvia del aviso (`rango_lluvia_min_mm`) solo se aplica a localidades en estados afectados (`HGO`, `PUE`, `VER`), evitando la sobre-alertación masiva.

### C. Cobertura del runner (H1 - N26)

`cargarSeriesRegionales()` ahora usa lotes de 4 con `Promise.allSettled` y delay de 500 ms.

> ⚠️ **No cambiar `TAMANO_LOTE = 4`.** Esto eliminó los falsos negativos por timeout de Open-Meteo.

### D. Fallback en vivo (H3)

`SatRCOperativo.jsx` → `ejecutarEvaluacionRealEnVivo()` ahora usa los 14 nodos regionales, no solo Huauchinango.

---

## 4. Deuda técnica pendiente (post-Etapa 3)

| Ítem | Estado | Detalle |
|---|---|---|
| **N26** | ✅ Cerrado | |
| **Mojibake (N27/N22)** | ⏳ Parche defensivo | Parche en lectura. Causa raíz pendiente (V3.0). |
| **Funciones duplicadas** | ✅ Cerrado | Resuelto en H6. |
| **H-MOTOR-01** (unificación total del motor) | ⏳ Pendiente | En H4 se creará el gemelo separado. Unificación real en V3.0. |
| **H-MOTOR-05** (sobreclasificación N2 en XIC/HUA/ZAC) | ⏳ Pendiente | Requiere re-auditoría de 90 días (V3.0). |
| **H-SEG-01** (`/api/sara` sin token) | ⏳ Pendiente | Requiere rediseño de contrato (V3.0). |
| **Tests formales** | 🔄 En curso | H7a. |

---

## 5. Mapa de archivos críticos

**Dónde NO tocar a ciegas:**

| Archivo | Función | Precaución |
|---|---|---|
| `src/engine/riskEvaluator.js` | Motor de evaluación (Reglas 1-6). | Si cambias un umbral, recalcula 90 días de historial. |
| `src/lib/compartido/*` | Funciones utilitarias. | Un cambio aquí afecta al frontend, a la API y al runner. |
| `api/smn.js` | Parser de avisos CONAGUA. | Es un scraper. Si el SMN cambia su web, se rompe. |
| `api/reporte-ondemand.js` | Generación de reportes con Groq. | Contiene el `systemPrompt` y el mapa de `USUARIOS_AUTORIZADOS`. |
| `scripts/ejecutar_sara_autonomo.mjs` | El Runner (cron). | Contiene la lógica de detección de las 6:00 AM y el aviso SMN. |
| `src/components/ReporteCuerpo.jsx` | UI del reporte. | Es compartido entre vista pública y operativa. |

---

## 6. Instrucciones de arranque para el nuevo desarrollador

1. **Lee la carpeta `docs/`.** Empieza por `01_CONTEXTO.md`, sigue por `08_ETAPA3_PLAN.md` y luego `07_GUIA_OPERACION.md`.
2. **Configura tu entorno:** asegúrate de tener `gh` CLI (Git Bash) y `node --check` a mano.
3. **Auditoría inicial:** antes de tu primer commit, verifica el estado de producción (ver Guía de Operación).
4. **Elige tu primera tarea:** revisa `06_PENDIENTES.md` para ver qué toca (actualmente H7a - Vitest).

El sistema es robusto, auditable (gracias a la bitácora SHA-256) y está salvando vidas en la diócesis. Trátalo con el respeto que merece.