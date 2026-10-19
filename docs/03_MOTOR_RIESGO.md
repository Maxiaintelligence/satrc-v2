# SatRC V2.0 — Motor de Evaluación de Riesgo (Nivel Ingeniería)

> Este documento detalla la lógica exacta de los motores de evaluación. Cualquier modificación aquí requiere pruebas empíricas con los scripts de PowerShell en `scripts/diagnostico/`.

## Índice

1. [El Runner Autónomo](#1-el-runner-autónomo)
2. [Las 6 reglas de evaluación](#2-las-6-reglas-de-evaluación)
3. [Cálculo de la saturación (API)](#3-cálculo-de-la-saturación-api)
4. [Aplicación del aviso SMN (H-MOTOR-06)](#4-aplicación-del-aviso-smn-h-motor-06)

---

## 1. El Runner Autónomo

**Archivo:** `scripts/ejecutar_sara_autonomo.mjs`

El runner es el corazón del sistema. Corre en GitHub Actions (Node.js 22).

### 1.1 Flujo de ejecución (estado actual, Etapa 3)

1. **Aviso SMN:** consulta `https://smn.conagua.gob.mx/es/` buscando "torrenciales", "hidalgo", etc. Si hay aviso, eleva la `lluvia_efectiva` mínima para las zonas de Sierra (solo si el estado de la localidad está en el aviso).
2. **Nodos regionales:** la función `seleccionarNodosRegionales()` (importada de `src/lib/compartido/nodos.js`) agrupa las 405 localidades por `zona_id` y selecciona como nodo la de mayor `vulnerabilidad.poblacion`.
3. **Fetch en paralelo (lotes de 4):** `cargarSeriesRegionales()` usa lotes de 4 peticiones concurrentes con un delay de 500 ms entre lotes. Si falla una zona, reintenta 2 veces con 3 s de espera. *(N26 resuelto)*.
4. **Consenso:** `generarConsensoDeterminista()` se aplica a cada zona.
5. **Evaluación:** se aplica `riskEvaluator.js` a las 405 localidades usando la serie de su zona.
6. **Publicación:** se guarda en Vercel Blob (`estado_diocesano.json` y `bitacora_sara.json`).

### 1.2 El bug original (el nodo único)

El código anterior a Octubre 2026 usaba solo el nodo de Huauchinango para evaluar las 405 localidades. Esto causaba que localidades secas del Altiplano (ej. Actopan) se reportaran como N2 por lluvias que solo ocurrían en la Sierra. **ADR-001** corrigió esto usando los 14 nodos.

---

## 2. Las 6 reglas de evaluación

**Archivo:** `src/engine/riskEvaluator.js`

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

- Terreno plano (`pendiente_max_deg < 15`)
- Lluvia < 20 mm
- Temperatura > 2 °C
- Viento < 40 km/h

### Regla 2 — Deslave crítico (N4)

**Aplica a:** zonas de Sierra.

Si `pendiente >= 45°` **Y** `saturacion_total >= 65.0 mm` → **N4**.

> **Física:** a 45°, el suelo falla geométricamente si está saturado.

### Regla 3 — Deslave moderado (N3)

Si `pendiente >= 25°` (pero `< 45°`) **Y** `saturacion_total >= 65.0 mm` → **N3**.

### Regla 4 — Inundación fluvial (N4 / N3)

Condiciones de entrada (**todas**):

- `dist_cauce_km <= 0.8`
- `TWI >= 12`
- `lluvia_efectiva >= 35 mm`

Resultado:

- Si `lluvia >= 65 mm` **o** `poblacion_aguas_arriba >= 50000` → **N4**
- Si no → **N3**

### Regla 5 — Corte vial (N3)

Si `acceso` es `CAMINO_TERRACERIA` o `BRECHA` **Y** (`lluvia >= 20 mm` **o** `saturacion >= 50 mm`) → **N3**.

### Regla 6 — Vigilancia (N2)

Si se cumple **cualquiera** → **N2**:

- `lluvia >= 8 mm`
- `saturacion >= 30 mm`
- `visibilidad <= 2 km` (niebla)

---

## 3. Cálculo de la saturación (API)

El cálculo es **determinista** (no usa IA):

```text
Saturación = API_7dias + Lluvia_24h
```

El API decae exponencialmente:

```text
Lluvia_dia * (0.85 ^ (8 - dia))
```

Si el suelo tiene > 65 mm de saturación y la pendiente es alta, el riesgo es real.

---

## 4. Aplicación del aviso SMN (H-MOTOR-06)

A partir de la Etapa 3, `lluviaEfectiva24h` **NO** se aplica a todas las zonas de Sierra por igual. Solo se aplica el piso de lluvia del aviso (`rango_lluvia_min_mm`) si la localidad pertenece a uno de los `estados_afectados` (`HGO`, `PUE`, `VER`).

Si el aviso es solo para `VER`, las localidades de Hidalgo y Puebla usan su lluvia real de Open-Meteo, evitando la sobre-alertación masiva.