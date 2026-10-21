# SatRC V2.0 — Orquestador Multiamenaza e Intersección de Riesgos (Nivel Ingeniería)

| Campo | Detalle |
|---|---|
| **Hito** | Etapa 4 (E4-H4) |
| **Archivo de producción** | `src/engine/crossThreatOrchestrator.js` |
| **Archivo de tests** | `src/engine/__tests__/crossThreatOrchestrator.test.js` |
| **Dependencias** | `riskEvaluator.js` (Hidrología), `windEvaluator.js`, `thermalEvaluator.js`, `convectiveEvaluator.js` |

---

## 1. Propósito y Problema a Resolver

Hasta ahora, un sistema de alerta tradicional evalúa las amenazas de forma aislada. Si hay lluvia Nivel 2 y viento Nivel 2, el sistema reporta "Nivel 2" (el máximo).

**El problema:** el impacto real en la población no es lineal. Una lluvia moderada (N2) combinada con vientos moderados (N2) **no da como resultado un N2**, da como resultado **árboles caídos sobre caminos de terracería (N3)**. Los suelos están blandos por la lluvia y el viento derriba los árboles con facilidad. Esto es lo que en Protección Civil se llama **riesgo compuesto** o **intersección de amenazas**.

**La solución:** un orquestador que ejecuta los 4 módulos especialistas (Hidrología, Viento, Térmico, Convectivo), evalúa las intersecciones críticas de la matriz y determina el nivel de emergencia final.

---

## 2. Fundamento Lógico y Matemático

### 2.1 El Nivel Base (el máximo individual)

El sistema primero calcula el nivel de cada vector especialista:

```javascript
let nivelGlobal = Math.max(nivelHidro, nivelViento, nivelTermico, nivelConvectivo);
let vectorDominante = /* El vector que tenga el nivel más alto */;
```

### 2.2 La Matriz de Intersección (el salto a Nivel 4)

Si el `nivelGlobal` base es menor a 4, el orquestador aplica la matriz de cruce para detectar sinergias destructivas:

| Amenaza A | Amenaza B | Escenario físico combinado | Nivel forzado |
|---|---|---|---|
| Hidrología (N2) | Viento (N2) | Suelo blando + ráfagas = árboles caídos en caminos de terracería | **N3** (Corte Vial) |
| Hidrología (N2) | Térmico Frío (N2) | Lluvia + temperatura < 2 °C = aguanieve o hielo en la carpeta asfáltica | **N3** (Vías Congeladas) |
| Convectivo (N3) | Viento (N2) | Tormenta severa + ráfagas = *downburst* (rachas descendentes) | **N4** (Emergencia) |
| Térmico Calor (N2) | Hidrología (N1) | Calor extremo sin lluvia durante días = estrés hídrico en aljibes y riesgo de incendios | **N2** (Sequía Operativa) |

> **Nota:** para forzar un N4 por *downburst* se requiere que el módulo Convectivo sea N3 y que el Viento (ráfagas) sea al menos N2.

---

## 3. Lógica de Evaluación (el Algoritmo)

El orquestador no calcula física desde cero; importa los resultados de los 4 módulos y aplica la lógica de intersección.

```javascript
// 1. Ejecutar los 4 motores
const resHidro = evaluarLocalidad(loc, serie, context); // El motor actual
const resViento = evaluarViento(loc, serie);
const resTermico = evaluarTermico(loc, serie);
const resConvectivo = evaluarConvectivo(loc, serie);

// 2. Nivel base (el más alto)
let nivelGlobal = Math.max(
  resHidro.nivel_alerta,
  resViento.nivel_alerta,
  resTermico.nivel_alerta,
  resConvectivo.nivel_alerta
);
let vectorDominante = "HIDROLOGICO"; // Se actualiza al que tenga el nivel más alto

// 3. Intersección de amenazas (Cross-Threat)

// ESCENARIO A: Lluvia + Viento = Corte Vial Severo
if (resHidro.nivel_alerta >= 2 && resViento.nivel_alerta >= 2 && nivelGlobal < 3) {
  nivelGlobal = 3;
  vectorDominante = "HIDRO_VIENTO";
  diagnostico.titulo = "Alerta por Caída de Árboles y Cortes Viales";
  diagnostico.causa = "Suelo saturado por lluvia y ráfagas fuertes de viento.";
}

// ESCENARIO B: Convectivo + Viento = Downburst (N4)
if (resConvectivo.nivel_alerta >= 3 && resViento.nivel_alerta >= 2) {
  nivelGlobal = 4;
  vectorDominante = "DOWNBURST";
  diagnostico.titulo = "Emergencia por Rachas Descendentes de Tormenta";
  diagnostico.causa = "Inestabilidad extrema (CAPE alto) con ráfagas destructivas.";
}

// ESCENARIO C: Lluvia + Frío = Vías Congeladas (N3)
if (
  resHidro.nivel_alerta >= 2 &&
  resTermico.tipo_amenaza === 'FRIO' &&
  resTermico.datos_tecnicos.temp_real_c <= 2.0
) {
  nivelGlobal = 3;
  vectorDominante = "HIDRO_FRIO";
  diagnostico.titulo = "Alerta por Lluvia Helada y Vías Congeladas";
  diagnostico.causa = "Precipitación con temperaturas bajo cero.";
}
```

---

## 4. Estructura del Objeto de Retorno (el Nuevo Contrato)

Este es el objeto final que se guardará en el Blob y leerán el frontend y SARA. Es el reemplazo directo del objeto que genera hoy `riskEvaluator.js`.

```javascript
{
  localidad_id: "PMN_PACHUCA_173",
  nombre: "Pachuca de Soto",
  nivel_alerta_global: 3,
  vector_dominante: "HIDRO_VIENTO",
  estado_alerta: "ALERTA_TEMPRANA",
  niveles_por_vector: {
    hidrologico: 2,  // Lluvia moderada
    viento: 2,       // Ráfagas moderadas
    termico: 1,      // Clima normal
    convectivo: 1    // Sin tormenta
  },
  diagnostico: {
    titulo: "Alerta por Caída de Árboles y Cortes Viales",
    causa: "El suelo saturado por lluvia y las ráfagas fuertes de viento generan riesgo de caída de árboles sobre caminos de terracería."
  },
  impactoSistemico: {
    /* Datos del motor hidrológico actual */
  },
  acciones_operativas: [
    "Restringir circulación en caminos de terracería.",
    "Reportar caída de árboles a Protección Civil."
  ]
}
```

---

## 5. Estrategia de Testing (Vitest)

El orquestador es el cerebro, por lo que los tests deben validar que el todo es mayor que la suma de las partes.

| # | Test | Entrada | Resultado esperado |
|---|---|---|---|
| 1 | Calma total | Hidro, Viento, Térmico y Convectivo en N1 | Global N1 |
| 2 | Máximo individual | Solo Hidrología en N3 | Global N3 |
| 3 | Intersección 1 (Hidro + Viento) | Hidro N2 y Viento N2 | Global N3 (cruce activado) |
| 4 | Intersección 2 (Convectivo + Viento) | Convectivo N3 y Viento N3 | Global N4 (*downburst* activado) |
| 5 | Intersección 3 (Hidro + Frío) | Hidro N2 y Térmico N2 (temp < 2 °C) | Global N3 (vías congeladas) |
| 6 | No-intersección (falsa alarma) | Hidro N2 y Térmico N1 | Global N2 (no cruza a N3: no hay amenaza térmica) |

---

## 6. Plan de Implementación (para el desarrollador)

1. Crear `src/engine/crossThreatOrchestrator.js` con la exportación `evaluarMultiamenaza(localidad, serieHoraria, contexto)`.
2. Importar los 4 módulos (`riskEvaluator`, `windEvaluator`, `thermalEvaluator`, `convectiveEvaluator`).
3. Implementar la lógica de `Math.max` y la matriz de intersección.
4. Mapear el objeto final para que cumpla con el contrato de Zod (`EstadoDiocesanoSchema`).
5. Crear `src/engine/__tests__/crossThreatOrchestrator.test.js`.
6. *(Hito final)* Reemplazar la llamada a `evaluarLocalidad` en el runner y en el frontend por `evaluarMultiamenaza`.