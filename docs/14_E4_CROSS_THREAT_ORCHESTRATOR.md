# SatRC V2.0 — Orquestador Multiamenaza e Intersección de Riesgos (Nivel Ingeniería)

> **Hito:** Etapa 4 (E4-H4)
> **Archivo de Producción:** `src/engine/crossThreatOrchestrator.js`
> **Archivo de Tests:** `src/engine/__tests__/crossThreatOrchestrator.test.js`
> **Dependencia:** `riskEvaluator.js`, `windEvaluator.js`, `thermalEvaluator.js`, `convectiveEvaluator.js`.

## 1. Propósito y el Fracaso del "Máximo Aislado"

Hasta ahora, un sistema tradicional evalúa las amenazas de forma aislada: si hay Lluvia N2 y Viento N2, reporta N2 (`Math.max`). Esto asume una superposición lineal, lo cual es físicamente incorrecto.

En la naturaleza, el impacto de dos amenazas moderadas simultáneas **no se suma, se multiplica**. Un suelo blando (N2 de lluvia) más un viento moderado (N2) resulta en la caída de árboles (N3). Esto se conoce como **Riesgo Compuesto o Acoplamiento No Lineal**.

**La Solución:** Un Orquestador Continuo que toma los valores de riesgo (en escala decimal) de los 4 módulos especialistas, aplica un término de interacción matemático y calcula el nivel de emergencia real, eliminando los saltos bruscos (Step-Function Artifact) de los típicos `if/else`.

## 2. Fundamento Físico y Matemático (El Modelo Continuo)

Cada uno de los 4 módulos especialistas (`riskEvaluator`, `windEvaluator`, `thermalEvaluator`, `convectiveEvaluator`) debe retornar ahora un **valor continuo** de riesgo ($r$), escalado de 1.0 a 4.0, además del nivel discreto entero.

El Orquestador calcula el Riesgo Final ($R_{orquestado}$) combinando el nivel base con el acoplamiento cruzado:

$$R_{orquestado} = \max(r_H, r_V, r_T, r_C) + \sum_{i \neq j} \gamma_{ij} \cdot (r_i - 1) \cdot (r_j - 1)$$

Donde:

- $r_H, r_V, r_T, r_C$ son los riesgos continuos de Hidrología, Viento, Térmico y Convectivo.
- $\gamma_{ij}$ es la **Matriz de Coeficientes de Acoplamiento**. Representa la vulnerabilidad del entorno físico. Por ejemplo, $\gamma_{Hidro, Viento} = 0.15$ significa que la combinación de agua y viento incrementa el riesgo en un 15% de su producto.
- $(r_i - 1)$ es el exceso de riesgo sobre la línea base (Nivel 1), ya que el Nivel 1 (Calma) no aporta energía destructiva al sistema.

### 2.1. Matriz de Coeficientes ($\gamma$)

| Amenaza A | Amenaza B | Escenario Físico | Coeficiente $\gamma$ |
| :--- | :--- | :--- | :--- |
| **Hidrología** | **Viento** | Suelo saturado + Viento = Árboles caídos. | 0.15 |
| **Convectivo** | **Viento** | Tormenta + Cizalladura = Downbursts. | 0.25 |
| **Hidrología** | **Térmico** | Lluvia + Frío = Vías Congeladas. | 0.10 |
| **Térmico** | **Hidrología** | Calor + Sequía = Estrés hídrico. | 0.05 |

*(Nota: Estos valores gamma se pueden ajustar en el futuro basados en datos empíricos).*

---

## 3. Lógica de Evaluación (El Algoritmo)

El Orquestador no tiene reglas condicionales rígidas. Sigue estos pasos:

1. **Recolectar:** Obtener el nivel continuo ($r$) y discreto ($N$) de los 4 módulos.
2. **Nivel Base:** Calcular `Math.max(r_H, r_V, r_T, r_C)`.
3. **Acoplamiento:** Iterar sobre la matriz de pares para sumar las interacciones usando la fórmula de Richardson.
4. **Normalización:** Si el resultado supera 4.0, se topa a 4.0.
5. **Mapeo Final:** Convertir el resultado continuo a un entero de 1 a 4 para el semáforo público usando `Math.round()`.

```javascript
// Ejemplo Conceptual
const rHidro = 2.1; // Lluvia en vigilancia alta
const rViento = 2.2; // Viento en vigilancia alta
const rTermico = 1.0; // Clima normal
const rConvectivo = 1.0; // Cielo estable

let R = Math.max(rHidro, rViento); // R = 2.2

// Acoplamiento Hidro-Viento
const gamma_HidroViento = 0.15;
const excesoH = rHidro - 1.0; // 1.1
const excesoV = rViento - 1.0; // 1.2
R += gamma_HidroViento * (excesoH * excesoV); // 2.2 + 0.15 * (1.1 * 1.2) = 2.398

// Mapeo a semáforo
const nivelFinal = Math.min(4, Math.round(R)); // Math.round(2.398) = Nivel 2
```

> **Nota:** Si usamos el mismo cálculo con lluvia y viento en 2.8, el acoplamiento dará 3.21, disparando Alerta Temprana (N3).

---

## 4. Estructura del Objeto de Retorno (Contrato de Datos)

```javascript
{
  modulo: "orchestrator",
  nivel_alerta_global: 3,         // Discreto (1-4)
  riesgo_continuo: 3.12,          // El valor real calculado
  vector_dominante: "HIDRO_VIENTO",
  niveles_por_vector: {
    hidrologico: 2.1,
    viento: 2.8,
    termico: 1.0,
    convectivo: 1.0
  },
  diagnostico: {
    titulo: "Alerta por Caída de Árboles y Cortes Viales",
    causa: "La lluvia (2.1) y el viento (2.8) han interactuado. El suelo saturado y las ráfagas fuertes elevan el riesgo por acoplamiento a 3.12 (Alerta Temprana)."
  },
  acciones_operativas: [
    "Restringir circulación en caminos de terracería.",
    "Reportar caída de árboles a Protección Civil."
  ]
}
```

---

## 5. Estrategia de Testing (Vitest)

Los tests deben verificar que el acoplamiento continuo supere las limitaciones del `Math.max`:

1. **Test de Calma Total:** Todos los módulos dan 1.0 → Global 1.0.
2. **Test de Máximo Individual:** Hidro 3.0, el resto 1.0 → Global 3.0 (sin acoplamiento).
3. **Test de Intersección Suave:** Hidro 2.2, Viento 2.2 → Global debe ser mayor a 2.2 (por el acoplamiento), pero menor a 3.0 (redondeo a N2).
4. **Test de Frontera (El Bug del 1.99 vs 2.00):** Hidro 1.99, Viento 1.99. Con la fórmula continua, el resultado superará 2.0, activando el Nivel 2 suavemente (sin el salto brusco del `if`).
5. **Test de Intersección Crítica:** Hidro 2.8, Viento 2.8 → Global superará 3.0, activando N3.
6. **Test de Downburst (Convectivo + Viento):** Convectivo 3.0, Viento 2.5 → Global debe superar 3.5 (por el alto $\gamma$ del downburst).

## 6. Plan de Implementación

1. **Refactorización previa (Requisito):** Asegurarse de que los módulos Hidro, Viento, Térmico y Convectivo retornen `nivel_alerta_continuo` (ej. 2.3) y no solo el entero.
2. Crear `src/engine/crossThreatOrchestrator.js` con la exportación `evaluarMultiamenaza(localidad, serieHoraria, contexto)`.
3. Implementar el cálculo de la suma no lineal y el mapeo a semáforo.
4. Crear `src/engine/__tests__/crossThreatOrchestrator.test.js`.
5. Asegurar que `npm test` pase en verde.