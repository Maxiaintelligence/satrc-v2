/**
 * SatRC V2.0 — Generador de Dictamen Multivectorial
 * 
 * Traduce el nivel global y el vector dominante a un título operativo
 * para el banner de la Sala Operativa.
 */

// Tabla de mapeo: vector_dominante -> sustantivo operativo
const NOMBRES_VECTOR = {
  HIDROLOGICO:       "Lluvias y Deslaves",
  VIENTO:            "Vientos Fuertes",
  TERMICO:           "Frío/Calor Extremo",
  CONVECTIVO:        "Tormentas Severas",
  HIDRO_VIENTO:      "Lluvia y Viento (Árboles Caídos)",
  CONVECTIVO_VIENTO: "Downburst y Rachas Descendentes",
  HIDRO_TERMICO:     "Lluvia y Frío (Vías Congeladas)",
  SIN_AMENAZA:       "Condiciones Normales"
};

// Prefijos por nivel
const PREFIJOS_NIVEL = {
  1: "Situación de Calma",
  2: "Vigilancia",
  3: "Alerta Temprana",
  4: "Emergencia"
};

/**
 * Genera el título del dictamen.
 * @param {number} nivelGlobal - Nivel de alerta global (1 a 4).
 * @param {string} vectorDominante - Vector dominante (ej. "CONVECTIVO_VIENTO").
 * @returns {string} Título operativo.
 */
export function generarTituloDictamen(nivelGlobal, vectorDominante) {
  if (nivelGlobal === 1) {
    return "Situación Diocesana de Calma";
  }
  
  const prefijo = PREFIJOS_NIVEL[nivelGlobal] || "Aviso";
  const fenomeno = NOMBRES_VECTOR[vectorDominante] || "Condiciones Meteorológicas Complejas";
  
  return `${prefijo} por ${fenomeno}`;
}