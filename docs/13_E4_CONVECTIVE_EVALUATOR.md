# SatRC V2.0 — Módulo de Evaluación Convectiva (Nivel Ingeniería)

| Campo | Detalle |
|---|---|
| **Hito** | Etapa 4 (E4-H3) |
| **Archivo de producción** | `src/engine/convectiveEvaluator.js` |
| **Archivo de tests** | `src/engine/__tests__/convectiveEvaluator.test.js` |
| **Dependencias** | `cape`, `freezing_level_height`, `precipitation`, `wind_gusts_10m` (Open-Meteo) |

---

## 1. Propósito y Problema a Resolver

Las tormentas de granizo y las "rachas descendentes" (*downbursts*) son los eventos más destructivos y repentinos en la Sierra. El motor hidrológico actual (basado en medias de lluvia) es ciego a estos eventos. Una lluvia de 15 mm puede ser Nivel 1 (Calma), pero si viene acompañada de granizo a 80 km/h, el daño a techos y cultivos es catastrófico.

**La solución:** un módulo especialista que utiliza variables de inestabilidad atmosférica (CAPE) y altura del nivel de congelación para predecir tormentas severas, granizo y vientos destructivos locales, con horas de anticipación.

---

## 2. Fundamento Físico y Matemático

### 2.1 CAPE (Energía Potencial de Convección)

El CAPE (J/kg) mide el "combustible" de la atmósfera: la energía que tiene una burbuja de aire caliente para ascender rápidamente.

| CAPE (J/kg) | Estado de la atmósfera |
|---|---|
| < 1000 | Estable. Tormentas débiles o lluvia normal |
| 1000 – 2500 | Inestable. Tormentas fuertes, posible granizo |
| > 2500 | Extremadamente inestable. Riesgo de supercélulas, granizo grande y vientos destructivos |

### 2.2 Altura del Nivel de Congelación (`freezing_level_height`)

El granizo se forma cuando las gotas de lluvia son empujadas hacia arriba (por el CAPE) hasta una altura donde la temperatura es bajo cero, se congelan y luego caen.

- Si el nivel de congelación está **muy alto** (ej. 4500 m), el granizo se derrite antes de tocar el suelo (solo cae lluvia).
- Si el nivel de congelación está **bajo** (ej. 2500 m), el granizo llega intacto al suelo. En nuestra región (cerros de 2000–3000 m), un `freezing_level_height` < 3500 m es una **bandera roja**.

### 2.3 Downbursts (Rachas Descendentes)

Una tormenta severa succiona aire hacia arriba, pero cuando la lluvia o el granizo son muy pesados, arrastran ese aire hacia abajo violentamente. Esto genera ráfagas locales que superan los 100 km/h (peores que un huracán) durante unos 5 minutos. Se detecta combinando `cape` alto con `wind_gusts_10m` alto.

---

# SatRC V2.0 — Módulo de Evaluación Convectiva (Nivel Ingeniería)

> **Hito:** Etapa 4 (E4-H3)
> **Archivo de Producción:** `src/engine/convectiveEvaluator.js`
> **Archivo de Tests:** `src/engine/__tests__/convectiveEvaluator.test.js`
> **Dependencia:** `cape`, `freezing_level_height`, `relative_humidity_700hPa`, `wind_speed_700hPa`, `precipitation` (Open-Meteo), `altitud_msnm` (localidades.json).

## 1. Propósito y Paradigma Predictivo

El motor actual es ciego ante eventos de convección severa (granizo, downbursts o supercélulas) porque los promedios de lluvia no capturan la densidad de energía cinética de una tormenta.

**La Solución:** Evaluar la atmósfera en 3D usando la física de Richardson. El módulo **no usa `wind_gusts_10m` como condición de entrada** (eso sería una tautología: esperar a que la ráfaga ya ocurra). En su lugar, calcula los **precursores termodinámicos** (Inestabilidad, Aire Seco en Capas Medias y Cizalladura del Viento) para anticipar el evento con horas de antelación.

---

## 2. Fundamento Físico y Matemático

### 2.1. Inestabilidad (CAPE) y Discontinuidad

El CAPE mide el "combustible" atmosférico. Para evitar el parpadeo del semáforo (Step-Function Artifact), se usa una **función sigmoide continua** en lugar de umbrales rígidos (ej. `if CAPE > 1500`).

- $W_{inestabilidad} = \frac{1}{1 + e^{-0.001 \cdot (CAPE - 1500)}}$
- Esto permite que un CAPE de 1490 J/kg sea ligeramente menor en riesgo que uno de 1510 J/kg, sin saltos bruscos.

### 2.2. La Etapa de Granizo (Espesor de la Capa de Fusión)

El granizo se forma en lo alto y se derrite al caer. Para saber si llega al suelo intacto:

- **Espesor de Fusión ($\Delta h$):** $\Delta h = \text{freezing\_level\_height} - \text{altitud\_msnm}$
- Si $\Delta h < 1000\ \text{m}$, la partícula de hielo no tiene tiempo de derretirse. **Bandera Roja de Granizo.**

### 2.3. Precursores de Downburst (Rachas Descendentes)

Un downburst ocurre cuando la lluvia/granizo cae a través de una capa de aire seco, se evapora y enfría el aire violentamente, desplomándolo. No requiere mirar la ráfaga en superficie, sino la humedad en capas medias (700 hPa).

- **Potencial de Desplome:** $Potencial = CAPE \cdot (100 - RH_{700hPa})$
- Si $RH_{700hPa}$ es bajo (< 40%) y el CAPE es alto, el riesgo es extremo.

### 2.4. Cizalladura Vertical del Viento (Wind Shear)

Una tormenta sin cizalladura "se ahoga" a sí misma (la lluvia cae sobre su propia corriente ascendente). Una tormenta con alta cizalladura se inclina, separando el ascenso y el descenso, volviéndose una supercélula destructiva.

- **Cizalladura:** $Shear = \text{wind\_speed\_700hPa} - \text{wind\_speed\_10m}$

---

## 3. Lógica de Evaluación (Las Nuevas Reglas Convectivas)

### Regla C1 — Estabilidad Relativa (N1)

- **Condición:** CAPE < 800 J/kg **Y** `Potencial_Desplome` < 50,000.
- **Diagnóstico:** "Atmósfera estable. Sin riesgo de convección severa."

### Regla C2 — Vigilancia por Tormentas Dispersas (N2)

- **Condición:** CAPE >= 800 J/kg **O** `Potencial_Desplome` >= 50,000.
- **Diagnóstico:** "Vigilancia por Inestabilidad Atmosférica. Posibles chubascos fuertes."

### Regla C3 — Alerta por Granizo (N3)

- **Condición:** $W_{inestabilidad} > 0.5$ (CAPE > 1500) **Y** $\Delta h < 1000\ \text{m}$ **Y** `precipitation` > 5 mm.
- **Diagnóstico:** "Alerta por Tormenta Severa con Granizo Intacto."
- **Acción:** "Asegurar techos, resguardar cultivos, suspender actividades en campo."

### Regla C3 — Alerta por Downburst (N3)

- **Condición:** `Potencial_Desplome` > 100,000 **Y** `Shear` > 15 km/h.
- **Diagnóstico:** "Alerta por Rachas Descendentes (Downburst). Riesgo de vientos destructivos repentinos."
- **Acción:** "Evitar zonas de árboles altos y estructuras ligeras."

### Regla C4 — Emergencia por Supercélula (N4)

- **Condición:** `Potencial_Desplome` > 150,000 **Y** `Shear` > 25 km/h **Y** CAPE > 2500 J/kg.
- **Diagnóstico:** "Emergencia por Supercélula. Vientos huracanados locales, granizo gigante y posibles tornados."
- **Acción:** "Evacuación preventiva, refugio en estructuras de concreto."

---

## 4. Estructura del Objeto de Retorno (Contrato de Datos)

```javascript
{
  modulo: "convective",
  nivel_alerta: 3,
  vector_dominante: "DOWNBURST", // "GRANIZO", "SUPERCELULA"
  diagnostico: {
    titulo: "Alerta por Rachas Descendentes (Downburst)",
    causa: "Potencial de desplome de 120,000 (CAPE 2000 J/kg con humedad en 700hPa del 40%). Riesgo de vientos destructivos."
  },
  datos_tecnicos: {
    cape_jkg: 2000,
    rh_700hpa: 40,
    potencial_desplome: 120000,
    cizalladura_kmh: 18.0,
    espesor_capa_fusion_m: 800,
    freezing_level_m: 3200,
    altitud_msnm: 2400
  }
}
```

---

## 5. Estrategia de Testing (Vitest)

1. **Test de Estabilidad (N1):** CAPE 500, $RH_{700}$ 80%, sin lluvia → N1.
2. **Test de Granizo Intacto (N3):** CAPE 1800, $RH_{700}$ 70%, $\Delta h = 500\ \text{m}$, lluvia 15 mm → N3 (por granizo).
3. **Test de Granizo que se derrite (N2):** Mismos datos anteriores, pero $\Delta h = 4000\ \text{m}$ → N2 (el granizo se funde).
4. **Test de Downburst (N3):** CAPE 2000, $RH_{700}$ 30%, Shear 20 km/h → N3 (por desplome).
5. **Test de Supercélula (N4):** CAPE 3000, $RH_{700}$ 25%, Shear 35 km/h → N4.
6. **Test de Transición Suave:** CAPE 1499 vs 1501, verificar que el nivel no salta de N1 a N3 violentamente.

## 6. Plan de Implementación

1. Crear `src/engine/convectiveEvaluator.js` con la exportación `evaluarConvectivo(localidad, serieHoraria)`.
2. Implementar las funciones de cálculo del Potencial de Desplome y Cizalladura.
3. Implementar la función sigmoide para el CAPE.
4. Crear `src/engine/__tests__/convectiveEvaluator.test.js`.
5. Asegurar que `npm test` pase en verde sin tocar `riskEvaluator.js`.