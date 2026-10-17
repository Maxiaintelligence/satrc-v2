# SatRC V2.0 — Plan de Etapa 3 (Deuda Técnica)

**Fecha de inicio:** Octubre 2026
**Estado:** En curso
**Objetivo rector:** Cerrar deuda técnica, establecimiento de tests y documentación. **NO agregar features nuevas.**

> ⚠️ **Etapa 3 ≠ Versión 3.0.** La Etapa 3 es el trabajo actual de deuda técnica.
> La Versión 3.0 sería un salto mayor (nuevos vectores de riesgo, autenticación real, percentiles históricos).
> Lo que sea V3.0 va al roadmap documentado en `06_PENDIENTES.md`, no se toca ahora.

---

## 1. Línea base (estado al inicio de Etapa 3)

### Repositorio

- Repo GitHub: `Maxiaintelligence/satrc-v2` (branch `main`).
- Carpeta local: `satrc-v3` (por la Etapa 3, **no** por una versión 3.0).
- Último commit al inicio: `484f833` — `docs: reescribe documentacion de ingenieria profunda`.
- Working tree: limpio.

### Producción

- Endpoint `/api/sara`: `origen = VERCEL_BLOB_ACTUALIZADO`.
- Semáforo: N4=19, N3=51, N2=203, N1=132 (total 405).
- Título del dictamen: "Emergencia por Lluvias Torrenciales en la Región".
- Endpoint `/api/smn`: `activo=true, nivel=3, titulo="Lluvias Torrenciales en la Región"`.
- Hora servidor México: 12:00 p.m.

### Infraestructura

- **NO hay `vercel.json`.** Deploy por autodetección de Vercel.
- **NO hay `.vercel/`.** El deploy se gestiona desde Vercel dashboard.
- **NO hay `.env` en raíz.** Solo `.env.local` con 1 variable (`VITE_SARA_ONDEMAND_TOKEN`), sin BOM, sin comentarios.
- `.github/workflows/`: solo `sara_cron.yml`.
- `public/`: `favicon.svg`, `icon.svg`, `icons.svg` (los 3 existen). `icon-192.png` e `icon-512.png` **no existen** (el manifest no los referencia, usa solo `icon.svg`).

### Tests actuales

- `test_consenso.mjs`, `test_riesgos.mjs`, `test_sistemico.mjs`, `test_regresion_fase1.mjs`.
- **No hay `package.json` script `"test"`.**
- Ver hallazgos H-TEST-01, H-TEST-02, H-TEST-03.

### Variables de entorno en PowerShell del dev

- **Ninguna cargada.** No hay `GROQ_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `GITHUB_PAT` en la sesión.
- Implicación: no se puede correr el runner completo en local. **Decisión de Etapa 3: la verificación funcional es 100% en GitHub Actions.**

---

## 2. Nomenclatura (crítico para no confundir)

| Término | Significado |
|---|---|
| **Etapa 3** | Trabajo actual de deuda técnica (Oct 2026). |
| **Versión 3.0** | Salto mayor futuro (nuevos vectores, auth real, percentiles). NO en Etapa 3. |
| **satrc-v2** | Nombre del repositorio GitHub (histórico, por la versión de la app). |
| **satrc-v3** | Nombre de la carpeta local (por la Etapa 3). |
| **V2.0** | Versión actual de la aplicación (lo que dice la UI). |

**`api/disparar-workflow.js` apunta correctamente a `satrc-v2`. No cambiar a `satrc-v3`.**

---

## 3. Roadmap de Etapa 3 (9 hitos, 25 commits)

### H0 — Documentación de línea base
- Crear `docs/08_ETAPA3_PLAN.md` (este archivo) y `docs/09_HALLAZGOS_ETAPA3.md`.
- **Sin tocar código.**
- **Commit:** `docs(etapa3): linea base, nomenclatura y 35 hallazgos`

### H1 — Cerrar N26 (cobertura del runner)
- Refactor `cargarSeriesRegionales()` en `scripts/ejecutar_sara_autonomo.mjs`: lotes de 4 en vuelo, `Promise.allSettled(lote)`, delay entre lotes.
- **NO `--dry-run`.** Verificación 100% en GitHub Actions.
- **Criterio de aceptación:** 1 corrida de GitHub Actions con `zonas_ok = 14/14` y `zonas_fallidas = []`.
- **Commits:**
  1. `fix(runner): aplica lotes de 4 en cargarSeriesRegionales (N26)`
  2. `docs(runner): cierra N26 en historial de bugs`

### H2 — Limpieza de backend
- **2a:** Sincronizar parser SMN del runner con `api/smn.js` (H-MOTOR-02).
- **2b:** Eliminar `api/glm.js` (código muerto confirmado, H-API-07).
- **Commits:**
  1. `fix(runner): sincroniza parser SMN con api/smn.js (H-MOTOR-02)`
  2. `chore(api): elimina glm.js (código muerto, H-API-07)`

### H3 — Fallback del frontend con 14 nodos
- `SatRCOperativo.jsx` → `ejecutarEvaluacionRealEnVivo` usa los 14 nodos (H-MOTOR-04).
- **Commit:** `fix(ui): fallback en vivo usa 14 nodos regionales (H-MOTOR-04)`

### H6 — DRY (extraer duplicados)
- `repararMojibake`, `repararObjeto` → `src/lib/compartido/mojibake.js`
- `normalizarDatosRegionales`, `construirBloqueRegional` → `src/lib/compartido/regionales.js`
- `seleccionarNodosRegionales` → `src/lib/compartido/nodos.js`
- `formatearTimestamp` → `src/lib/compartido/fechas.js`
- `TextoEnriquecido` → `src/lib/compartido/markdown.jsx`
- **Commits:** 5 (uno por función extraída)

### H7a — Vitest bloqueante (antes de H4)
- Reescribir `test_regresion_fase1.mjs` con schema Zod real (H-TEST-01, H-TEST-02).
- Tests reales de `riskEvaluator` (6 reglas con fixtures sintéticos).
- Tests reales de `consensusEngine` (incluye N18).
- Agregar `"test": "vitest run"` en `package.json` (H-TEST-03).
- **Commits:** 4

### H4 — Motor unificado (Opción A: gemelo separado)
- Extraer `scripts/engine/riskEvaluatorRunner.mjs` como gemelo documentado del frontend (H-MOTOR-01).
- **NO unificar con `src/engine/riskEvaluator.js`.** Esa unificación va a V3.0.
- **Commits:** 2

### H5 — N18 + H-SEG-01
- **N18:** fix de 1 línea en `consensusEngine.js` (`visibility` → `visibility_gfs_seamless`).
- **H-SEG-01:** documentar en docs (no tocar código).
- **Commits:** 2

### H7b — Vitest resto
- Tests de `repararMojibake`, `normalizarDatosRegionales`, `formatearTimestamp`, `parseNoaaStamp`.
- **Commits:** 2

### H8 — Zod activo
- Actualizar `estadoDiocesanoSchema.js` con `origen`, `ultimo_reporte_ondemand`, `bitacora`.
- Validar en `/api/sara.js` antes de responder.
- Validar en runner antes de `put()`.
- **Commits:** 3

### H9 — Cierre documental
- Actualizar `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `AUDITORIA_MOTOR.md`, handover.
- Tag git `etapa-3-cerrada`.
- **Commit:** `docs(etapa3): cierra etapa 3 y consolida backlog`

---

## 4. Decisiones tomadas (7 preguntas)

1. **Plan de 9 hitos / 25 commits:** ✅ Aprobado.
2. **H4 Opción A (gemelo separado):** ✅ Aprobado.
3. **H7a bloqueante para H4:** ✅ Aprobado.
4. **H-MOTOR-05 (sobreclasificación N2 en XIC/HUA/ZAC):** ✅ Fuera de Etapa 3. Va a V3.0 documentado.
5. **H-SEG-01 (`/api/sara` sin token):** ✅ Documentar como deuda V3.0. No tocar en Etapa 3.
6. **Eliminar `api/glm.js`:** ✅ Aprobado (H2b).
7. **Sin corridas en local:** ✅ Aprobado. Verificación funcional 100% en GitHub Actions. `node --check` y `npm run build` sí se usan (sintaxis, no corrida completa).

---

## 5. Metodología de verificación (H0–H9)

Cada commit sigue el ciclo:

1. **Editar** en VS Code.
2. **Verificar sintaxis:** `node --check <archivo>` (para `.js`/`.mjs`), `npm run build` (para `.jsx`).
3. **Verificar funcional:** en GitHub Actions (disparar workflow) o Vercel (deploy Ready).
4. **`git status`** para confirmar qué cambió.
5. **`git commit -m "tipo(área): descripción"`** (un commit por causa).
6. **`git push origin main`**.
7. **Verificar Vercel "Ready"** después del push.
8. **Verificar en producción** (si el cambio lo amerita).

**Formato de commit:** `tipo(área): descripción corta` (según `docs/00_METODOLOGIA.md`).

---

## 6. Criterios de aceptación globales

La Etapa 3 se considera cerrada cuando:

- [ ] Los 35 hallazgos están documentados en `09_HALLAZGOS_ETAPA3.md`.
- [ ] N26 cerrado: 1 corrida de GitHub Actions con `zonas_ok = 14/14`.
- [ ] `api/glm.js` eliminado.
- [ ] Parser SMN del runner sincronizado con `api/smn.js`.
- [ ] Fallback del frontend usa 14 nodos.
- [ ] Funciones duplicadas extraídas a `src/lib/compartido/`.
- [ ] Vitest instalado, `npm test` funciona, CI corre en push.
- [ ] `riskEvaluatorRunner.mjs` extraído.
- [ ] N18 fixeado en `consensusEngine.js`.
- [ ] Zod activo en `/api/sara` y en el runner.
- [ ] `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `AUDITORIA_MOTOR.md` y handover actualizados.
- [ ] Tag git `etapa-3-cerrada`.

---

## 7. Lo que NO se toca en Etapa 3 (Va a V3.0)

- **Autenticación real (JWT/sesiones).**
- **Vectores de riesgo faltantes** (temperatura, viento, convección, incendios).
- **Percentiles históricos** (30 años).
- **H-MOTOR-05** (sobreclasificación N2 en XIC/HUA/ZAC — requiere re-auditoría de 90 días).
- **H-SEG-01** (`/api/sara` sin token expone bitácora — requiere rediseño de contrato).
- **Causa raíz del mojibake** (N22/N27 — parche en lectura funciona).
- **H-MOTOR-01 completo** (unificación total del motor — en Etapa 3 solo gemelo separado).
- **H-UI-01/02/03** (Monitor no evalúa riesgo — decisión de diseño deliberada).
- **Panel histórico / nuevas vistas.**
- **Robot de monitoreo con cuenta Groq separada.**

---

**Fin del plan de Etapa 3.**

