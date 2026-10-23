# SatRC V2.0 — Adaptador Hidrológico Continuo (Nivel Ingeniería)

> **Hito:** Etapa 4 (E4-H5)
> **Archivo de Producción:** `src/engine/hydroAdapter.js`
> **Archivo de Tests:** `src/engine/__tests__/hydroAdapter.test.js`
> **Dependencia:** `riskEvaluator.js` (motor actual) y `localidades.json`.

## 1. Propósito y Justificación Técnica

El motor hidrológico actual (`riskEvaluator.js`) es físicamente robusto, pero su salida es discreta (N1, N2, N3, N4) y usa umbrales rígidos (ej. `saturacion >= 65.0`). Esto genera dos problemas:

1. **Salto de Borde:** Un cambio de 64.9 mm a 65.0 mm cambia el semáforo de N3 a N4 bruscamente.
2. **Incompatibilidad con el Orquestador:** El Orquestador Multiamenaza necesita valores continuos para calcular el acoplamiento no lineal (Fórmula de Richardson).

**Intento Fallido (Open-Meteo):** Se comprobó empíricamente que Open-Meteo no devuelve la variable `soil_moisture` para la región (devuelve `null`). Por lo tanto, **no podemos reemplazar el cálculo de saturación**.

**La Solución:** Un Adaptador que toma el resultado del motor actual y calcula la **proximidad al umbral** para generar un nivel de riesgo continuo (ej. N3.8) que el Orquestador pueda usar.

## 2. Fundamento Matemático (El Suavizado Sigmoide)

El adaptador implementa una función de transición suave basada en la distancia al umbral crítico.

- Para el **Deslave Crítico (N4)**, el umbral es `saturacion >= 65.0`.
- Calculamos un factor de proximidad $P$:

$$P = \frac{1}{1 + e^{-0.5 \cdot (\text{saturacion} - 62.0)}}$$

- Si `saturacion` es 50, $P \approx 0$ (lejos del umbral).
- Si `saturacion` es 64.9, $P \approx 0.81$ (muy cerca del umbral, riesgo inminente).

El adaptador ajusta el nivel continuo:

- Si el motor da N3 pero $P > 0.8$, el adaptador devuelve **3.8** (N3 muy alto, casi N4).
- Si el motor da N3 pero $P < 0.2$, devuelve **3.1** (N3 recién activado).

## 3. Lógica del Adaptador (Código Conceptual)

```javascript
export function adaptarHidrologia(localidad, serieHoraria, contexto) {
    // 1. Ejecutar el motor original (INTACTO)
    const resOriginal = evaluarLocalidad(localidad, serieHoraria, contexto);

    // 2. Extraer variables físicas
    const saturacion = resOriginal.impactoSistemico.saturacionTotalSueloMm;
    const pendiente = localidad.topografia.pendiente_max_deg || 0;

    // 3. Calcular factor de proximidad al umbral de 65mm
    let nivelContinuo = resOriginal.nivel_alerta;

    if (resOriginal.nivel_alerta === 3 && pendiente >= 25) {
        // Si está en N3 por deslave, evaluar proximidad a N4 (umbral 65mm)
        const proximidad = 1 / (1 + Math.exp(-0.5 * (saturacion - 62.0)));
        nivelContinuo = 3.0 + (proximidad * 0.9); // Escala de 3.0 a 3.9
    } else if (resOriginal.nivel_alerta === 4) {
        nivelContinuo = 4.0; // Si ya es N4, se queda en 4.0
    }

    return {
        ...resOriginal, // Preservar todo el diagnóstico original
        nivel_alerta_continuo: parseFloat(nivelContinuo.toFixed(2)),
        modulo: "hidrologico"
    };
}
```

## 4. Estrategia de Testing (Vitest)

1. **Test de Mantenimiento (N1):** Localidad sin lluvia → Nivel 1.0.
2. **Test de Proximidad (N3.1):** Saturación de 30 mm, pendiente 30° → Nivel 3.1 (recién entra a N3).
3. **Test de Alerta Inminente (N3.9):** Saturación de 64.5 mm, pendiente 30° → Nivel 3.9 (a punto de ser N4).
4. **Test de Emergencia (N4.0):** Saturación de 70 mm, pendiente 50° → Nivel 4.0.
5. **Test de Preservación:** Verificar que el objeto de retorno conserva el `diagnostico`, `donde` e `impactoSistemico` del motor original.

## 5. Plan de Implementación

1. Crear `src/engine/hydroAdapter.js` importando `evaluarLocalidad` de `riskEvaluator.js`.
2. Implementar la lógica de proximidad sigmoide.
3. Crear `src/engine/__tests__/hydroAdapter.test.js`.
4. `npm test` debe pasar (sin romper los 79 tests existentes).