# SatRC V2.0 — Traspaso de Sesión 22/10/2026

**Propósito:** este documento permite arrancar el próximo chat con contexto completo.

**Estado del repo al cierre de esta sesión:**

- HEAD: `2b86e47` (tests H6.7 con fixture real).
- Tag activo: `etapa-4-cerrada` (en `29009fe`).
- Tests: 123/123 passing.
- CI: en verde.

---

## 1. Estado del proyecto

### Etapa 3 — Cerrada (baseline de producción)

- Motor hidrológico de 6 reglas.
- 14 nodos regionales.
- Bitácora SHA-256.
- Zod activo.
- 79 tests originales.

### Etapa 4 — Cerrada a nivel funcional (H6.1–H6.7)

- **H6.1:** `meteoFetcher.js` extendido con 8 variables E4.
- **H6.2:** `consultarZonaUnaVez` del runner extendido idem.
- **H6.3:** `consensusEngine.js` consensúa las 8 variables E4 (mediana + max + gfs_preferente).
- **H6.4a:** `windEvaluator.js` con umbral dinámico por altitud + clamp de `nivelContinuo`. `mapearANivel` alineado.
- **H6.4+H6.5:** `evaluarMultiamenaza` conectado al runner. Zod extendido con 5 campos opcionales.
- **H6.7:** Fixture real de Open-Meteo + 7 tests nuevos con datos reales.

**Total tests:** 123/123.

### Producción (al cierre)

- `/api/sara` → `VERCEL_BLOB_ACTUALIZADO`.
- Semáforo real sobre 405 localidades.
- Runner corriendo sin errores.
- Semáforo actual: variable según clima (N4 entre 4 y 11, N3 entre 1 y 33).

---

## 2. Commits relevantes de la sesión

```text
2b86e47 test(engine): corrige tests H6.7 con conversion array-consenso a objeto-evaluadores
6fdc414 test(engine): agrega fixture real de Open-Meteo para tests E4 (H6.7)
8d3701d docs(etapa4): actualiza handover con cierre de H6
29009fe (tag: etapa-4-cerrada) docs(etapa4): cierra H6
caae110 feat(runner): conecta orquestador multiamenaza al runner con adaptador de shape (H6.4+H6.5-E4)
74504c2 fix(engine): calibra windEvaluator y mapearANivel para eliminar falsos positivos N2 en Pachuca (H6.4a)
91d0f4c feat(engine): consensua las 8 variables E4 y agrega scripts de verificacion (H6.3-E4)
1cd4bbe feat(runner): extiende consultarZonaUnaVez con las 8 variables E4 (H6.2-E4)
43c1024 feat(engine): extiende meteoFetcher con las 8 variables E4 (H6.1-E4)
b8f34f0 docs(etapa4): actualiza H-E4-01 con hallazgo empirico nivel 2
8563829 docs(etapa4): cierra H-ORQ-01 y registra deuda H-E4-01 para H6
29230c1 fix(engine): ajusta asercion del Test 1 del orquestador al rango N1 continuo (H5-E4)
```

---

## 3. Deudas pendientes (post-Etapa 4)

### 🟡 H6.6 — Frontend no consume campos nuevos

- **Síntoma:** `SatRCOperativo.jsx` lee `nivel_alerta` pero ignora `nivel_alerta_global`, `niveles_por_vector`, `acciones_operativas`, `diagnosticos_por_vector`.
- **Impacto:** el operador no ve el desglose multiamenaza. Los N4 por helada o downburst se muestran sin justificación física.
- **Trabajo:** 2-3h. Modificar el modal de auditoría de `SatRCOperativo.jsx` para mostrar los 4 vectores y el acoplamiento.

### 🟡 H7 — Prompts SARA no adaptados a multiamenaza

- **Síntoma:** SARA redacta N4 por viento con lenguaje hidrológico ("lluvias torrenciales").
- **Impacto:** confusión en los reportes.
- **Trabajo:** 1-2h. Adaptar prompts de `api/reporte-ondemand.js` y `scripts/reportes/reporteDiario.mjs`.

### 🟠 H-ARCH-01 — Pipeline no extensible (documentado en `06_PENDIENTES.md`)

- **Síntoma:** agregar un 5to evaluador requiere tocar 7 archivos en 7 lugares distintos.
- **Impacto:** costo alto por evaluador nuevo.
- **Fix propuesto (V3.0):** registry declarativo en `src/engine/registry.js`. Agregar un evaluador = agregar entrada a registry + archivo del evaluador.

### 🟡 H-TEST-06 — Tests nuevos deben verificar aritmética del escenario

- **Lección:** el test 10 de `windEvaluator` falló por asumir N2 cuando el escenario daba N3.
- **Aplicable:** futuros tests.

### 🟡 H-TEST-07 — Módulos que emiten continuos deben documentar rango [min, max]

- **Lección:** el clamp del `windEvaluator` no era suficiente. `mapearANivel` tenía umbrales desalineados.
- **Aplicable:** futuros módulos.

---

## 4. Metodología de verificación empírica (lección de la sesión)

**Regla no escrita pero aplicada:** antes de codificar contra una API externa (Open-Meteo, NOAA, SMN, Groq), verificar con `Invoke-RestMethod` / `Invoke-WebRequest` desde PowerShell:

1. **Que la API responde** (HTTP 200).
2. **Que las variables pedidas existen** en el JSON devuelto.
3. **Que devuelven datos no-null** (no todos los campos son null).

**Hallazgo clave de esta sesión:** Open-Meteo devuelve las variables E4 con sufijo `_modelo` cuando se piden múltiples modelos. Sin verificar, el pipeline habría fallado silenciosamente.

**Herramientas creadas:**

- `scripts/diagnostico/verificar_variables_e4.ps1` (nivel 1).
- `scripts/diagnostico/verificar_variables_e4_nivel2.ps1` (nivel 2, variantes de consulta).
- `scripts/diagnostico/auditoria_h6_4.mjs` (comparación baseline vs orquestador, one-shot).
- `scripts/diagnostico/generar_fixture_openmeteo.ps1` (fixture real para tests).

**Documentado en:** `06_PENDIENTES.md` como `H-E4-01`.

---

## 5. Archivos clave que el próximo dev debe conocer

### Documentación fundacional

- `docs/00_METODOLOGIA.md` — reglas de oro.
- `docs/10_HANDOVER.md` — estado actual del sistema.
- `docs/06_PENDIENTES.md` — deudas y roadmap V3.0.

### Código del orquestador

- `src/engine/crossThreatOrchestrator.js` — orquestador (250+ líneas).
- `src/engine/windEvaluator.js` — viento con umbral dinámico.
- `src/engine/thermalEvaluator.js` — térmico con sigmoides.
- `src/engine/convectiveEvaluator.js` — convectivo con CAPE.
- `src/engine/hydroAdapter.js` — adaptador hidrológico.
- `src/engine/consensusEngine.js` — consensúa las 8 variables E4.
- `src/engine/meteoFetcher.js` — pide las 15 variables a Open-Meteo.

### Schemas y runner

- `src/schemas/estadoDiocesanoSchema.js` — Zod extendido.
- `scripts/ejecutar_sara_autonomo.mjs` — runner autónomo.

### Tests

- `src/engine/__tests__/crossThreatOrchestrator.test.js` — 8 tests.
- `src/engine/__tests__/windEvaluator.test.js` — 11 tests.
- `src/engine/__tests__/thermalEvaluator.test.js` — 8 tests.
- `src/engine/__tests__/convectiveEvaluator.test.js` — 8 tests.
- `src/engine/__tests__/consensusEngine.test.js` — 16 tests.
- `src/engine/__tests__/hydroAdapter.test.js` — 6 tests.
- `src/engine/__tests__/fixtures/openmeteo_sample.json` — fixture real.

### Frontend

- `src/views/SatRCOperativo.jsx` — sala operativa (para H6.6).
- `src/views/MonitorPublico.jsx` — monitor público.

---

## 6. Próximos pasos sugeridos (en orden de prioridad)

### Sesión 1 (próximo chat) — H6.6: Frontend consume multiamenaza

- **Trabajo:** 2-3h.
- **Riesgo:** bajo.
- **Valor:** el operador ve el desglose físico de cada N4/N3.
- **Precondición:** leer `SatRCOperativo.jsx`, `estadoDiocesanoSchema.js`, y el modal de auditoría.

### Sesión 2 — H7: Prompts SARA multiamenaza

- **Trabajo:** 1-2h.
- **Riesgo:** bajo.
- **Valor:** SARA describe correctamente N4 por viento, helada, granizo.

### Sesión 3 — H-ARCH-01: Refactor de extensibilidad (V3.0)

- **Trabajo:** 4-6h.
- **Riesgo:** medio.
- **Valor:** agregar un 5to evaluador requiere 2 archivos (registry + evaluador), no 7.

### Sesión 4 — V3.0: Autenticación real, percentiles históricos, vectores faltantes

---

## 7. Cómo arrancar el próximo chat

**Mensaje inicial sugerido:**

> "Retomamos SatRC V2.0 post-Etapa 4. El repo está en el commit `2b86e47` con 123/123 tests en verde. Te paso el `docs/HANDOVER_SESION_2026-10-22.md` y los archivos que necesito para [H6.6 / H7 / H-ARCH-01 / V3.0]."

**Archivos a pasar al inicio:**

- `docs/HANDOVER_SESION_2026-10-22.md`
- `docs/10_HANDOVER.md`
- `docs/06_PENDIENTES.md`
- Y los archivos específicos del hito a trabajar (ej. `SatRCOperativo.jsx` para H6.6).