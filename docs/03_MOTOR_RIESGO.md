# SatRC V2.0 — Motor de Evaluación de Riesgo (Nivel Ingeniería)

> Este documento detalla la lógica exacta de los motores de evaluación. Cualquier modificación aquí requiere pruebas empíricas con los scripts de PowerShell en `scripts/diagnostico/`.

## Índice

1. [El Runner Autónomo](#1-el-runner-autónomo)
2. [Las 6 reglas de evaluación](#2-las-6-reglas-de-evaluación)
3. [Prioridad entre reglas](#3-prioridad-entre-reglas)
4. [Cálculo de la saturación (API)](#4-cálculo-de-la-saturación-api)
5. [Aplicación del aviso SMN (H-MOTOR-06)](#5-aplicación-del-aviso-smn-h-motor-06)

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

## 3. Prioridad entre reglas

Cuando una localidad dispara más de una regla al mismo tiempo, el motor aplica una lógica de prioridad que se descubrió y blindó en H7a.4 con tests exhaustivos.

### 3.1 Reglas acumulativas (nivel toma el máximo)

Las reglas 1 a 6 se aplican **en orden**, y cada regla puede **subir** el nivel de alerta (nunca bajarlo):

- Si Regla 1 da N1 y Regla 4 da N4 → gana N4.
- Si Regla 2 da N4 y Regla 6 da N2 → gana N4.
- Si Regla 5 da N3 y Regla 2 da N4 → gana N4.

El motor usa `nivelAlerta = Math.max(nivelAlerta, nuevoNivel)` en cada regla, así que **nunca hay downgrade**.

### 3.2 Excepción: Regla 4 sobreescribe el diagnóstico (no el nivel)

La Regla 4 (inundación fluvial) tiene un comportamiento especial: usa `>=` en vez de `>` para comparar severidad:

```javascript
if (severidadFluvial >= nivelAlerta) {
  nivelAlerta = severidadFluvial;
  diagnostico = { titulo: "Riesgo de Desbordamiento e Inundación Ribereña", ... };
}

Consecuencia: si Regla 2 y Regla 4 ambas dan N4, el diagnóstico final es "Inundación Ribereña", no "Deslave Crítico". El nivel es el mismo (N4), pero el título se sobreescribe.

Razón de diseño: la inundación afecta a más población (especialmente si poblacion_aguas_arriba >= 50000). El sistema prefiere reportar el evento más masivo cuando ambos son graves.

### 3.3 Casos de prioridad verificados por tests
Los tests en src/engine/__tests__/riskEvaluator.test.js (H7a.4) verifican estos casos:

Escenario	Regla ganadora	Nivel final
Ladera crítica (N4) + inundación (N4)	Regla 4 (inundación)	N4
Ladera crítica (N4) + inundación (N3)	Regla 2 (deslave)	N4
Ladera moderada (N3) + inundación (N4)	Regla 4 (inundación)	N4
Altiplano plano (N1) + cumple condiciones de Regla 4	Regla 4 NO aplica	N1 o N2
Nota: el último caso existe porque Regla 4 tiene un filtro explícito !esZonaAltiplanoPlano que la desactiva en las 5 zonas del Altiplano.

### 3.4 Lo que NO está resuelto todavía
H-MOTOR-01: el runner tiene su propia copia inline de las 6 reglas, con divergencias sutiles (ver 04_HISTORIAL_BUGS.md). La unificación va en V3.0.

H-MOTOR-05: sobreclasificación N2 en zonas húmedas (XIC, HUA, ZAC) por el umbral fijo de 30 mm. Requiere re-auditoría de 90 días. Va en V3.0.

---

## 4. Cálculo de la saturación (API)

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

## 5. Aplicación del aviso SMN (H-MOTOR-06)

A partir de la Etapa 3, `lluviaEfectiva24h` **NO** se aplica a todas las zonas de Sierra por igual. Solo se aplica el piso de lluvia del aviso (`rango_lluvia_min_mm`) si la localidad pertenece a uno de los `estados_afectados` (`HGO`, `PUE`, `VER`).

Si el aviso es solo para `VER`, las localidades de Hidalgo y Puebla usan su lluvia real de Open-Meteo, evitando la sobre-alertación masiva.