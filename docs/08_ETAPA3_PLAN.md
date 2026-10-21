# SatRC V2.0 — Plan de Etapa 3 (Deuda Técnica)

**Fecha de inicio:** Octubre 2026
**Estado:** En curso (H0–H3, H6, H7a cerrados; H4, H5, H7b, H8, H9 pendientes)
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

### Producción (al inicio)

- Endpoint `/api/sara`: `origen = VERCEL_BLOB_ACTUALIZADO`.
- Semáforo: N4=19, N3=51, N2=203, N1=132 (total 405).
- Título del dictamen: "Emergencia por Lluvias Torrenciales en la Región".
- Endpoint `/api/smn`: `activo=true, nivel=3, titulo="Lluvias Torrenciales en la Región"`.
- Hora servidor México: 12:00 p.m.

### Producción (actual, tras H0–H6)

- Semáforo: N4=4, N3=24, N2=249, N1=128.
- Bitácora: 181 entradas.
- Título: "Emergencia por Lluvias Torrenciales en la Región" (sin mojibake).

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
- Implicación: no se puede correr el runner completo en local. **Decisión de Etapa 3: la verificación funcional es 100% en GitHub Actions.** `node --check` y `npm run build` sí se usan (sintaxis, no corrida completa).

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

## 3. Roadmap de Etapa 3 (9 hitos, 25 commits) — Estado actual

### H0 — Documentación de línea base — ✅ COMPLETO
- Creados `docs/08_ETAPA3_PLAN.md` y `docs/09_HALLAZGOS_ETAPA3.md`.
- **Commit:** `ca1bb21` — `docs(etapa3): linea base, nomenclatura y 35 hallazgos`.

### H1 — Cerrar N26 (cobertura del runner) — ✅ COMPLETO
- Refactor `cargarSeriesRegionales()` en `scripts/ejecutar_sara_autonomo.mjs`: lotes de 4 en vuelo, `Promise.allSettled(lote)`, delay de 500ms entre lotes.
- **Verificación:** corrida `39067735652` con `14/14 zonas OK en 2.7s`.
- **Commits:**
  1. `3ee8253` — `fix(runner): aplica lotes de 4 en cargarSeriesRegionales (N26)`.
  2. `da696cc` — `fix(runner): restaura repararMojibake eliminada por error en 3ee8253`.
  3. `2f8fd22` — `docs(runner): cierra N26 en historial de bugs`.

### H2 — Limpieza de backend — ✅ COMPLETO
- **H2a:** Parser SMN del runner sincronizado con `api/smn.js` (H-MOTOR-02). Commit `2cb3231` + docs `c89a7ac`.
- **H2b:** Eliminado `api/glm.js` (H-API-07, H-API-08, H-API-09). Commit `840c671` + docs `107834b`.
- **H2c:** Fix H-MOTOR-06 (lluvia efectiva solo a estados afectados). Commit `12375d0` + docs `df3f7ad`.

### H3 — Fallback del frontend con 14 nodos — ✅ COMPLETO
- `SatRCOperativo.jsx` → `ejecutarEvaluacionRealEnVivo` usa los 14 nodos (H-MOTOR-04).
- **Commit:** `9a05052` + docs `b7c037f`.

### H6 — DRY (extraer duplicados) — ✅ COMPLETO
- 5 módulos compartidos creados en `src/lib/compartido/`:
  - **H6.1:** `formatearTimestamp` → `fechas.js` (commit `742ead5`).
  - **H6.2:** `TextoEnriquecido` → `markdown.jsx` (commit `<hash>`).
  - **H6.3:** `seleccionarNodosRegionales` → `nodos.js` (commit `e81da8d`).
  - **H6.4:** `repararMojibake` + `repararObjeto` → `mojibake.js` (5 commits atómicos: `39049be`, `9d9dd40`, `<hash>`, `<hash>`, `<hash>`).
  - **H6.5:** `normalizarDatosRegionales` + `construirBloqueRegional` → `regionales.js` (commit `<hash>`).
- **14 copias eliminadas. 7 funciones en 5 módulos.**
- **Documentación:** H-FUNC-01 cerrado en `04_HISTORIAL_BUGS.md`.

### H7a — Vitest bloqueante (antes de H4) — ✅ COMPLETO

- **H7a.1:** Vitest instalado + `"test": "vitest run"` en `package.json`. Commit `338cc4d`.
- **H7a.2:** `consensusEngine.test.js` (12 tests, fetch mockeado). Commit `d8b59bf`.
- **H7a.3:** `regresionFase1.test.js` (8 tests, Zod real). Commit `734a77b`.
- **H7a.4:** `riskEvaluator.test.js` (16 tests: 6 reglas + N18 + H-MOTOR-06 + prioridad entre reglas). Commit `ac5c9ef`.
- **H7a.6:** CI en `.github/workflows/tests.yml`. Commit `4bfd241`.
- **H7a.7:** Eliminados los 4 `.mjs` viejos. Commit `4339cd5`.
- **H7a.8:** Documentación de cierre (en curso).
- **Verificación:** 36 tests pasan en local. CI pasa en GitHub Actions (run `39467968964`).
- **Descubrimiento:** el test de prioridad documentó que **Regla 4 (inundación) sobreescribe el diagnóstico de Regla 2 (deslave)** cuando ambas dan N4 (por el `>=`). Ahora está en `03_MOTOR_RIESGO.md` sección 3.
- **Documentación:** H-TEST-04 cerrado en `04_HISTORIAL_BUGS.md`.

### H4 — Motor unificado (Opción A: gemelo separado) — ✅ COMPLETO
- Extraído `scripts/engine/riskEvaluatorRunner.mjs` como gemelo documentado del runner (H-MOTOR-01 parcial).
- **NO unificado** con `src/engine/riskEvaluator.js`. Esa unificación va a V3.0.
- 3 tests nuevos del gemelo (shape, zonaSinDatos, paridad funcional con frontend).
- **Commits:** `a94324c` (H4.1 gemelo + tests), `3e702f4` (H4.2 integración + docs).
- **Verificación:** `npm test` 39/39 passing, workflow `sara_cron.yml` con 14/14 zonas OK, `/api/sara` responde 200 con shape del gemelo.

### H5 — N18 + H-SEG-01 — ✅ COMPLETO
- **N18:** ✅ Resuelto en H7a.2 (el código ya leía `visibility_gfs_seamless` desde H7a.2, pero nadie lo documentó). Se agregó un test de blindaje del fallback triple (`_gfs_seamless` → `visibility` → 10000m) en H5.1.
- **H-SEG-01:** ⏸️ Diferido a V3.0. Documentado como deuda aceptada.
- **Commits:** `6becdf9` (H5.1 test de blindaje), `de1801c` (H5.2 cierre documental).
- **Verificación:** `npm test` 40/40 passing (39 + 1 nuevo test de fallback).

### H7b — Vitest resto — ✅ COMPLETO
- Tests de `repararMojibake`, `normalizarDatosRegionales`, `formatearTimestamp`.
- Extracción de `parseNoaaStamp` a `src/lib/compartido/noaa.js` + tests (H-UI-19).
- Refactorización de `api/latest-gif.js` para usar `parseNoaaStamp` (validación de rangos).
- **Commits:** `4c23f52` (H7b.1 tests compartidos), `54f00d0` (H7b.2 extracción NOAA + docs).
- **Verificación:** `npm test` 72/72 passing (60 + 12 nuevos).

### H8 — Zod activo — ✅ COMPLETO
- Schema dividido en `EstadoDiocesanoBlobSchema` (runner) y `EstadoDiocesanoResponseSchema` (API).
- Validación activa en `/api/sara.js` (camino del Blob; fallback en vivo queda libre).
- Validación activa en el runner (`ejecutar_sara_autonomo.mjs`) antes de `put()`. Si el paquete está corrupto, aborta el proceso (código 1).
- La validación del reporte diario (`reporteDiario.mjs`) se difiere a V3.0 (su contrato es distinto al del estado).
- 7 tests nuevos para los schemas.
- **Commits:** `af82f44` (H8.1), `bd5ca6d` (H8.2), `c168385` (H8.3 + docs).
- **Verificación:** `npm test` 79/79 passing, workflow `sara_cron.yml` con 14/14 zonas OK, `/api/sara` 200.

### H9 — Cierre documental — ⏳ PENDIENTE
- Actualizar `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `AUDITORIA_MOTOR.md`, handover.
- Tag git `etapa-3-cerrada`.
- **Commit:** `docs(etapa3): cierra etapa 3 y consolida backlog`.

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

- [x] Los 35 hallazgos están documentados en `09_HALLAZGOS_ETAPA3.md`.
- [x] N26 cerrado: corrida `39067735652` con `14/14 zonas OK`.
- [x] `api/glm.js` eliminado.
- [x] Parser SMN del runner sincronizado con `api/smn.js`.
- [x] Fallback del frontend usa 14 nodos.
- [x] Funciones duplicadas extraídas a `src/lib/compartido/`.
- [x] Vitest instalado, `npm test` funciona, CI corre en push. (H7a — 36 tests pasan)
- [ ] `riskEvaluatorRunner.mjs` extraído. (H4)
- [ ] N18 fixeado en `consensusEngine.js`. (H5)
- [ ] Zod activo en `/api/sara` y en el runner. (H8)
- [ ] `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `AUDITORIA_MOTOR.md` y handover actualizados. (H9)
- [ ] Tag git `etapa-3-cerrada`. (H9)

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