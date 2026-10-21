# SatRC V2.0 — Plan de Etapa 4: Arquitectura Multiamenaza

| Campo | Detalle |
|---|---|
| **Fecha** | Octubre 2026 |
| **Estado** | Diseño completado. Listo para implementación |
| **Objetivo** | Transformar SatRC de un detector hidrológico a un **Sistema Experto Meteorológico Multiamenaza**, capaz de predecir y alertar sobre lluvias, vientos, calor, frío, nevadas, granizo y sus intersecciones |

---

## 1. La Nueva Filosofía: Arquitectura de Módulos Especialistas

El éxito de la Etapa 3 radicó en la estabilidad del motor hidrológico (`riskEvaluator.js`). **No vamos a reescribirlo.** En su lugar, se adopta una arquitectura de **módulos especialistas e independientes**, cada uno con su propia física y test unitario, coordinados por un orquestador.

```text
src/engine/
├── riskEvaluator.js            # [INTACTO] Motor Hidrológico actual (lluvia, deslaves)
├── windEvaluator.js            # [NUEVO] Riesgo por Viento y Ráfagas
├── thermalEvaluator.js         # [NUEVO] Riesgo por Frío, Calor, Heladas y Nieve
├── convectiveEvaluator.js      # [NUEVO] Riesgo por Granizo y Downbursts (CAPE)
└── crossThreatOrchestrator.js  # [NUEVO] El cerebro que cruza todas las amenazas
```

---

## 2. Detalle de los Módulos (Física y Lógica)

### 2.1 Motor Hidrológico (`riskEvaluator.js`)

**Estado:** se queda exactamente como está. Sigue evaluando la saturación del suelo (API), la pendiente y las 6 reglas de deslave e inundación.

### 2.2 Motor de Viento (`windEvaluator.js`)

- **El Bug de Pachuca:** se elimina el uso de viento sostenido. Se evalúan **ráfagas** (`wind_gusts_10m`).
- **Umbrales dinámicos:** se aplica un `Factor_Altitud`. Localidades > 2300 msnm (Pachuca, Amajac) tienen un umbral de daño más alto (ej. ráfagas > 65 km/h para N2) que las zonas de valle (ej. > 45 km/h para N2).

| Nivel | Significado |
|---|---|
| **N1** (Calma) | Ráfagas por debajo del umbral ajustado |
| **N2** (Vigilancia) | Desprendimiento de objetos, lonas |
| **N3** (Alerta) | Caída de árboles y cortes de energía |
| **N4** (Emergencia) | Colapso estructural (ráfagas > 90–100 km/h) |

### 2.3 Motor Térmico (`thermalEvaluator.js`)

**La física:** no usa temperatura seca. Usa la **sensación térmica** (`apparent_temperature`), que combina temperatura, viento (*wind chill*) y humedad (*heat index*).

- **Invierno (frío):** sensación < 0 °C → **N2** (hipotermia). Sensación < -5 °C → **N3**.
- **Heladas agrícolas:** `temperature_2m` < 2 °C + viento bajo + cielo despejado (`cape` < 50) → **N2** (alerta para cultivos).
- **Nevadas:** `precipitation` > 0 + `temperature_2m` < 1.5 °C + nivel de congelación (`freezing_level_height`) por debajo de la altitud del cerro → **N3** (cierre de vías).
- **Primavera (calor):** sensación > 35 °C → **N2** (estrés). Sensación > 42 °C → **N3** (golpe de calor).

### 2.4 Motor Convectivo (`convectiveEvaluator.js`)

**La física:** detecta inestabilidad atmosférica usando CAPE (Energía Potencial de Convección) y la altura de congelación.

- **N2 (Vigilancia):** `cape` > 800 J/kg. Tormentas dispersas.
- **N3 (Granizo / tormenta):** `cape` > 1500 J/kg + lluvia > 10 mm + congelación < 3500 m. Si la congelación está muy alta, el granizo se derrite antes de caer.
- **N3/N4 (Downburst):** `cape` > 2000 J/kg + ráfagas > 70 km/h. Rachas descendentes destructivas.

---

## 3. El Orquestador Multiamenaza (`crossThreatOrchestrator.js`)

Este es el salto de nivel. Ejecuta los 4 módulos anteriores y evalúa la **intersección** (sinergia) de las amenazas. El nivel final es el máximo entre los vectores individuales, **pero** se eleva si dos amenazas moderadas coinciden espacial y temporalmente.

### 3.1 Matriz de Intersección (Cross-Threat)

| Amenaza 1 | Amenaza 2 | Escenario físico combinado | Nivel forzado |
|---|---|---|---|
| Hidrología (N2) | Viento (N2) | Suelo blando + ráfagas fuertes = árboles caídos en caminos | **N3** (Corte Vial) |
| Hidrología (N2) | Térmico Frío (N2) | Lluvia + temperatura bajo cero = aguanieve / vías congeladas | **N3** (Vías Congeladas) |
| Convectivo (N3) | Viento (N2) | Tormenta severa + ráfagas = *downburst* (rachas descendentes) | **N4** (Emergencia) |

### 3.2 Contrato de Salida del Orquestador

Reemplaza al objeto que genera `riskEvaluator.js`:

```json
{
  "nivel_alerta_global": 3,
  "vector_dominante": "HIDRO_VIENTO",
  "niveles_por_vector": {
    "hidrologico": 2,
    "viento": 2,
    "termico": 1,
    "convectivo": 1
  },
  "diagnostico": {
    "titulo": "Alerta por Caída de Árboles y Cortes Viales",
    "causa": "El suelo saturado por lluvia y las ráfagas fuertes de viento generan riesgo de caída de árboles."
  }
}
```

---

## 4. Estrategia del SMN / CONAGUA: Precisión Geográfica

Para resolver el falso positivo de Veracruz (Sur vs. Norte):

1. **Web Service (`method=1`):** consumir el Web Service GZIP de CONAGUA en lugar de hacer scraping del HTML.
2. **Cruce de pronóstico:** si el SMN emite un aviso para el Sur de Veracruz, pero el modelo Open-Meteo indica 0 mm de lluvia en Huayacocotla (Norte), el sistema ignora el piso de lluvia del SMN para esa localidad.
3. **Regla de aplicación:** el SMN se usa como "segunda opinión" solo si sus datos coinciden con la realidad local de Open-Meteo.

---

## 5. Planeación de Implementación (Roadmap E4)

La Etapa 4 se implementa de forma atómica, con tests antes de tocar el orquestador.

- [ ] **H1 (E4) — Wind Evaluator:** codificar `windEvaluator.js` + sus 6 tests (incluye el fix de Pachuca). 1 commit.
- [ ] **H2 (E4) — Thermal Evaluator:** codificar `thermalEvaluator.js` + sus tests (frío, calor, heladas). 1 commit.
- [ ] **H3 (E4) — Convective Evaluator:** codificar `convectiveEvaluator.js` + tests (CAPE, granizo, downbursts). 1 commit.
- [ ] **H4 (E4) — Orquestador:** codificar `crossThreatOrchestrator.js` + tests de intersección. 1 commit.
- [ ] **H5 (E4) — Integración Frontend/Runner:** reemplazar `evaluarLocalidad` por `evaluarMultiamenaza` en el runner y en el frontend. Actualizar Zod si es necesario. 1 commit.
- [ ] **H6 (E4) — SARA Multiamenaza:** actualizar los prompts de IA (Groq) para que redacte recomendaciones de frío, calor y viento. 1 commit.

---

## 6. Actualización de la IA (SARA) para Multiamenaza

Los prompts de `api/reporte-ondemand.js` y `reporteDiario.mjs` deben cambiar para dejar de ser "expertos en lluvia".

**Nuevas reglas:**

| Vector | Recomendación de SARA |
|---|---|
| `FRIO` | Recomendar abrigo, revisar techos y proteger cultivos |
| `CALOR` | Recomendar hidratación y evitar actividades al sol |
| `VIENTO` | Recomendar asegurar láminas y no salir a caminos de terracería |
| `GRANIZO` | Recomendar resguardo de vehículos y cultivos |