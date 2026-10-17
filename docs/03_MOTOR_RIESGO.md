# SatRC V2.0 — Motor de Evaluación de Riesgo (Nivel Ingeniería)

Este documento detalla la lógica exacta de los motores de evaluación. Cualquier modificación aquí requiere pruebas empíricas con los scripts de PowerShell en `scripts/diagnostico/`.

## 1. El Runner Autónomo (`scripts/ejecutar_sara_autonomo.mjs`)

El runner es el corazón del sistema. Corre en GitHub Actions (Node.js 22).

### 1.1 Flujo de Ejecución
1.  **Aviso SMN:** Consulta `https://smn.conagua.gob.mx/es/` buscando "torrenciales", "hidalgo", etc. Si hay aviso, eleva la `lluvia_efectiva` mínima para las zonas de Sierra.
2.  **Nodos Regionales:** La función `seleccionarNodosRegionales()` agrupa las 405 localidades por `zona_id` y selecciona la de mayor `vulnerabilidad.poblacion` como nodo.
3.  **Fetch en Paralelo:** `cargarSeriesRegionales()` usa `Promise.allSettled` con un *stagger* (retraso) de 200ms entre cada fetch a Open-Meteo. Si falla, reintenta 2 veces con 3s de espera.
4.  **Consenso:** `generarConsensoDeterminista()` se aplica a cada zona.
5.  **Evaluación:** Se aplica `riskEvaluator.js` a las 405 localidades usando la serie de su zona.
6.  **Publicación:** Se guarda en Vercel Blob (`estado_diocesano.json` y `bitacora_sara.json`).

### 1.2 El Bug Original (El Nodo Único)
El código anterior a Octubre 2026 usaba solo el nodo de **Huauchinango** para evaluar las 405 localidades. Esto causaba que localidades secas del Altiplano (ej. Actopan) se reportaran como N2 por lluvias que solo ocurrían en la Sierra. **ADR-001** corrigió esto usando los 14 nodos.

## 2. Las 6 Reglas de Evaluación (`src/engine/riskEvaluator.js`)

La función `evaluarLocalidad(localidad, serieHoraria, contexto)` aplica estas reglas en orden:

### Regla 1 — Protección Altiplano (N1)
Aplica a: `ACT, APN, PMN, PMS, TIZ`.
Si el terreno es plano (`pendiente_max_deg < 15`), lluvia `< 20mm`, temp `> 2°C` y viento `< 40km/h` -> **N1**.

### Regla 2 — Deslave Crítico (N4)
Aplica a: Zonas de Sierra.
Si `pendiente >= 45°` **Y** `saturacion_total >= 65.0 mm` -> **N4**.
*Física:* A 45°, el suelo falla geométricamente si está saturado.

### Regla 3 — Deslave Moderado (N3)
Si `pendiente >= 25°` (pero <45°) **Y** `saturacion_total >= 65.0 mm` -> **N3**.

### Regla 4 — Inundación Fluvial (N4/N3)
Si `dist_cauce_km <= 0.8` **Y** `TWI >= 12` **Y** `lluvia_efectiva >= 35mm`.
Si `lluvia >= 65mm` o `poblacion_aguas_arriba >= 50000` -> **N4**, sino **N3**.

### Regla 5 — Corte Vial (N3)
Si acceso es `CAMINO_TERRACERIA` o `BRECHA` **Y** `lluvia >= 20mm` o `saturacion >= 50mm` -> **N3**.

### Regla 6 — Vigilancia (N2)
Si lluvia `>= 8mm` o saturación `>= 30mm` o visibilidad `<= 2km` (niebla) -> **N2**.

## 3. Cálculo de la Saturación (API)
El cálculo es determinista (no usa IA):
`Saturación = API_7dias + Lluvia_24h`.
El API decae exponencialmente: `Lluvia_dia * (0.85 ^ (8 - dia))`.
*Si el suelo tiene >65mm de saturación y la pendiente es alta, el riesgo es real.*

## 4. Cobertura de Nodos (Problema N26 pendiente)
Actualmente, el runner tiene un `TIMEOUT_FETCH_MS = 30000`. En días de alta latencia de Open-Meteo, algunas zonas fallan. El sistema marca esas zonas como `sin_datos_regionales` y sus localidades quedan en N1 (falso negativo). Se planea aplicar el fix de lotes de 4 que se usó en el frontend.