# SatRC V2.0 — Módulo de Evaluación de Riesgo por Viento (Nivel Ingeniería)

> **Hito:** Etapa 4 (E4-H1)
> **Archivo de Producción:** `src/engine/windEvaluator.js`
> **Archivo de Tests:** `src/engine/__tests__/windEvaluator.test.js`
> **Dependencia:** `wind_gusts_10m`, `wind_speed_10m`, `surface_pressure`, `temperature_2m` (Open-Meteo) y `altitud_msnm`, `relieve` (localidades.json).

## 1. Propósito y Problema a Resolver (El Fin del Bug de Pachuca)

El motor hidrológico actual (`riskEvaluator.js`) evalúa el viento con un umbral estático rígido (ej. `< 40 km/h`). Esto genera el **Bug de Pachuca/Amajac**: localidades de alta montaña (> 2400 msnm) tienen un régimen de viento basal estructuralmente más fuerte. Un umbral rígido dispara falsas alarmas, mientras que un umbral "por costumbre" a los 2300 msnm genera discontinuidades artificiales (un pueblo a 2290m se comporta distinto que uno a 2310m).

**La Solución (Basada en la Física de Richardson):** 
Evaluar el viento utilizando la **Presión Dinámica Equivalente**. El daño estructural no depende de la velocidad lineal, sino de la fuerza ejercida (\(q = \frac{1}{2} \rho v^2\)). Dado que la densidad del aire (\(\rho\)) disminuye con la altitud, una ráfaga de 50 km/h en Pachuca ejerce menos fuerza física que en un valle a nivel del mar. El motor normalizará la ráfaga a una **Velocidad Equivalente a Nivel del Mar (\(v_{eq}\))** para aplicar un umbral único y físicamente realista.

---

## 2. Fundamento Físico y Matemático

### 2.1. Dos Escalas para Dos Objetivos (Viento vs. Ráfaga)
*   **Viento Sostenido (`wind_speed_10m`):** Promedio de 10 minutos. Filtra el ruido estocástico. Se usa para calcular el estado basal y el **Factor de Ráfaga**.
*   **Ráfaga (`wind_gusts_10m`):** Pico máximo en 3 segundos. Es la variable que rompe techos y derriba árboles. **El motor usa esta variable para calcular la Velocidad Equivalente.**

### 2.2. Cálculo de la Densidad del Aire Local (\(\rho\))
Usamos la ecuación de los gases ideales con los datos de Open-Meteo:
\[
 \rho = \frac{P_{surf}}{R_d \cdot T} 
\]
*   \(P_{surf}\): Presión superficial (`surface_pressure`) en Pascales (hPa * 100).
*   \(R_d\): Constante del aire seco = \(287.05 \, \text{J/(kg}\cdot\text{K)}\).
*   \(T\): Temperatura en Kelvin (`temperature_2m` + 273.15).

### 2.3. Normalización a Velocidad Equivalente (\(v_{eq}\))
Convertimos la ráfaga local a la velocidad que tendría a nivel del mar (donde \(\rho_0 = 1.225 \, \text{kg/m}^3\)):
\[
 v_{eq} = v_{gust} \cdot \sqrt{\frac{\rho}{\rho_0}} 
\]
*Esto elimina la discontinuidad de los umbrales rígidos por altitud.*

### 2.4. Suavizado Temporal (Smoothing) y Rugosidad
*   **Suavizado:** Se aplicará una media móvil de 3 horas a la serie de \(v_{eq}\) para eliminar picos de turbulencia de corta duración (ruido local) y detectar eventos sinópticos sostenidos.
*   **Factor de Ráfaga (\(G\)):** \(G = \frac{v_{gust}}{v_{speed}}\). Si \(G > 2.5\), indica alta cizalladura o convección (posible downburst).
*   **Rugosidad (Factor \(f_r\)):** Ajuste por el relieve (de `localidades.json`). Laderas y cumbres (\(f_r=1.1\)), Valles y Mesetas (\(f_r=1.0\)). El daño es mayor en zonas expuestas.

---

## 3. Lógica de Evaluación (Las 4 Reglas del Viento)

El módulo retornará un objeto con `nivel_alerta` (1 a 4) y un `diagnostico` detallado.

### Regla W1 — Calma / Viento Normal (N1)
- **Condición:** \(v_{eq} < 45 \, \text{km/h}\).
- **Diagnóstico:** "Vientos dentro de los parámetros normales para la zona."

### Regla W2 — Vigilancia por Viento Moderado (N2)
- **Condición:** \(45 \leq v_{eq} < 65 \, \text{km/h}\).
- **Diagnóstico:** "Vigilancia por Ráfagas Moderadas. Desprendimiento de ramas y objetos ligeros."
- **Acción:** "Asegurar láminas y techos endebles."

### Regla W3 — Alerta Temprana por Viento Fuerte (N3)
- **Condición:** \(65 \leq v_{eq} < 90 \, \text{km/h}\).
- **Diagnóstico:** "Alerta por Vientos Fuertes. Riesgo de caída de árboles, cortes de energía y daños a techos."
- **Acción:** "Suspender actividades al aire libre, reforzar techumbres."

### Regla W4 — Emergencia por Viento Destructivo (N4)
- **Condición:** \(v_{eq} \geq 90 \, \text{km/h}\).
- **Diagnóstico:** "Emergencia por Vientos Huracanados. Colapso estructural inminente."
- **Acción:** "Evacuación de estructuras ligeras, refugio en zonas sólidas."

---

## 4. Estructura del Objeto de Retorno (Contrato de Datos)

El `windEvaluator.js` debe retornar un objeto que incluya los datos físicos calculados para que SARA (la IA) pueda redactar mejor:

```javascript
{
  modulo: "wind",
  nivel_alerta: 3,             
  vector_dominante: "VIENTO_FUERTE", 
  diagnostico: {
    titulo: "Alerta por Vientos Fuertes (Ráfagas de 75 km/h)",
    causa: "Ráfagas de 75 km/h en Pachuca equivalen a 68 km/h a nivel del mar por la menor densidad del aire. Supera el umbral de alerta."
  },
  datos_tecnicos: {
    rafaga_real_kmh: 75.0,
    viento_sostenido_kmh: 35.0,
    factor_rafaga: 2.14,
    densidad_aire_kgm3: 0.95,
    velocidad_equivalente_kmh: 68.2,
    modelo_critico: "GFS"
  }
}

## 5. Estrategia de Testing (Vitest)

El módulo requiere tests que demuestren la superioridad de la física sobre los umbrales rígidos:

1. **Test de Densidad:** Calcular ρ en Pachuca (2400 m, ~0.95 kg/m³) y en Tulancingo (2100 m, ~1.0 kg/m³).
2. **Test de Normalización (El Fin del Bug):** Con la misma ráfaga (ej. 55 km/h), Pachuca debe dar un `v_eq` menor que Tulancingo, demostrando que la física reduce el riesgo en altura.
3. **Test de Calma (N1):** `v_eq` resultante < 45 km/h.
4. **Test de Alerta (N3):** Ráfaga de 80 km/h con `v_eq` > 65 km/h.
5. **Test de Factor de Ráfaga:** Si el viento sostenido es 10 y la ráfaga es 50, el factor es 5.0. Debe reflejarlo.
6. **Test de Faltantes:** Si falta `surface_pressure`, usar un fallback de densidad estándar (1.0 kg/m³) para no romper el runner.

## 6. Plan de Implementación (Para el desarrollador)

1. Crear `src/engine/windEvaluator.js` con la exportación `evaluarViento(localidad, serieHoraria)`.
2. Implementar el suavizado temporal (media móvil).
3. Implementar el cálculo de ρ y `v_eq`.
4. Implementar el factor de rugosidad según `localidad.topografia.relieve` y `pendiente_max_deg`.
5. Crear `src/engine/__tests__/windEvaluator.test.js` con los 6 casos mencionados.
6. Asegurar que `npm test` pase en verde (sin tocar `riskEvaluator.js`).

### 3.6. Clamp del nivel_alerta_continuo (H6.4a)

> **Implementado en:** 21/10/2026, durante H6.4a.
> **Bug detectado en:** auditoría empírica de H6.4.

**Síntoma:** `windEvaluator` emitía `nivel_alerta_continuo = 2.25` para localidades en N1 con `vEqFinal=47.6`. El `nivel_alerta` (discreto) era correcto (1), pero el continuo no.

**Causa:** las fórmulas de `nivelContinuo` no estaban clampeadas. Para N1 con `vEqFinal` alto, `1.0 + ((vEqFinal - 35) / 10) * 0.99` puede superar 2.0 sin que el nivel discreto cambie.

**Impacto:** el `crossThreatOrchestrator` usa `nivel_alerta_continuo` (no `nivel_alerta`) para calcular `Math.max(rH, rV, rT, rC)`. Un `rV=2.25` en N1 hacía que el orquestador tratara la localidad como N2. **47 localidades de Pachuca reportaban N2 falsos.**

**Fix:** aplicar `Math.min(1.99, ...)`, `Math.min(2.99, ...)`, `Math.min(3.99, ...)` a las 3 fórmulas. N1 nunca supera 1.99, N2 nunca supera 2.99, N3 nunca supera 3.99.

**Tests de blindaje:** tests 9 y 10 en `windEvaluator.test.js`.