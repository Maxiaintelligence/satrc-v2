# SatRC V2.0 — Módulo de Evaluación de Riesgo Térmico (Nivel Ingeniería)

| Campo | Detalle |
|---|---|
| **Hito** | Etapa 4 (E4-H2) |
| **Archivo de producción** | `src/engine/thermalEvaluator.js` |
| **Archivo de tests** | `src/engine/__tests__/thermalEvaluator.test.js` |
| **Dependencias** | `apparent_temperature`, `temperature_2m`, `precipitation`, `freezing_level_height` (Open-Meteo), `altitud_msnm` (`localidades.json`) |

---

## 1. Propósito y Problema a Resolver

El motor hidrológico actual solo reacciona a la lluvia. Es ciego ante eventos de temperatura extrema. Un termómetro marcando -2 °C en el Altiplano puede mantener el semáforo en Nivel 1 (Verde) si no hay lluvia, ignorando el riesgo letal de hipotermia para personas en situación de calle o el daño irreversible a cultivos por heladas.

**La solución:** un módulo especialista que evalúa el estrés térmico humano (frío y calor) y los eventos agrícolas/meteorológicos (heladas y nevadas), utilizando la **sensación térmica** (`apparent_temperature`) como variable principal de decisión.

---

## 2. Fundamento Físico y Matemático

### 2.1 La diferencia entre Temperatura Seca y Sensación Térmica

La `temperature_2m` (temperatura del aire) no refleja el impacto real en el cuerpo humano. El módulo usará `apparent_temperature` (sensación térmica), que Open-Meteo calcula combinando:

- **Frío (Wind Chill / índice JAG/TI):** temperatura + viento. El viento acelera la pérdida de calor de la piel.
- **Calor (Heat Index / índice de Rothfusz):** temperatura + humedad. La humedad evita que el sudor enfríe el cuerpo.

### 2.2 El Algoritmo de Decisión (Bifurcación Estacional)

El módulo lee el pronóstico y determina si está en modo "Invierno" o "Verano" según los valores de `apparent_temperature`:

| Rango de `apparent_temperature` | Modo |
|---|---|
| ≤ 15 °C | Evaluar riesgos de frío |
| Entre 15 °C y 25 °C | Condiciones térmicas neutras (N1) |
| ≥ 25 °C | Evaluar riesgos de calor |

---

## 3. Lógica de Evaluación (las Reglas Térmicas)

El módulo retorna un objeto con `nivel_alerta` (1 a 4), el `tipo_amenaza` (`FRIO` o `CALOR`) y el diagnóstico.

| Regla | Fase | Nivel | Condición | Significado |
|---|---|---|---|---|
| T1 | Frío | N2 | `apparent_temperature` < 5 °C | Hipotermia moderada |
| T2 | Frío | N3 | `apparent_temperature` < 0 °C | Hipotermia severa |
| T3 | Frío | N3 / N4 | Nevada o helada agrícola (ver detalle) | Nevadas y heladas |
| T4 | Calor | N2 | `apparent_temperature` > 35 °C | Estrés por calor |
| T5 | Calor | N3 | `apparent_temperature` > 42 °C | Golpe de calor |

### 3.1 Fase de Frío (frentes fríos / invierno)

#### Regla T1 — Hipotermia Moderada (N2)

- **Condición:** `apparent_temperature` < 5 °C.
- **Diagnóstico:** "Vigilancia por Frío. Descenso térmico significativo."
- **Acción operativa:** "Abrigar a población vulnerable, revisar techos."

#### Regla T2 — Alerta por Hipotermia Severa (N3)

- **Condición:** `apparent_temperature` < 0 °C.
- **Diagnóstico:** "Alerta por Frío Extremo (sensación térmica bajo cero)."
- **Acción operativa:** "Habilitar albergues temporales, proteger ganado."

#### Regla T3 — Emergencia por Nevadas y Heladas (N3 / N4)

- **Condición Nevada (N3):** `precipitation` > 0 mm **Y** `temperature_2m` < 1.5 °C **Y** `freezing_level_height` < (`altitud_msnm` + 500).
  - *Explicación física:* si el nivel de congelación está por debajo de la cima del cerro donde está la comunidad, la lluvia cae como nieve. Vías bloqueadas.
- **Condición Helada Agrícola (N3):** `temperature_2m` < 0 °C **Y** `wind_speed_10m` < 8 km/h **Y** `cape` < 50 (cielo despejado).
  - *Explicación física:* sin nubes ni viento, la radiación terrestre escapa, congelando el rocío sobre las plantas (helada negra).
- **Acción operativa:** "Proteger cultivos, cerrar accesos a caminos de terracería."

### 3.2 Fase de Calor (primavera / olas de calor)

#### Regla T4 — Estrés por Calor (N2)

- **Condición:** `apparent_temperature` > 35 °C.
- **Diagnóstico:** "Vigilancia por Calor. Estrés térmico en la población."
- **Acción operativa:** "Hidratación constante, evitar actividades al mediodía."

#### Regla T5 — Alerta por Golpe de Calor (N3)

- **Condición:** `apparent_temperature` > 42 °C.
- **Diagnóstico:** "Alerta por Calor Extremo. Riesgo inminente de golpe de calor."
- **Acción operativa:** "Suspender actividades al aire libre, vigilar adultos mayores."

---

## 4. Estructura del Objeto de Retorno (Contrato de Datos)

`thermalEvaluator.js` debe retornar un objeto compatible con el Orquestador Multiamenaza:

```javascript
{
  modulo: "thermal",
  nivel_alerta: 3,                    // 1 a 4
  vector_dominante: "FRIO_EXTREMO",   // O "CALOR_EXTREMO", "HELADA", "NEVADA"
  diagnostico: {
    titulo: "Alerta por Frío Extremo (-2°C de Sensación)",
    causa: "Sensación térmica de -2.4°C con viento de 25 km/h. Riesgo de hipotermia."
  },
  datos_tecnicos: {
    temp_real_c: 2.0,
    sensacion_termica_c: -2.4,
    nivel_congelacion_m: 2800
  }
}
```

---

## 5. Estrategia de Testing (Vitest)

Este módulo es crítico porque cambia el comportamiento estacional. Tests requeridos:

| # | Test | Entrada | Resultado esperado |
|---|---|---|---|
| 1 | Calma (N1) | Temperatura 18 °C, sensación 18 °C | N1 |
| 2 | Frío (N2/N3) | Localidad en Pachuca con sensación térmica de -1 °C | N3 (Frío Extremo) |
| 3 | Calor (N2/N3) | Localidad en Actopan con sensación térmica de 45 °C | N3 (Golpe de Calor) |
| 4 | Nevada (N3) | Precipitación 5 mm, temperatura 0 °C, nivel de congelación 2500 m, localidad a 2400 m | N3 (Nevada) |
| 5 | Helada agrícola (N3) | Temperatura -1 °C, viento 5 km/h, CAPE 0 | N3 (Helada) |
| 6 | Borde | Sensación térmica de 22 °C | N1 (neutro, sin alerta) |

---

## 6. Plan de Implementación (para el desarrollador)

1. Crear `src/engine/thermalEvaluator.js` con la exportación `evaluarTermico(localidad, serieHoraria)`.
2. Implementar la lógica de bifurcación (frío ≤ 15 °C, calor ≥ 25 °C).
3. Agregar las validaciones físicas para nevada y helada.
4. Crear `src/engine/__tests__/thermalEvaluator.test.js` con los 6 casos.
5. Asegurar que `npm test` pase en verde (sin tocar `riskEvaluator.js`).