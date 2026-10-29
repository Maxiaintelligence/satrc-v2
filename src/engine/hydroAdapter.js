/**
 * SatRC V2.0 — Adaptador Hidrológico Continuo
 * Envuelve al riskEvaluator.js original para suavizar el "Salto de Borde"
 * usando una función sigmoide. NO modifica el motor original.
 */

import { evaluarLocalidad } from './riskEvaluator.js';

/**
 * Función sigmoide para suavizar la transición.
 */
function sigmoide(x, centro, pendiente) {
  return 1 / (1 + Math.exp(-pendiente * (x - centro)));
}

/**
 * Evalúa el riesgo hidrológico usando el motor original y aplica suavizado.
 * 
 * @param {Object} localidad - Objeto de localidad con topografía.
 * @param {Array} serieHoraria - Serie de consenso de la zona.
 * @param {Object} contexto - Contexto (ej. alertaSMN).
 * @returns {Object} Resultado con nivel_alerta_continuo y preservación del diagnóstico.
 */
export function evaluarHidrologico(localidad, serieHoraria, contexto = {}) {
  // 1. Ejecutar el motor original (INTACTO)
  const resOriginal = evaluarLocalidad(localidad, serieHoraria, contexto);

  // 2. Extraer variables físicas
  const saturacion = resOriginal.impactoSistemico?.saturacionTotalSueloMm || 0;
  const pendiente = localidad.topografia.pendiente_max_deg || 0;

  // 3. Calcular el nivel continuo
  let nivelContinuo = resOriginal.nivel_alerta;

  // Si está en N3 por deslave, evaluar proximidad a N4 (umbral 65mm)
  if (resOriginal.nivel_alerta === 3 && pendiente >= 25 && saturacion > 30) {
    // La sigmoide se centra en 62mm para dar un margen de 3mm antes del umbral crítico (65mm)
    // Si saturacion = 62, la sigmoide da 0.5 → nivelContinuo = 3.45
    // Si saturacion = 64.9, la sigmoide da 0.81 → nivelContinuo = 3.73
    // Si saturacion = 65.0, la sigmoide da 0.82 → nivelContinuo = 3.74 (casi N4)
    const proximidad = sigmoide(saturacion, 62.0, 0.5);
    nivelContinuo = 3.0 + (proximidad * 0.99);
  } 
  // Si está en N2 por vigilancia, evaluar proximidad a N3 (umbral 50mm para corte vial)
  else if (resOriginal.nivel_alerta === 2 && saturacion > 20) {
    const proximidad = sigmoide(saturacion, 45.0, 0.3);
    nivelContinuo = 2.0 + (proximidad * 0.99);
  }
  // Si ya es N4, se queda en 4.0
  else if (resOriginal.nivel_alerta === 4) {
    nivelContinuo = 4.0;
  }

  // N-MOTOR-16: el campo proximidad_umbral_n4 solo tiene sentido cuando la sigmoide
  // de N3 se aplicó al nivel continuo. En N1/N2/N4 se reporta null.
  // Condición idéntica al if de la línea 36.
  const proximidadSoloN3 = resOriginal.nivel_alerta === 3 && pendiente >= 25 && saturacion > 30
    ? parseFloat(sigmoide(saturacion, 62.0, 0.5).toFixed(2))
    : null;

  // 4. Retornar el objeto preservando todo el diagnóstico original
  return {
    ...resOriginal,
    modulo: "hidrologico",
    nivel_alerta_continuo: parseFloat(nivelContinuo.toFixed(2)),
    datos_tecnicos: {
      saturacion_suelo_mm: parseFloat(saturacion.toFixed(1)),
      pendiente_grados: parseFloat(pendiente.toFixed(1)),
      proximidad_umbral_n4: proximidadSoloN3
    }
  };
}