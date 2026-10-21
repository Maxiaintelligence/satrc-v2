# SatRC V2.0 — Módulo de Evaluación Térmica (Nivel Ingeniería)

> **Hito:** Etapa 4 (E4-H2)
> **Archivo de Producción:** `src/engine/thermalEvaluator.js`
> **Archivo de Tests:** `src/engine/__tests__/thermalEvaluator.test.js`
> **Dependencia:** `apparent_temperature`, `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`, `cloud_cover`, `wet_bulb_temperature_2m` (Open-Meteo), `altitud_msnm` (localidades.json).

## 1. Propósito y Cambio de Paradigma

El motor hidrológico actual solo reacciona a la lluvia. Es ciego ante eventos de temperatura extrema. Un termómetro marcando -2°C en el Altiplano puede mantener el semáforo en Nivel 1 (Verde) si no hay lluvia, ignorando el riesgo letal de hipotermia o el daño irreversible a cultivos.

**El Cambio de Paradigma:** Eliminamos las reglas rígidas `if (temp < 15)`. La atmósfera es un sistema continuo (Richardson). El módulo usará **funciones de ponderación suave (Sigmoides)** para que el riesgo transicione gradualmente y evitará el sesgo del termómetro a 2 metros usando la **Temperatura de Superficie (Grass Minimum)** y la **Temperatura de Bulbo Húmedo**.

---

## 2. Fundamento Físico y Matemático

### 2.1. Evaluador Continuo (Funciones Sigmoides)

En lugar de una bifurcación estacional brusca, calculamos el peso ($W$) de cada régimen térmico:

- **Peso del Frío:** $W_{frio} = \frac{1}{1 + e^{0.5 \cdot (T_{aparente} - 15)}}$
- **Peso del Calor:** $W_{calor} = \frac{1}{1 + e^{-0.5 \cdot (T_{aparente} - 25)}}$
- **Peso Neutro:** $W_{neutro} = 1 - W_{frio} - W_{calor}$

El riesgo final es una suma ponderada de los niveles de frío y calor. Si la temperatura es 14.9°C, el peso del frío será alto pero no absoluto, evitando el parpadeo (flickering) del semáforo.

### 2.2. El Peligro de la Helada Agrícola (Corrección del "Grass Minimum")

El termómetro a 2 metros miente. Las plantas se congelan por pérdida de radiación infrarroja hacia el espacio.

- **Física:** Si el cielo está despejado (`cloud_cover` < 20%) y el viento está calmo (< 10 km/h), el suelo pierde calor rápidamente. La temperatura de la hoja puede ser hasta 3.5°C más baja que la temperatura del aire.
- **Cálculo:** `temp_superficie_estimada = temp_aire - (cloud_cover < 20 && viento < 10 ? 3.5 : 0.0)`.
- **Acción:** Si `temp_superficie_estimada` <= 0°C, hay helada agrícola inminente, aunque el termómetro marque +2°C.

### 2.3. La Nevada y el Enfriamiento Adiabático

La precipitación sólida no depende solo de la temperatura seca. La evaporación del copo de nieve en el aire enfría la atmósfera.

- **Física:** El agua se congela en el bulbo húmedo (`wet_bulb_temperature`), no en el bulbo seco.
- **Cálculo:** Si `precipitation` > 0 Y `wet_bulb_temperature` < 1.0°C Y `freezing_level_height` < (altitud + 500 m) → Nevada.

---

## 3. Lógica de Evaluación (Contrato de Datos)

El `thermalEvaluator.js` retornará un objeto con `nivel_alerta` (1 a 4) y el `tipo_amenaza` (FRIO o CALOR). El nivel final es el máximo entre los riesgos humanos y agrícolas.

### 🥶 Riesgos por Frío (Invierno)

- **Hipotermia:**
  - `apparent_temperature` < 0°C → **N2**.
  - `apparent_temperature` < -5°C → **N3**.
- **Nevada:**
  - `precipitation` > 0 Y `wet_bulb_temperature` < 1.0°C Y `freezing_level_height` < (altitud + 500) → **N3**.
- **Helada Agrícola:**
  - `cloud_cover` < 20% Y `viento` < 10 km/h Y `temp_superficie_estimada` <= 0°C → **N3**.
  - *Acción operativa:* "Proteger cultivos, cerrar accesos a caminos de terracería."

### 🥵 Riesgos por Calor (Primavera/Verano)

- **Estrés Térmico:**
  - `apparent_temperature` > 35°C → **N2**.
  - `apparent_temperature` > 42°C → **N3**.

---

## 4. Estructura del Objeto de Retorno

```javascript
{
  modulo: "thermal",
  nivel_alerta: 3,
  vector_dominante: "HELADA_AGRICOLA", // "FRIO_EXTREMO", "CALOR_EXTREMO", "NEVADA"
  diagnostico: {
    titulo: "Alerta por Helada Agrícola (Cielo Despejado)",
    causa: "Cielo despejado y viento calmo han enfriado el suelo a -1.2°C (Grass Minimum), a pesar de que el aire a 2m marca +2.3°C."
  },
  datos_tecnicos: {
    temp_aire_c: 2.3,
    temp_superficie_estimada_c: -1.2,
    apparent_temperature_c: 1.5,
    cobertura_nubosa_pct: 5,
    bulbo_humedo_c: 1.8
  }
}
```

---

## 5. Estrategia de Testing (Vitest)

El motor térmico es crítico. Los tests deben validar la superioridad de la termodinámica continua:

1. **Test de Transición Suave:** Temperatura aparente de 15.1°C y 14.9°C. El nivel de alerta no debe saltar de N1 a N3 bruscamente (validar ponderación).
2. **Test de Hipotermia (Frío Extremo):** `apparent_temperature` de -3°C en Pachuca → N3.
3. **Test de Golpe de Calor (Calor Extremo):** `apparent_temperature` de 45°C en Actopan → N3.
4. **Test de Helada Agrícola (Grass Minimum):** `temp_aire` 2.0°C, `cloud_cover` 10%, viento 5 km/h → N3 (porque el suelo está a -1.5°C).
5. **Test de Nevada (Bulbo Húmedo):** precipitación 5 mm, `bulbo_humedo` 0.5°C, `freezing_level` 2400 m, localidad a 2400 m → N3.
6. **Test de Falsos Positivos:** Cielo nublado (`cloud_cover` 80%), viento 20 km/h, temp 2°C. No hay helada radiativa → N1.

## 6. Plan de Implementación (Para el desarrollador)

1. Crear `src/engine/thermalEvaluator.js` con la exportación `evaluarTermico(localidad, serieHoraria)`.
2. Implementar la función sigmoide para el cálculo de pesos (`W_frio`, `W_calor`).
3. Implementar la lógica de "Grass Minimum" y "Bulbo Húmedo".
4. Crear `src/engine/__tests__/thermalEvaluator.test.js` con los 6 casos.
5. Asegurar que `npm test` pase en verde sin tocar `riskEvaluator.js`.