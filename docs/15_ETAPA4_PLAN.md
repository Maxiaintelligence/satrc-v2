# SatRC V2.0 — Plan de Etapa 4: Arquitectura Multiamenaza

**Fecha:** Octubre 2026
**Estado:** Diseño completado y validado empíricamente. Listo para implementación.
**Objetivo:** Transformar SatRC de un detector hidrológico a un **Sistema Experto Meteorológico Multiamenaza**, capaz de predecir y alertar sobre lluvias, vientos, calor, frío, nevadas, granizo y sus intersecciones, usando física numérica y termodinámica.

---

## 1. La Nueva Filosofía: Módulos Especialistas y Adaptadores

El éxito de la Etapa 3 radicó en la estabilidad del motor hidrológico (`riskEvaluator.js`). **No vamos a reescribirlo.** En su lugar, adoptaremos una arquitectura de **Módulos Especialistas**, cada uno con su propia física y test unitario, coordinados por un Orquestador no lineal.

```text
src/engine/
├── riskEvaluator.js            # [INTACTO] Motor Hidrológico actual (lluvia, deslaves)
├── hydroAdapter.js             # [NUEVO] Suavizado del motor hidrológico (Capa continua)
├── windEvaluator.js            # [NUEVO] Riesgo por Viento y Ráfagas (Densidad y Presión Dinámica)
├── thermalEvaluator.js         # [NUEVO] Riesgo por Frío, Calor, Heladas y Nieve (Termodinámica)
├── convectiveEvaluator.js      # [NUEVO] Riesgo por Granizo y Downbursts (CAPE y Humedad)
└── crossThreatOrchestrator.js  # [NUEVO] El Cerebro que acopla todas las amenazas
```

---

## 2. Detalle de los Módulos (Física y Lógica Validada)

### 2.1. Motor Hidrológico (`riskEvaluator.js` + `hydroAdapter.js`)

- **Motor Original:** Se queda intacto, usando el proxy de saturación (`API_7dias + lluvia_24h`).
- **Nota de Validación de Open-Meteo:** Se intentó usar `soil_moisture` (humedad real del suelo), pero la API devuelve `null` para nuestra región geográfica. Por lo tanto, se mantiene el proxy.
- **El Adaptador (`hydroAdapter.js`):** Envuelve al `riskEvaluator.js`. Elimina el "Salto de Borde" usando una función sigmoide. Si el motor original da N3 pero la saturación está a 64.9 mm (cerca del umbral de 65 mm para N4), el adaptador retorna un nivel continuo de 3.8 (Alerta inminente), en lugar de esperar el salto brusco.

### 2.2. Motor de Viento (`windEvaluator.js`)

- **El Fin del Bug de Pachuca:** Ya no se usa un umbral de altitud. Se calcula la Densidad del Aire local con `surface_pressure` y `temperature_2m`.
- **Velocidad Equivalente:** Se normaliza la ráfaga (`wind_gusts_10m`) a nivel del mar para calcular la presión dinámica real.
- **Reglas:** Ráfagas > 45 km/h (N2), > 65 km/h (N3), > 90 km/h (N4).

### 2.3. Motor Térmico (`thermalEvaluator.js`)

- **El Peligro del Termómetro a 2 m:** Se estima la temperatura del suelo (Grass Minimum) usando `cloud_cover` (radiación) y `wind_speed` (mezcla). Si el cielo está despejado y no hay viento, la superficie se congela aunque el aire esté a +2°C.
- **Nevadas:** Usa `wet_bulb_temperature_2m` (bulbo húmedo) en lugar de temperatura seca, porque la evaporación del copo enfría el aire.
- **Transiciones:** Uso de funciones sigmoides para los rangos de frío/calor (evita parpadeos en el semáforo).

### 2.4. Motor Convectivo (`convectiveEvaluator.js`)

- **Granizo:** Usa el espesor de la capa de fusión ($\Delta h = \text{freezing\_level\_height} - \text{altitud\_msnm}$). Si es menor a 1000 m, el granizo llega intacto al suelo.
- **Downbursts:** En lugar de esperar a que la ráfaga destructiva ocurra, evalúa los precursores. Calcula el `Potencial_Desplome` cruzando el `cape` con la humedad en capas medias (`relative_humidity_700hPa`). Si el aire está seco y el CAPE es alto, el riesgo de racha descendente es inminente.

### 2.5. El Orquestador (`crossThreatOrchestrator.js`)

- **Adiós al `Math.max`:** El riesgo no es lineal. Un suelo blando (Hidrología N2) + Viento moderado (N2) = Árboles caídos (N3).
- **Fórmula de Acoplamiento:**

$$R_{orquestado} = \max(r_H, r_V, r_T, r_C) + \sum \gamma \cdot (r_i - 1)(r_j - 1)$$

- **Salida:** Entrega un `nivel_alerta_global` (entero) y un `riesgo_continuo` (decimal) para auditoría.

---

## 3. Estrategia del SMN / CONAGUA: Precisión Geográfica

Para resolver el falso positivo de Veracruz (Sur vs Norte):

- **Web Service (`method=1`):** Consumir el Web Service GZIP de CONAGUA.
- **Cruce de Pronóstico:** Si el SMN emite un aviso para el Sur de Veracruz, pero Open-Meteo dice que en Huayacocotla (Norte) habrá 0 mm, se ignora el piso de lluvia del SMN para esa localidad.

---

## 4. Planeación de Implementación (Roadmap E4)

La Etapa 4 se implementará de forma atómica, respetando la regla "1 commit = 1 causa".

1. **H1 (E4) — Wind Evaluator:** Codificar `windEvaluator.js` + sus 6 tests. 1 commit.
2. **H2 (E4) — Thermal Evaluator:** Codificar `thermalEvaluator.js` + sus tests. 1 commit.
3. **H3 (E4) — Convective Evaluator:** Codificar `convectiveEvaluator.js` + tests. 1 commit.
4. **H4 (E4) — Hydro Adapter:** Codificar `hydroAdapter.js` + tests. 1 commit.
5. **H5 (E4) — Orquestador:** Codificar `crossThreatOrchestrator.js` + tests de acoplamiento. 1 commit.
6. **H6 (E4) — Integración Frontend/Runner:** Reemplazar `evaluarLocalidad` por `evaluarMultiamenaza` en el runner y en el frontend. Actualizar Zod. 1 commit.
7. **H7 (E4) — SARA Multiamenaza:** Actualizar los prompts de IA (Groq) para que redacte recomendaciones de frío, calor y viento. 1 commit.

---

## 5. Actualización de la IA (SARA) para Multiamenaza

Los prompts de `api/reporte-ondemand.js` y `reporteDiario.mjs` deben cambiar para dejar de ser "expertos en lluvia".

**Nuevas Reglas:**

- Si el vector es `FRIO`: "Recomendar abrigo, revisar techos y proteger cultivos."
- Si el vector es `CALOR`: "Recomendar hidratación y evitar actividades al sol."
- Si el vector es `VIENTO`: "Recomendar asegurar láminas y no salir a caminos de terracería."
- Si el vector es `GRANIZO`: "Recomendar resguardo de vehículos y cultivos."