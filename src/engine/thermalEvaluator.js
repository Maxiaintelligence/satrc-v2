/**
 * SatRC V2.0 — Módulo de Evaluación Térmica
 * Basado en la termodinámica de Richardson: Sensación Térmica,
 * Grass Minimum (heladas radiativas), Bulbo Húmedo (nevadas) y Sigmoides.
 */

/**
 * Función sigmoide para transiciones suaves (evita saltos bruscos).
 * Retorna un valor entre 0 y 1.
 */
function sigmoide(x, centro, pendiente) {
  return 1 / (1 + Math.exp(-pendiente * (x - centro)));
}

/**
 * Calcula la temperatura estimada de la superficie (Grass Minimum).
 * En noches despejadas y sin viento, la superficie se enfría 3.5°C más que el aire a 2m.
 * En noches nubladas o con viento, no hay inversión térmica significativa.
 */
function estimarTemperaturaSuperficie(tempAire, coberturaNubosa, viento) {
  const esCieloDespejado = coberturaNubosa < 20;
  const esVientoCalmo = viento < 10;
  
  // Si hay nubes o viento, la superficie se mezcla con el aire y no se enfría tanto
  if (!esCieloDespejado || !esVientoCalmo) return tempAire;
  
  // Inversión térmica por radiación: -3.5°C estimados
  return tempAire - 3.5;
}

/**
 * Evalúa el riesgo térmico de una localidad.
 * 
 * @param {Object} localidad - Datos topográficos (altitud, relieve).
 * @param {Object} serieHoraria - Arrays de variables meteorológicas.
 * @returns {Object} Resultado con nivel_alerta, vector_dominante y diagnóstico.
 */
export function evaluarTermico(localidad, serieHoraria) {
  const altitud = localidad.topografia.altitud_msnm || 2000;
  
  // Fallback seguro si no hay datos
  if (!serieHoraria || !serieHoraria.temperatura_c || !serieHoraria.sensacion_termica_c) {
    return {
      modulo: "termico",
      nivel_alerta: 1,
      nivel_alerta_continuo: 1.0,
      vector_dominante: "TERMICO_NORMAL",
      diagnostico: { titulo: "Sin datos térmicos", causa: "Faltan datos en la serie." }
    };
  }

  // 1. Extraer la ventana de evaluación (próximas 24h = índices 168 a 192)
  const idxInicio = serieHoraria.time ? Math.min(168, serieHoraria.time.length - 24) : 0;
  const ventana = (arr) => arr ? arr.slice(idxInicio, idxInicio + 24) : [];
  
  const temps = ventana(serieHoraria.temperatura_c);
  const sensaciones = ventana(serieHoraria.sensacion_termica_c);
  const nubosidad = ventana(serieHoraria.cobertura_nubosa_pct);
  const vientos = ventana(serieHoraria.viento_kmh);
  const bulboHumedo = ventana(serieHoraria.bulbo_humedo_c);
  const lluvia = ventana(serieHoraria.lluvia_mm);
  const nivelesCongelacion = ventana(serieHoraria.nivel_congelacion_m);

  if (temps.length === 0) {
    return {
      modulo: "termico",
      nivel_alerta: 1,
      nivel_alerta_continuo: 1.0,
      vector_dominante: "TERMICO_NORMAL",
      diagnostico: { titulo: "Ventana vacía", causa: "Sin datos para las próximas 24h." }
    };
  }

  // 2. Estadísticos de la ventana
  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const sensacionMin = Math.min(...sensaciones);
  const sensacionMax = Math.max(...sensaciones);
  const nubosidadProm = nubosidad.reduce((a, b) => a + b, 0) / nubosidad.length;
  const vientoProm = vientos.reduce((a, b) => a + b, 0) / vientos.length;
  const bulboMin = Math.min(...bulboHumedo);
  const lluviaTotal = lluvia.reduce((a, b) => a + b, 0);
  const nivelesValidos = nivelesCongelacion.filter(n => n != null);
  const nivelCongelacionMin = nivelesValidos.length ? Math.min(...nivelesValidos) : null;

  // 3. Evaluación de Riesgos por Frío
  let nivelFrio = 1;
  let tituloFrio = "";
  let causaFrio = "";

  // Hipotermia por Sensación Térmica
  if (sensacionMin < -5) {
    nivelFrio = 3;
    tituloFrio = "Alerta por Frío Extremo";
    causaFrio = `Sensación térmica de ${sensacionMin.toFixed(1)}°C. Riesgo severo de hipotermia.`;
  } else if (sensacionMin < 0) {
    nivelFrio = 2;
    tituloFrio = "Vigilancia por Frío";
    causaFrio = `Sensación térmica de ${sensacionMin.toFixed(1)}°C. Riesgo de hipotermia en población vulnerable.`;
  }

  // Helada Agrícola (Grass Minimum)
  const tempSuperficie = estimarTemperaturaSuperficie(tempMin, nubosidadProm, vientoProm);
  if (tempSuperficie < 0 && nivelFrio < 3) {
    nivelFrio = 3;
    tituloFrio = "Alerta por Helada Agrícola";
    causaFrio = `Temperatura estimada en superficie: ${tempSuperficie.toFixed(1)}°C (aire a 2m: ${tempMin.toFixed(1)}°C). Riesgo para cultivos.`;
  }

  // Nevada (Bulbo Húmedo)
  const esNevada = lluviaTotal > 0 && bulboMin < 1.0 && 
                    (nivelCongelacionMin - altitud) < 500;
  if (esNevada && nivelFrio < 3) {
    nivelFrio = 3;
    tituloFrio = "Alerta por Nevada";
    causaFrio = `Precipitación con bulbo húmedo de ${bulboMin.toFixed(1)}°C y nivel de congelación a ${(nivelCongelacionMin - altitud).toFixed(0)}m de la localidad.`;
  }

  // 4. Evaluación de Riesgos por Calor
  let nivelCalor = 1;
  let tituloCalor = "";
  let causaCalor = "";

  if (sensacionMax > 42) {
    nivelCalor = 3;
    tituloCalor = "Alerta por Calor Extremo";
    causaCalor = `Sensación térmica de ${sensacionMax.toFixed(1)}°C. Riesgo de golpe de calor inminente.`;
  } else if (sensacionMax > 35) {
    nivelCalor = 2;
    tituloCalor = "Vigilancia por Estrés Térmico";
    causaCalor = `Sensación térmica de ${sensacionMax.toFixed(1)}°C. Estrés térmico en la población.`;
  }

  // 5. Cálculo Continuo con Sigmoides (para el Orquestador)
  // Peso del frío: 1 si sensación <= -5, 0 si >= 15
  const pesoFrio = 1 - sigmoide(sensacionMin, 5, 0.3); // Centro en 5°C
  // Peso del calor: 0 si sensación <= 25, 1 si >= 42
  const pesoCalor = sigmoide(sensacionMax, 30, 0.3);   // Centro en 30°C

  // Nivel continuo ponderado
  let nivelContinuo = 1.0;
  if (nivelFrio > 1) {
    nivelContinuo = 1.0 + (nivelFrio - 1) * pesoFrio;
  } else if (nivelCalor > 1) {
    nivelContinuo = 1.0 + (nivelCalor - 1) * pesoCalor;
  }

  // 6. Determinar vector dominante y diagnóstico final
  let nivelFinal = 1;
  let vectorDominante = "TERMICO_NORMAL";
  let titulo = "Condiciones Térmicas Normales";
  let causa = `Temperaturas entre ${tempMin.toFixed(1)}°C y ${tempMax.toFixed(1)}°C. Sensación entre ${sensacionMin.toFixed(1)}°C y ${sensacionMax.toFixed(1)}°C.`;

  if (nivelFrio >= nivelCalor && nivelFrio > 1) {
    nivelFinal = nivelFrio;
    vectorDominante = tituloFrio.includes("Nevada") ? "NEVADA" : 
                       (tituloFrio.includes("Helada") ? "HELADA_AGRICOLA" : "FRIO_EXTREMO");
    titulo = tituloFrio;
    causa = causaFrio;
  } else if (nivelCalor > nivelFrio && nivelCalor > 1) {
    nivelFinal = nivelCalor;
    vectorDominante = "CALOR_EXTREMO";
    titulo = tituloCalor;
    causa = causaCalor;
  }

  return {
    modulo: "termico",
    nivel_alerta: nivelFinal,
    nivel_alerta_continuo: parseFloat(Math.min(4, nivelContinuo).toFixed(2)),
    vector_dominante: vectorDominante,
    diagnostico: { titulo, causa },
    datos_tecnicos: {
      temp_min_c: parseFloat(tempMin.toFixed(1)),
      temp_max_c: parseFloat(tempMax.toFixed(1)),
      sensacion_min_c: parseFloat(sensacionMin.toFixed(1)),
      sensacion_max_c: parseFloat(sensacionMax.toFixed(1)),
      temp_superficie_estimada_c: parseFloat(tempSuperficie.toFixed(1)),
      nubosidad_prom_pct: parseFloat(nubosidadProm.toFixed(0)),
      viento_prom_kmh: parseFloat(vientoProm.toFixed(1)),
      bulbo_humedo_min_c: parseFloat(bulboMin.toFixed(1)),
      es_nevada: esNevada,
      peso_frio: parseFloat(pesoFrio.toFixed(2)),
      peso_calor: parseFloat(pesoCalor.toFixed(2))
    }
  };
}