# SatRC V2.0 — Plan de Etapa 3 (Deuda Técnica)

**Fecha de inicio:** Octubre 2026
**Fecha de cierre:** Octubre 2026
**Estado:** ✅ FINALIZADA (H0–H9 completados y verificados en producción)
**Objetivo rector:** Cerrar deuda técnica, establecimiento de tests y documentación. **NO agregar features nuevas.**

> ⚠️ **Etapa 3 ≠ Versión 3.0.** La Etapa 3 fue el trabajo de deuda técnica.
> La Versión 3.0 será un salto mayor (nuevos vectores de riesgo, autenticación real, percentiles históricos).
> Lo que sea V3.0 va al roadmap documentado en `06_PENDIENTES.md`.

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
- Endpoint `/api/smn`: `activo=true, nivel=3, titulo="Lluvias Tormentosas en la Región"`.
- Hora servidor México: 12:00 p.m.

### Producción (al cierre)

- Validación estricta con Zod (Blob/Response).
- Tests: 79 passing (CI en GitHub Actions).
- Semáforo dinámico según clima en vivo (ej. N4=4, N3=17, N2=146, N1=238).
- Dictamen reparado de mojibake y con validación Zod.

### Infraestructura

- **NO hay `vercel.json`.** Deploy por autodetección de Vercel.
- **NO hay `.env` en raíz.** Solo `.env.local`.
- `.github/workflows/`: `sara_cron.yml` y `tests.yml`.
- `public/`: `favicon.svg`, `icon.svg`, `icons.svg`.

### Variables de entorno en PowerShell del dev

- **Ninguna cargada.**
- Implicación: verificación funcional 100% en GitHub Actions. `node --check` y `npm run build` se usaron para sintaxis.

---

## 2. Nomenclatura (crítico para no confundir)

| Término | Significado |
|---|---|
| **Etapa 3** | Trabajo de deuda técnica finalizado (Oct 2026). |
| **Versión 3.0** | Salto mayor futuro (nuevos vectores, auth real, percentiles). |
| **satrc-v2** | Nombre del repositorio GitHub (histórico). |
| **satrc-v3** | Nombre de la carpeta local (por la Etapa 3). |
| **V2.0** | Versión actual de la aplicación (UI). |

---

## 3. Roadmap de Etapa 3 (9 hitos) — Estado final

### H0 — Documentación de línea base — ✅ COMPLETO
- Creados `08_ETAPA3_PLAN.md` y `09_HALLAZGOS_ETAPA3.md`.
- **Commit:** `ca1bb21`.

### H1 — Cerrar N26 (cobertura del runner) — ✅ COMPLETO
- Refactor `cargarSeriesRegionales()` con lotes de 4.
- **Verificación:** corrida `39067735652` con `14/14 zonas OK`.
- **Commits:** `3ee8253`, `da696cc`, `2f8fd22`.

### H2 — Limpieza de backend — ✅ COMPLETO
- **H2a:** Parser SMN (H-MOTOR-02). Commits `2cb3231`, `c89a7ac`.
- **H2b:** Eliminado `api/glm.js` (H-API-07/08/09). Commits `840c671`, `107834b`.
- **H2c:** Fix H-MOTOR-06 (piso SMN por estado). Commits `12375d0`, `df3f7ad`.

### H3 — Fallback del frontend con 14 nodos — ✅ COMPLETO
- `SatRCOperativo.jsx` usa 14 nodos (H-MOTOR-04).
- **Commit:** `9a05052` + docs `b7c037f`.

### H4 — Motor unificado (Gemelo) — ✅ COMPLETO
- Extraído `scripts/engine/riskEvaluatorRunner.mjs` (H-MOTOR-01 parcial).
- **Commits:** `a94324c` (H4.1), `3e702f4` (H4.2).
- **Verificación:** 39/39 tests, 14/14 zonas OK.

### H5 — N18 + H-SEG-01 — ✅ COMPLETO
- **N18:** Blindado con test de fallback triple.
- **H-SEG-01:** Diferido a V3.0.
- **Commits:** `6becdf9` (H5.1), `de1801c` (H5.2).
- **Verificación:** 40/40 tests.

### H6 — DRY (extraer duplicados) — ✅ COMPLETO
- 5 módulos compartidos (`fechas.js`, `markdown.jsx`, `nodos.js`, `mojibake.js`, `regionales.js`).
- **14 copias eliminadas.**
- **Documentación:** H-FUNC-01 cerrado.

### H7a — Vitest bloqueante — ✅ COMPLETO
- 36 tests iniciales (consensus, risk, regresión).
- **CI en GitHub Actions** (`tests.yml`).
- **Documentación:** H-TEST-04 cerrado.

### H7b — Vitest resto + NOAA — ✅ COMPLETO
- 32 tests nuevos (mojibake, fechas, regionales, NOAA).
- Extracción de `parseNoaaStamp` a `noaa.js` (H-UI-19).
- **Commits:** `4c23f52` (H7b.1), `54f00d0` (H7b.2).
- **Verificación:** 72/72 tests.

### H8 — Zod activo — ✅ COMPLETO
- Doble schema Zod (`EstadoDiocesanoBlobSchema` y `EstadoDiocesanoResponseSchema`).
- Validación en `/api/sara.js` y `ejecutar_sara_autonomo.mjs`.
- **Hotfixes H8.4 y H8.5:** Ajustes de hora y `max_completion_tokens` en Groq.
- **Commits:** `af82f44`, `bd5ca6d`, `c168385`, `862a446`, `e3cff05`.
- **Verificación:** 79/79 tests, API responde `VERCEL_BLOB_ACTUALIZADO`.

### H9 — Cierre documental — ✅ COMPLETO
- Actualizados `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `10_HANDOVER.md` y `08_ETAPA3_PLAN.md`.
- Creado el tag git `etapa-3-cerrada`.
- **Commit:** `<hash-commit-H9>`.

---

## 4. Decisiones tomadas (7 preguntas)

1. **Plan de 9 hitos:** ✅ Aprobado.
2. **H4 Opción A (gemelo separado):** ✅ Aprobado.
3. **H7a bloqueante para H4:** ✅ Aprobado.
4. **H-MOTOR-05 (sobreclasificación N2):** ✅ Fuera de Etapa 3. Va a V3.0.
5. **H-SEG-01 (`/api/sara` sin token):** ✅ Documentar como deuda V3.0.
6. **Eliminar `api/glm.js`:** ✅ Aprobado (H2b).
7. **Sin corridas en local:** ✅ Aprobado (verificación en GitHub Actions).

---

## 5. Metodología de verificación (H0–H9)

Cada commit siguió el ciclo:

1. **Editar** en VS Code.
2. **Verificar sintaxis:** `node --check` y `npm run build`.
3. **Verificar funcional:** en GitHub Actions o Vercel.
4. **`git status`** para confirmar cambios.
5. **`git commit -m "tipo(área): descripción"`**.
6. **`git push origin main`**.
7. **Verificar Vercel "Ready"**.
8. **Verificar en producción**.

**Formato de commit:** `tipo(área): descripción corta`.

---

## 6. Criterios de aceptación globales

La Etapa 3 se considera cerrada (100% completado):

- [x] Los 35 hallazgos están documentados en `09_HALLAZGOS_ETAPA3.md`.
- [x] N26 cerrado: corrida con `14/14 zonas OK`.
- [x] `api/glm.js` eliminado.
- [x] Parser SMN del runner sincronizado con `api/smn.js`.
- [x] Fallback del frontend usa 14 nodos.
- [x] Funciones duplicadas extraídas a `src/lib/compartido/`.
- [x] Vitest instalado, `npm test` funciona, CI corre en push (79 tests).
- [x] `riskEvaluatorRunner.mjs` extraído (H4).
- [x] N18 blindado en `consensusEngine.js` (H5).
- [x] Zod activo en `/api/sara` y en el runner (H8).
- [x] `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `AUDITORIA_MOTOR.md` y handover actualizados.
- [x] Tag git `etapa-3-cerrada` (H9).

---

## 7. Lo que NO se toca en Etapa 3 (Va a V3.0)

- **Autenticación real (JWT/sesiones).**
- **Vectores de riesgo faltantes** (temperatura, viento, convección, incendios).
- **Percentiles históricos** (30 años).
- **H-MOTOR-05** (sobreclasificación N2 en XIC/HUA/ZAC).
- **H-SEG-01** (`/api/sara` sin token expone bitácora).
- **Causa raíz del mojibake** (N22/N27).
- **H-MOTOR-01 completo** (unificación total del motor).
- **H-UI-01/02/03** (Monitor no evalúa riesgo).
- **Panel histórico / nuevas vistas.**
- **Robot de monitoreo con cuenta Groq separada.**

---

**Fin del plan de Etapa 3.**