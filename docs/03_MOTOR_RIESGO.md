# SatRC V2.0 — Motor de Evaluación de Riesgo (Nivel Ingeniería)

> **Versión:** 2.3.0 (Cierre de Etapa 4)
> **Última actualización:** 22 de octubre de 2026.
> **Nota:** este documento detalla el **motor hidrológico canónico** (Etapa 3) y hace de puente hacia el **motor multiamenaza** (Etapa 4). El detalle de los 4 evaluadores de Etapa 4 está en `08_MOTOR_MULTIAMENAZA.md`.
> Cualquier modificación al motor requiere pruebas empíricas y debe pasar la suite de tests (`npm test`, 123 tests).

## Índice

1. [El Runner Autónomo](#1-el-runner-autónomo)
2. [Las 6 reglas de evaluación (motor hidrológico)](#2-las-6-reglas-de-evaluación-motor-hidrológico)
3. [Prioridad entre reglas](#3-prioridad-entre-reglas)
4. [Cálculo de la saturación (API)](#4-cálculo-de-la-saturación-api)
5. [Aplicación del aviso SMN (H-MOTOR-06)](#5-aplicación-del-aviso-smn-h-motor-06)
6. [El Gemelo del Runner (H4)](#6-el-gemelo-del-runner-h4)
7. [Motor Multiamenaza (Etapa 4)](#7-motor-multiamenaza-etapa-4)

---

## 1. El Runner Autónomo

**Archivo:** `scripts/ejecutar_sara_autonomo.mjs`

El runner es el corazón del sistema. Corre en GitHub Actions (Node.js 22).

### 1.1 Flujo de ejecución (estado actual, Etapa 4)

1. **Aviso SMN:** consulta `https://smn.conagua.gob.mx/es/` buscando "torrenciales", "hidalgo", etc. Si hay aviso, eleva la `lluvia_efectiva` mínima para las zonas de Sierra (solo si el estado de la localidad está en el aviso).
2. **Nodos regionales:** la función `seleccionarNodosRegionales()` (importada de `src/lib/compartido/nodos.js`) agrupa las 405 localidades por `zona_id` y selecciona como nodo la de mayor `vulnerabilidad.poblacion`.
3. **Fetch en paralelo (lotes de 4):** `cargarSeriesRegionales()` usa lotes de 4 peticiones concurrentes con un delay de 500 ms entre lotes. Si falla una zona, reintenta 2 veces con 3 s de espera. *(N26 resuelto)*. **Desde H6.1/H6.2, cada fetch pide 15 variables (7 hidrológicas + 8 E4).**
4. **Consenso:** `generarConsensoDeterminista()` se aplica a cada zona. **Desde H6.3, consensúa también las 8 variables E4.**
5. **Evaluación:** **desde H6.4, el runner usa `evaluarMultiamenaza`** (orquestador de Etapa 4), que combina 4 evaluadores + acoplamiento de Richardson. El detalle está en la Sección 7 y en `08_MOTOR_MULTIAMENAZA.md`. Si el orquestador falla para una localidad puntual, el runner tiene un fallback al motor hidrológico viejo (`evaluarLocalidadRunner`).
6. **Publicación:** se valida el `paqueteMaestro` con Zod (H8 + H6.5) y se guarda en Vercel Blob (`estado_diocesano.json` y `bitacora_sara.json`).

### 1.2 El bug original (el nodo único)

El código anterior a Octubre 2026 usaba solo el nodo de Huauchinango para evaluar las 405 localidades. Esto causaba que localidades secas del Altiplano (ej. Actopan) se reportaran como N2 por lluvias que solo ocurrían en la Sierra. **ADR-001** corrigió esto usando los 14 nodos.

---

## 2. Las 6 reglas de evaluación (motor hidrológico)

**Archivo canónico (Frontend):** `src/engine/riskEvaluator.js`

**Archivo gemelo (Runner):** `scripts/engine/riskEvaluatorRunner.mjs`

La función `evaluarLocalidad(localidad, serieHoraria, contexto)` aplica estas reglas **en orden**:

| # | Regla | Resultado |
|---|---|---|
| 1 | Protección Altiplano | N1 |
| 2 | Deslave crítico | N4 |
| 3 | Deslave moderado | N3 |
| 4 | Inundación fluvial | N4 / N3 |
| 5 | Corte vial | N3 |
| 6 | Vigilancia | N2 |

### Regla 1 — Protección Altiplano (N1)

**Aplica a:** `ACT`, `APN`, `PMN`, `PMS`, `TIZ`.

Si se cumplen **todas** estas condiciones → **N1**:

- Terreno plano (`pendiente_max_deg < 15`).
- Lluvia < 20 mm.
- Temperatura > 2 °C.
- Viento < 40 km/h.

### Regla 2 — Deslave crítico (N4)

**Aplica a:** zonas de Sierra.

Si `pendiente >= 45°` **y** `saturacion_total >= 65.0 mm` → **N4**.

> **Física:** a 45°, el suelo falla geométricamente si está saturado.

### Regla 3 — Deslave moderado (N3)

Si `pendiente >= 25°` (pero `< 45°`) **y** `saturacion_total >= 65.0 mm` → **N3**.

### Regla 4 — Inundación fluvial (N4 / N3)

Condiciones de entrada (**todas**):

- `dist_cauce_km <= 0.8`
- `TWI >= 12`
- `lluvia_efectiva >= 35 mm`

Resultado:

- Si `lluvia >= 65 mm` **o** `poblacion_aguas_arriba >= 50000` → **N4**.
- Si no → **N3**.

### Regla 5 — Corte vial (N3)

Si `acceso` es `CAMINO_TERRACERIA` o `BRECHA` **y** (`lluvia >= 20 mm` **o** `saturacion >= 50 mm`) → **N3**.

### Regla 6 — Vigilancia (N2)

Si se cumple **cualquiera** → **N2**:

- `lluvia >= 8 mm`.
- `saturacion >= 30 mm`.
- `visibilidad <= 2 km` (niebla). *(Nota: lee `visibility_gfs_seamless` desde H7a.2, blindado en H5).*

---

## 3. Prioridad entre reglas

Cuando una localidad dispara más de una regla al mismo tiempo, el motor aplica una lógica de prioridad que se descubrió y blindó en H7a.4 con tests exhaustivos.

### 3.1 Reglas acumulativas (el nivel toma el máximo)

Las reglas 1 a 6 se aplican **en orden**, y cada regla puede **subir** el nivel de alerta (nunca bajarlo):

- Si Regla 1 da N1 y Regla 4 da N4 → gana N4.
- Si Regla 2 da N4 y Regla 6 da N2 → gana N4.
- Si Regla 5 da N3 y Regla 2 da N4 → gana N4.

El motor usa `nivelAlerta = Math.max(nivelAlerta, nuevoNivel)` en cada regla, así que **nunca hay downgrade**.

### 3.2 Excepción: la Regla 4 sobreescribe el diagnóstico (no el nivel)

La Regla 4 (inundación fluvial) tiene un comportamiento especial: usa `>=` en vez de `>` para comparar severidad:

```javascript
if (severidadFluvial >= nivelAlerta) {
  nivelAlerta = severidadFluvial;
  diagnostico = {
    titulo: "Riesgo de Desbordamiento e Inundación Ribereña",
    causa: `Comunidad en ribera encajonada (${distRio} km del cauce) con crecida en tránsito de ${poblacionAguasArriba.toLocaleString()} hab. aguas arriba.`,
    tipoAmenaza: "INUNDACION_FLUVIAL"
  };
}
```

**Consecuencia:** si una localidad dispara Regla 2 (N4) y Regla 4 (N4), el diagnóstico final será el de inundación fluvial (la Regla 4 sobreescribe). Si dispara Regla 2 (N4) y Regla 4 (N3), el nivel final es N4 (Regla 2) y el diagnóstico se mantiene en deslave crítico.

---

## 4. Cálculo de la saturación (API)

**Archivo:** `src/engine/riskEvaluator.js` (función `calcularAPI7DiasPrevios`).

La saturación total del suelo se calcula como:

```text
saturacion_total = API_7dias_previos + lluvia_efectiva_24h
```

Donde:

- **`API_7dias_previos`:** índice de precipitación antecedente de los 7 días previos, con pesos decrecientes (`0.85^(8-d)`).
- **`lluvia_efectiva_24h`:** precipitación de las próximas 24 h. Si hay aviso SMN con rango de lluvia mayor, se usa `Math.max(lluvia_real, rango_lluvia_min_mm)`.

**Umbrales críticos:**

- `saturacion_total >= 65.0 mm` → dispara Reglas 2 y 3 (deslave).
- `saturacion_total >= 50.0 mm` → dispara Regla 5 (corte vial, si hay terracería).
- `saturacion_total >= 30.0 mm` → dispara Regla 6 (vigilancia).

> **Nota de Etapa 4:** el `hydroAdapter.js` envuelve a `riskEvaluator.js` y agrega `nivel_alerta_continuo` con una sigmoide centrada en 62 mm, para suavizar el salto entre N3 y N4 cuando la saturación está cerca del umbral.

---

## 5. Aplicación del aviso SMN (H-MOTOR-06)

**Archivo:** `src/engine/riskEvaluator.js` (contexto `alertaSMN`).

**Regla:** el piso de lluvia del aviso SMN solo se aplica si la localidad está en un estado afectado.

```javascript
const estadoAfectado = !!(alertaSMN?.estados_afectados?.some(e =>
  (e === 'HGO' && localidad.estado?.toLowerCase().includes('hidalgo')) ||
  (e === 'PUE' && localidad.estado?.toLowerCase().includes('puebla')) ||
  (e === 'VER' && localidad.estado?.toLowerCase().includes('veracruz'))
));
const lluviaEfectiva24h = (esSierra && alertaSMN && estadoAfectado)
  ? Math.max(lluviaEventoHoy, alertaSMN.rango_lluvia_min_mm || 0)
  : lluviaEventoHoy;
```

**Consecuencia:** un aviso para Veracruz no eleva el piso de lluvia en localidades de Puebla o Hidalgo. Esto resuelve el bug original de H-MOTOR-06 (aviso indiscriminado en todas las zonas de Sierra).

---

## 6. El Gemelo del Runner (H4)

**Archivo:** `scripts/engine/riskEvaluatorRunner.mjs`.

**Divergencias conocidas con `riskEvaluator.js` (preservadas por diseño):**

- **`api7DiasPrevios`:** el runner retorna 0 si la serie es < 168 h; el frontend retorna 15.0.
- **`eventoActual`:** el runner retorna `[]` si la serie es < 192 h; el frontend retorna `serie.slice(0, 24)`.
- **`calcularUmbralDeslave`:** el frontend lo calcula dinámicamente; el runner NO lo calcula.
- **Regla 4 (inundación fluvial):** el frontend gradúa N3/N4 según `poblacionAguasArriba`; el runner SIEMPRE asigna N4.
- **`tiempos`:** el runner hardcodea `{ inicio: "En curso", picoMaximo: "Periodo activo" }`; el frontend calcula `{ inicio, picoMaximo, crestaImpacto }`.
- **Shape de retorno:** el runner expone `vector_dominante`, `sin_datos_regionales`, `impactoSistemico.tempMinimaC`; el frontend expone `diagnostico.tipoAmenaza`, `geografia.posicionHidro`, `impactoSistemico.umbralFisicoDeslaveMm`.
- **`zonaSinDatos`:** el runner lo recibe como flag explícito (viene de `series[zonaId].ok === false`); NO es equivalente a `serieZona.length === 0`.

**Verificación:** `scripts/engine/__tests__/riskEvaluatorRunner.test.js` (3 tests) verifica la paridad funcional en 3 casos simples. La paridad total va a V3.0 (H-MOTOR-01).

---

## 7. Motor Multiamenaza (Etapa 4)

**Ver `08_MOTOR_MULTIAMENAZA.md` para el detalle completo.**

### Resumen

Desde Etapa 4, el runner no usa `evaluarLocalidad` directamente. Usa `evaluarMultiamenaza` (`src/engine/crossThreatOrchestrator.js`), que combina:

1. **Motor hidrológico** (`riskEvaluator.js` + `hydroAdapter.js`) — las 6 reglas de este documento.
2. **Evaluador de viento** (`windEvaluator.js`) — densidad del aire + umbral dinámico por altitud (H6.4a).
3. **Evaluador térmico** (`thermalEvaluator.js`) — sigmoides, Grass Minimum, Bulbo Húmedo.
4. **Evaluador convectivo** (`convectiveEvaluator.js`) — CAPE, Δh de fusión, Downburst.

### Fórmula de acoplamiento (Richardson)

```text
R_orquestado = max(r_H, r_V, r_T, r_C) + Σ γ_ij · (r_i - 1) · (r_j - 1)
```

Donde:

- `r_H`, `r_V`, `r_T`, `r_C` son los riesgos continuos de cada módulo (1.0 a 4.0).
- `γ_ij` es la matriz de coeficientes de acoplamiento (documentada en `08_MOTOR_MULTIAMENAZA.md` §6).
- `(r_i - 1)` es el exceso de riesgo sobre la línea base (N1 no aporta energía destructiva).

### Mapeo al semáforo (H6.4a)

```javascript
function mapearANivel(riesgoContinuo) {
  if (riesgoContinuo >= 4.0) return 4;
  if (riesgoContinuo >= 3.0) return 3;
  if (riesgoContinuo >= 2.0) return 2;
  return 1;
}
```

> **Nota importante:** el mapeo original usaba umbrales 1.5/2.5/3.5, pero se cambió a 2.0/3.0/4.0 en H6.4a porque los 4 módulos emiten `nivelContinuo` en el rango `[nivel, nivel+0.99]`. Con los umbrales originales, un N1 con `nivelContinuo=1.69` disparaba N2 global (falso positivo). El bug se detectó en la auditoría H6.4 (47 falsos positivos en Pachuca).

El motor hidrológico de este documento (las 6 reglas) sigue siendo la base. El orquestador lo usa a través de `hydroAdapter.js`, que añade el `nivel_alerta_continuo`. El resto de la lógica (reglas, prioridad, saturación, aviso SMN) es idéntica.