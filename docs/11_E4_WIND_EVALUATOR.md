# SatRC V2.0 — Módulo de Evaluación de Riesgo por Viento (Nivel Ingeniería)

| Campo | Detalle |
|---|---|
| **Hito** | Etapa 4 (E4-H1) |
| **Archivo de producción** | `src/engine/windEvaluator.js` |
| **Archivo de tests** | `src/engine/__tests__/windEvaluator.test.js` |
| **Dependencias** | `wind_gusts_10m` (Open-Meteo), `altitud_msnm` (`localidades.json`) |

---

## 1. Propósito y Problema a Resolver

El motor hidrológico actual (`riskEvaluator.js`) evalúa el viento de forma tangencial (Regla 1: < 40 km/h; Regla 5: viento no evaluado). Esto genera el **Bug de Pachuca/Amajac**: localidades con viento estructural normal (por su altitud > 2400 msnm) disparan alertas falsas o rompen la protección del Altiplano.

**La solución:** un módulo especialista e independiente que evalúa exclusivamente el riesgo por viento, utilizando **ráfagas** (`wind_gusts_10m`) en lugar de viento sostenido, y aplicando un **factor de exposición por altitud**.

---

## 2. Fundamento Físico y Matemático

### 2.1 Viento Sostenido vs. Ráfagas

- **Viento sostenido (`wind_speed_10m`):** promedio en 10 minutos. No causa daños estructurales severos.
- **Ráfaga (`wind_gusts_10m`):** pico máximo en 3 segundos. Es la que **rompe techos, derriba árboles y causa volcaduras**. El motor usará exclusivamente la ráfaga.

### 2.2 Corrección por Altitud (el fin del Bug de Pachuca)

La atmósfera es más densa a nivel del mar. A mayor altitud, el aire es menos denso, pero la exposición es mayor. Para evitar falsos positivos en zonas altas, se aplica un **umbral dinámico** basado en la altitud de la localidad.

- **Zonas de alta exposición (altitud > 2300 msnm; ej. Pachuca, Amajac, Mineral del Monte):** el umbral de daño estructural aumenta. Un viento de 50 km/h es brisa normal.
- **Zonas de valle (altitud < 2300 msnm; ej. Tulancingo, Huauchinango):** el umbral es más bajo. Un viento de 50 km/h puede ser anómalo y peligroso.

**Fórmula del umbral ajustado:**

```text
Umbral_Ajustado = Umbral_Base + Factor_Altitud
Factor_Altitud  = (altitud_msnm - 2000) * 0.01
```

Donde:

- `Factor_Altitud` aporta aprox. 0.4 km/h extra por cada 40 m de altura.
- `Umbral_Base` es el nivel de referencia para el nivel del mar.

### 2.3 Cálculo de la Ráfaga Efectiva

Open-Meteo entrega 3 modelos, así que se aplica el principio conservador:

```javascript
// consensusEngine.js ya calcula la mediana.
// Para el viento se usa el MÁXIMO de los 3 modelos.
const rafagaEfectiva = Math.max(rafaga_gfs, rafaga_icon, rafaga_gem);
```

---

## 3. Lógica de Evaluación (las 4 Reglas del Viento)

El módulo retorna un objeto con `nivel_alerta` (1 a 4) y un `diagnostico` detallado.

| Regla | Nivel | Condición (`rafagaEfectiva`) | Significado |
|---|---|---|---|
| W1 | N1 | < 45 km/h + `Factor_Altitud` | Calma / viento normal |
| W2 | N2 | ≥ 45 km/h + `Factor_Altitud` y < 65 km/h + `Factor_Altitud` | Vigilancia por viento moderado |
| W3 | N3 | ≥ 65 km/h + `Factor_Altitud` y < 90 km/h + `Factor_Altitud` | Alerta temprana por viento fuerte |
| W4 | N4 | ≥ 90 km/h + `Factor_Altitud` | Emergencia por viento destructivo |

### Regla W1 — Calma / Viento Normal (N1)

- **Condición:** `rafagaEfectiva < (45 km/h + Factor_Altitud)`.
- **Diagnóstico:** "Vientos dentro de los parámetros normales para la zona."

### Regla W2 — Vigilancia por Viento Moderado (N2)

- **Condición:** `rafagaEfectiva >= (45 km/h + Factor_Altitud)` **y** `< (65 km/h + Factor_Altitud)`.
- **Diagnóstico:** "Vigilancia por Ráfagas Moderadas. Riesgo de desprendimiento de ramas y objetos ligeros."
- **Aplica para:** protección de techos de lámina y lonas en comunidades.

### Regla W3 — Alerta Temprana por Viento Fuerte (N3)

- **Condición:** `rafagaEfectiva >= (65 km/h + Factor_Altitud)` **y** `< (90 km/h + Factor_Altitud)`.
- **Diagnóstico:** "Alerta por Vientos Fuertes. Riesgo de caída de árboles, cortes de energía y daños a techos."
- **Acción operativa (para SARA):** "Suspender actividades al aire libre, reforzar techumbres."

### Regla W4 — Emergencia por Viento Destructivo (N4)

- **Condición:** `rafagaEfectiva >= (90 km/h + Factor_Altitud)`.
- **Diagnóstico:** "Emergencia por Vientos Huracanados. Colapso estructural inminente."
- **Acción operativa (para SARA):** "Evacuación de estructuras ligeras, refugio en zonas sólidas."

---

## 4. Estructura del Objeto de Retorno (Contrato de Datos)

`windEvaluator.js` debe retornar un objeto compatible con el Orquestador Multiamenaza:

```javascript
{
  modulo: "wind",
  nivel_alerta: 3,                     // 1 a 4
  vector_dominante: "VIENTO_FUERTE",   // VIENTO_MODERADO, VIENTO_FUERTE, VIENTO_DESTRUCTIVO
  diagnostico: {
    titulo: "Alerta por Vientos Fuertes (Ráfagas de 75 km/h)",
    causa: "Ráfagas máximas de 75 km/h (GFS). Supera el umbral de 70 km/h para la altitud de la zona (2400 msnm)."
  },
  datos_tecnicos: {
    rafaga_max_kmh: 75.0,
    umbral_aplicado_kmh: 70.0,
    factor_altitud: 4.0,
    modelo_critico: "GFS"              // Modelo que dio el valor más alto
  }
}
```

---

## 5. Estrategia de Testing (Vitest)

Este módulo requiere cobertura exhaustiva (mínimo 6 tests) antes de integrarse al runner.

| # | Test | Entrada | Resultado esperado |
|---|---|---|---|
| 1 | Calma (N1) | Pachuca (2400 m), ráfagas de 50 km/h | N1 (el umbral ajustado es ~69 km/h) |
| 2 | Valle (N2) | Tulancingo (2100 m), ráfagas de 50 km/h | N2 (el umbral ajustado es ~46 km/h) |
| 3 | Alerta (N3) | Cualquier zona, ráfagas de 80 km/h | N3 |
| 4 | Emergencia (N4) | Cualquier zona, ráfagas de 110 km/h | N4 |
| 5 | Consenso (máximo) | GFS 50, ICON 60, GEM 75 | Evalúa con 75 km/h |
| 6 | Faltantes de datos | Localidad sin `wind_gusts_10m` | `null` o N1 (fallback seguro) sin romper la ejecución |

---

## 6. Plan de Implementación (para el desarrollador)

1. Crear `src/engine/windEvaluator.js` con la exportación `evaluarViento(localidad, serieHoraria)`.
2. Implementar la lógica de `Factor_Altitud` y `Math.max` para el consenso.
3. Crear `src/engine/__tests__/windEvaluator.test.js` con los 6 casos.
4. Asegurar que `npm test` pase en verde (sin tocar `riskEvaluator.js`).
5. *(Futuro)* `crossThreatOrchestrator` importará este módulo.