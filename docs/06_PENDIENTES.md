# SatRC V2.0 — Backlog de Pendientes (Post-Etapa 3)

**Última actualización:** Octubre 2026 (Etapa 3 en curso, H0–H7a cerrados).
**Estado:** H0, H1, H2a, H2b, H2c, H3, H6, H7a cerrados. H4, H5, H7b, H8, H9 pendientes.

> Este documento lista lo que queda pendiente DESPUÉS de la Etapa 3.
> Lo que ya se cerró se documenta en `04_HISTORIAL_BUGS.md`.
> Lo que va a Versión 3.0 se marca explícitamente.

---

## 1. Etapa 3 — Pendiente inmediato

### H4 — Motor unificado (Opción A: gemelo separado)

- **Estado:** ✅ Cerrado en Etapa 3 (commits `a94324c` + `3e702f4`).
- **Alcance completado:**
  - Extraído `scripts/engine/riskEvaluatorRunner.mjs` como gemelo documentado del runner (H-MOTOR-01 parcial).
  - **NO unificado** con `src/engine/riskEvaluator.js`. Esa unificación va a V3.0.
- **Red de seguridad:** 3 tests nuevos (shape, zonaSinDatos, paridad funcional) + 36 tests de H7a = 39/39 passing.
- **Verificación en producción:** workflow `sara_cron.yml` con 14/14 zonas OK, `/api/sara` responde 200.

### H5 — N18 + H-SEG-01

- **Estado:** ⏳ Pendiente (después de H4).
- **Alcance:**
  - **N18:** fix de 1 línea en `consensusEngine.js` (`visibility` → `visibility_gfs_seamless`).
  - **H-SEG-01:** documentar en docs (no tocar código).

### H7b — Vitest resto

- **Estado:** ⏳ Pendiente (después de H5).
- **Alcance:**
  - Tests de `repararMojibake`, `normalizarDatosRegionales`, `formatearTimestamp`, `parseNoaaStamp`.
  - Tests de los 5 módulos compartidos en `src/lib/compartido/`.

### H8 — Zod activo

- **Estado:** ⏳ Pendiente (después de H7b).
- **Alcance:**
  - Actualizar `estadoDiocesanoSchema.js` con `origen`, `ultimo_reporte_ondemand`, `bitacora`.
  - Validar en `/api/sara.js` antes de responder.
  - Validar en runner antes de `put()`.

### H9 — Cierre documental

- **Estado:** ⏳ Pendiente (último hito).
- **Alcance:**
  - Actualizar `04_HISTORIAL_BUGS.md`, `06_PENDIENTES.md`, `AUDITORIA_MOTOR.md`, handover.
  - Tag git `etapa-3-cerrada`.

---

## 2. Deuda técnica aceptada (para Versión 3.0)

### N22/N27 — Causa raíz del mojibake

- **Estado:** ⏸️ Aceptado para V3.0.
- **Causa:** `@vercel/blob` en GitHub Actions guarda strings con doble encoding UTF-8.
- **Fix actual:** parche defensivo en lectura (`repararMojibake` + `repararObjeto`), ahora en `src/lib/compartido/mojibake.js` (H6.4).
- **Fix futuro (V3.0):** diagnosticar por qué `@vercel/blob` hace doble encoding y corregir el `put()` en el origen.

### H-MOTOR-05 — Sobreclasificación N2 en zonas húmedas

- **Estado:** ⏸️ Aceptado para V3.0.
- **Síntoma:** XIC (61.9%), HUA (52.4%), ZAC (45.2%) pasan más de la mitad del tiempo en N2 por saturación.
- **Causa:** umbral de 30mm para N2 demasiado bajo para zonas de 600+ mm en 90 días.
- **Fix futuro (V3.0):** re-auditoría de 90 días con umbrales calibrados por zona.

### H-SEG-01 — `/api/sara` sin token expone bitácora y evaluaciones

- **Estado:** ⏸️ Aceptado para V3.0.
- **Síntoma:** `GET /api/sara` sin `?forzar=true` devuelve `bitacora` y `evaluaciones` completas. Cualquiera puede consumirlo.
- **Fix futuro (V3.0):** rediseño de contrato con autenticación real (JWT/sesiones).

### H-MOTOR-01 (unificación total del motor)

- **Estado:** ⏸️ Aceptado para V3.0.
- **Nota:** en Etapa 3 se resuelve parcialmente (gemelo separado en H4). La unificación total (frontend + runner con un solo archivo) va a V3.0.

### H-DIAG-04 — Motor no calibrado para XIC/HUA/ZAC

- **Estado:** ⏸️ Aceptado para V3.0.
- **Nota:** es el mismo hallazgo que H-MOTOR-05, visto desde el diagnóstico. Requiere re-auditoría.

### H-MOTOR-03 — Reporte diario exige 216h, runner filtra 192h

- **Estado:** ⏸️ Aceptado para V3.0 (o H4b si se acepta).
- **Síntoma:** `reporteDiario.mjs` exige `serie >= 216h` para usar una zona. El runner ya filtró a `MIN_HORAS_REQUERIDAS = 192`. Una zona con 200h se descarta del reporte diario aunque el semáforo la haya usado.
- **Fix futuro:** ajustar el criterio a 216h coherente con 192h, o documentar la divergencia.

---

## 3. Roadmap Versión 3.0 (Sistema Experto)

> Estos ítems NO van en Etapa 3. Son features nuevas o requieren rediseño.

### Autenticación real

- **Estado:** ⏸️ V3.0.
- **Alcance:** reemplazar la clave hardcodeada (`emergencia` en `App.jsx`) y las claves de operador (`Antonio2026`, etc. en `api/reporte-ondemand.js`) por un sistema de login real (JWT/sesiones + base de datos de usuarios).

### Vectores de riesgo faltantes

- **Estado:** ⏸️ V3.0.
- **Alcance:**
  - **Temperatura:** olas de calor / heladas.
  - **Viento:** sistemas ciclónicos / nortes.
  - **Convección:** tormentas severas con GLM.
  - **Incendios:** índice de sequía + combustibilidad.

### Percentiles históricos

- **Estado:** ⏸️ V3.0.
- **Alcance:** calcular umbrales dinámicos basados en los últimos 30 años (no números estáticos como 65mm de saturación). Requiere re-auditoría completa.

### H-UI-01/02/03 — Monitor Público evalúa riesgo

- **Estado:** ⏸️ V3.0 (decisión de diseño).
- **Alcance:** decidir si el Monitor Público debe mostrar el semáforo N1-N4 de cada localidad, o si sigue siendo solo pronóstico + reporte vigente.

### Panel histórico / nuevas vistas

- **Estado:** ⏸️ V3.0 (feature nueva).
- **Alcance:** vista que lea del Blob el histórico de bitácora + reportes y grafique evolución.

### Robot de monitoreo con cuenta Groq separada

- **Estado:** ⏸️ V3.0 (feature nueva).
- **Alcance:** workflow que evalúe el estado cada 3h usando una API Key de Groq distinta para no saturar la cuenta principal.

### H-UI-13/14/22 — Mejoras de UI

- **Estado:** ⏸️ V3.0.
- **Alcance:**
  - H-UI-13: banner SMN con auto-refresh.
  - H-UI-14: banner SMN con fallback si `/api/smn` falla.
  - H-UI-22: corregir disclaimer (menciona ECMWF que no se usa) + gráfico de temperatura (duplica línea).

### H-INFRA-01 — `vercel.json` explícito

- **Estado:** ⏸️ V3.0.
- **Alcance:** agregar `vercel.json` con configuración explícita (región, memoria, timeout) en vez de depender de autodetección.

### H-UI-07/09/11/19/23 — Mejoras cosméticas

- **Estado:** ⏸️ V3.0.
- **Alcance:**
  - H-UI-07: guard de contenido en secciones I-VI.
  - H-UI-09: `TextoEnriquecido` con markdown completo.
  - H-UI-11: print CSS del modal operativo.
  - H-UI-19: `parseNoaaStamp` con validación de rangos.
  - H-UI-23: eliminar código muerto en `DisclaimerModal`.

### H-API-02/05 — Mejoras de backend

- **Estado:** ⏸️ V3.0.
- **Alcance:**
  - H-API-02: `disparar-workflow.js` con log de IP/UA.
  - H-API-05: `latest-gif.js` con fallback si NOAA cambia el patrón.

### H-NOM-01 — `procesar_datos.cjs` escribe `version: "3.0"`

- **Estado:** ⏸️ V3.0.
- **Alcance:** cambiar a `"2.0"` o `"2.1"` (confunde con "Etapa 3 ≠ V3.0").

---

## 4. Estado de la Etapa 3 (resumen)

### Cerrados ✅

| Hito | Descripción |
|---|---|
| H0 | Docs: línea base + 35 hallazgos |
| H1 | N26: lotes de 4 en runner |
| H2a | Parser SMN del runner |
| H2b | Eliminar `api/glm.js` |
| H2c | Fix lluvia efectiva solo a estados afectados |
| H3 | Fallback frontend con 14 nodos |
| H6 | DRY (5 módulos compartidos, 14 copias eliminadas) |
| H7a | Vitest bloqueante (36 tests, CI en GitHub Actions) |

### Pendientes ⏳

| Hito | Descripción |
|---|---|
| H4 | Motor unificado (gemelo separado) |
| H5 | N18 + H-SEG-01 |
| H7b | Vitest resto |
| H8 | Zod activo |
| H9 | Cierre documental |

---

## 5. Reglas para agregar pendientes

1. **Todo bug nuevo va a `04_HISTORIAL_BUGS.md`, no acá.** Este documento es para pendientes de implementación.
2. **Cada ítem debe tener:** estado, alcance, prioridad (alta/media/baja), y si va a Etapa 3 o V3.0.
3. **Si se cierra un ítem, se borra de acá y se documenta en `04_HISTORIAL_BUGS.md`.**

---

**Fin del backlog.**