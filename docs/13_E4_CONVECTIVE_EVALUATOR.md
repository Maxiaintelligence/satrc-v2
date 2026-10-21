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

## 3. Lógica de Evaluación (las Reglas Convectivas)

Este módulo se enfoca en eventos de **corto plazo** (próximas 6–12 horas).

| Regla | Nivel | Condición | Significado |
|---|---|---|---|
| C1 | N1 | `cape` < 800 J/kg **y** `precipitation` < 10 mm | Estabilidad / lluvia normal |
| C2 | N2 | `cape` ≥ 800 y < 1500 J/kg | Vigilancia por inestabilidad |
| C3 | N3 | Granizo (A) o downburst (B), ver detalle | Tormenta severa |
| C4 | N4 | `cape` ≥ 3000 J/kg **y** `wind_gusts_10m` ≥ 90 km/h | Supercélula |

### Regla C1 — Estabilidad / Lluvia Normal (N1)

- **Condición:** `cape` < 800 J/kg **Y** `precipitation` < 10 mm.
- **Diagnóstico:** "Atmósfera estable. Sin riesgo de convección severa."

### Regla C2 — Vigilancia por Inestabilidad (N2)

- **Condición:** `cape` ≥ 800 J/kg **Y** < 1500 J/kg.
- **Diagnóstico:** "Vigilancia por Tormentas Dispersas. Posibles chubascos fuertes."
- **Acción:** "Precaución en actividades al aire libre."

### Regla C3 — Alerta por Granizo / Tormenta Severa (N3)

- **Condición A (granizo):** `cape` ≥ 1500 J/kg **Y** `precipitation` ≥ 10 mm **Y** `freezing_level_height` < 3500 m.
- **Condición B (downburst):** `cape` ≥ 2000 J/kg **Y** `wind_gusts_10m` ≥ 70 km/h.
- **Diagnóstico:** "Alerta por Tormenta Severa (Riesgo de Granizo / Rachas Destructivas)."
- **Acción:** "Asegurar techos, resguardar cultivos, suspender actividades en campo."

### Regla C4 — Emergencia por Supercélula (N4)

- **Condición:** `cape` ≥ 3000 J/kg **Y** `wind_gusts_10m` ≥ 90 km/h.
- **Diagnóstico:** "Emergencia por Supercélula y Downburst (Vientos Huracanados Locales)."
- **Acción:** "Evacuación preventiva de estructuras endebles, resguardo total."

---

## 4. Estructura del Objeto de Retorno (Contrato de Datos)

`convectiveEvaluator.js` debe retornar el siguiente objeto:

```javascript
{
  modulo: "convective",
  nivel_alerta: 3,
  vector_dominante: "TORMENTA_SEVERA", // "GRANIZO", "DOWNBURST"
  diagnostico: {
    titulo: "Alerta por Tormenta Severa con Granizo",
    causa: "CAPE de 2100 J/kg con nivel de congelación a 2800m. Probable caída de granizo en la zona."
  },
  datos_tecnicos: {
    cape_max_jkg: 2100,
    freezing_level_m: 2800,
    lluvia_mm: 15.0,
    rafaga_max_kmh: 65.0
  }
}
```

---

## 5. Estrategia de Testing (Vitest)

| # | Test | Entrada | Resultado esperado |
|---|---|---|---|
| 1 | Estabilidad (N1) | CAPE 200, lluvia 2 mm | N1 |
| 2 | Inestabilidad (N2) | CAPE 1200, lluvia 5 mm | N2 |
| 3 | Granizo (N3) | CAPE 1800, lluvia 15 mm, nivel de congelación 3000 m | N3 |
| 4 | Downburst (N3) | CAPE 2200, ráfaga 75 km/h | N3 |
| 5 | Supercélula (N4) | CAPE 3500, ráfaga 95 km/h | N4 |
| 6 | Granizo que se derrite | CAPE 1800, lluvia 15 mm, nivel de congelación 4500 m | N2 (el granizo se derrite antes de caer; solo es lluvia fuerte) |

---

## 6. Plan de Implementación (para el desarrollador)

1. Crear `src/engine/convectiveEvaluator.js` con la exportación `evaluarConvectivo(localidad, serieHoraria)`.
2. Implementar la lógica de umbrales para CAPE y `freezing_level_height`.
3. Crear `src/engine/__tests__/convectiveEvaluator.test.js`.
4. Asegurar que `npm test` pase en verde.