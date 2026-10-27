/**
 * SatRC V2.0 — Módulo de Evaluación Convectiva
 * Basado en la física de Richardson: CAPE, Humedad en capas medias,
 * Espesor de capa de fusión (granizo) y Potencial de Downburst.
 */

/**
 * Función sigmoide para transiciones suaves del CAPE.
 * Retorna un valor entre 0 y 1.
 */
function sigmoide(x, centro, pendiente) {
  return 1 / (1 + Math.exp(-pendiente * (x - centro)));
}

/**
 * Evalúa el riesgo convectivo de una localidad.
 * 
 * @param {Object} localidad - Datos topográficos.
 * @param {Object} serieHoraria - Arrays de variables meteorológicas.
 * @returns {Object} Resultado con nivel_alerta, vector_dominante y diagnóstico.
 */
export function evaluarConvectivo(localidad, serieHoraria) {
  const altitud = localidad.topografia.altitud_msnm || 2000;

  // Fallback seguro si faltan datos críticos
  if (!serieHoraria || !serieHoraria.cape_jkg || !serieHoraria.nivel_congelacion_m) {
    return {
      modulo: "convectivo",
      nivel_alerta: 1,
      nivel_alerta_continuo: 1.0,
      vector_dominante: "CONVECTIVO_NORMAL",
      diagnostico: { titulo: "Sin datos convectivos", causa: "Faltan datos en la serie." }
    };
  }

  // 1. Extraer ventana de evaluación (próximas 24h)
  const idxInicio = serieHoraria.time ? Math.min(168, serieHoraria.time.length - 24) : 0;
  const ventana = (arr) => arr ? arr.slice(idxInicio, idxInicio + 24) : [];

  const capes = ventana(serieHoraria.cape_jkg);
  const humedades = ventana(serieHoraria.humedad_700hpa);
  const lluvias = ventana(serieHoraria.lluvia_mm);
  const nivelesCongelacion = ventana(serieHoraria.nivel_congelacion_m);
  const vientos700 = ventana(serieHoraria.viento_700hpa);
  const vientos10m = ventana(serieHoraria.viento_kmh);

  if (capes.length === 0 || lluvias.length === 0) {
    return {
      modulo: "convectivo",
      nivel_alerta: 1,
      nivel_alerta_continuo: 1.0,
      vector_dominante: "CONVECTIVO_NORMAL",
      diagnostico: { titulo: "Ventana vacía", causa: "Sin datos para las próximas 24h." }
    };
  }

  // 2. Estadísticos de la ventana
  const capeMax = Math.max(...capes, 0);
  const humedadMin = Math.min(...humedades, 100);
  const lluviaTotal = lluvias.reduce((a, b) => a + b, 0);
  const nivelesValidos = nivelesCongelacion.filter(n => n != null);
  const nivelCongelacionMin = nivelesValidos.length ? Math.min(...nivelesValidos) : null;

  // 3. Cálculo del Espesor de la Capa de Fusión (Granizo)
  // El granizo llega intacto si la capa cálida entre el nivel de congelación y el suelo es delgada.
  const espesorFusion = nivelCongelacionMin - altitud;
  const hayRiesgoGranizo = capeMax > 1000 && espesorFusion < 1000 && lluviaTotal > 5;

  // 4. Cálculo del Potencial de Downburst
  // Si el aire en capas medias es seco, la lluvia se evapora, enfría la masa y se desploma.
  const potencialDesplome = capeMax * (100 - humedadMin) / 100;

  // 5. Cálculo de la Cizalladura Vertical (Wind Shear)
  // Diferencia entre el viento a 700hPa (~3km) y el viento en superficie (10m)
  let shearMax = 0;
  for (let i = 0; i < vientos700.length; i++) {
    const diff = (vientos700[i] || 0) - (vientos10m[i] || 0);
    if (diff > shearMax) shearMax = diff;
  }

  // 6. Determinar Nivel de Alerta (Continuo y Discreto)
  let nivel = 1;
  let titulo = "Atmósfera Estable";
  let causa = "Sin riesgo de convección severa.";
  let vectorDominante = "CONVECTIVO_NORMAL";

  // Evaluación de granizo (prioritaria si hay capa de fusión pequeña)
  if (hayRiesgoGranizo && capeMax > 1500) {
    nivel = 3;
    titulo = "Alerta por Tormenta Severa con Granizo";
    causa = `CAPE de ${capeMax.toFixed(0)} J/kg con capa de fusión de ${espesorFusion.toFixed(0)}m. Riesgo de granizo intacto.`;
    vectorDominante = "GRANIZO";
  }

  // Evaluación de downburst (prioritaria si hay aire seco en capas medias)
  if (capeMax > 1000 && potencialDesplome > 100 && shearMax > 15) {
    nivel = 3;
    titulo = "Alerta por Rachas Descendentes (Downburst)";
    causa = `Potencial de desplome de ${potencialDesplome.toFixed(0)} (CAPE ${capeMax.toFixed(0)} con humedad 700hPa del ${humedadMin.toFixed(0)}%). Riesgo de vientos destructivos.`;
    vectorDominante = "DOWNBURST";
  }

  // Evaluación de supercélula (amenaza máxima)
  if (potencialDesplome > 150 && shearMax > 25 && capeMax > 2500) {
    nivel = 4;
    titulo = "Emergencia por Supercélula";
    causa = `Inestabilidad extrema (CAPE ${capeMax.toFixed(0)} J/kg) con cizalladura severa de ${shearMax.toFixed(0)} km/h. Vientos huracanados locales.`;
    vectorDominante = "SUPERCELULA";
  }

  // Vigilancia por inestabilidad moderada
  if (nivel === 1 && capeMax > 800) {
    nivel = 2;
    titulo = "Vigilancia por Tormentas Dispersas";
    causa = `CAPE de ${capeMax.toFixed(0)} J/kg. Posibles chubascos fuertes aislados.`;
    vectorDominante = "TORMENTA_DISPERSA";
  }

  // 7. Nivel Continuo con Sigmoide (para el Orquestador)
  const pesoInestabilidad = sigmoide(capeMax, 1500, 0.002);
  let nivelContinuo = nivel;
  if (nivel === 1) nivelContinuo = 1.0 + pesoInestabilidad * 0.99;
  if (nivel === 2) nivelContinuo = 2.0 + pesoInestabilidad * 0.5;
  if (nivel === 3) nivelContinuo = 3.0 + pesoInestabilidad * 0.9;

  return {
    modulo: "convectivo",
    nivel_alerta: nivel,
    nivel_alerta_continuo: parseFloat(Math.min(4, nivelContinuo).toFixed(2)),
    vector_dominante: vectorDominante,
    diagnostico: { titulo, causa },
    datos_tecnicos: {
      cape_max_jkg: parseFloat(capeMax.toFixed(0)),
      humedad_700hpa_min: parseFloat(humedadMin.toFixed(0)),
      espesor_capa_fusion_m: parseFloat(espesorFusion.toFixed(0)),
      nivel_congelacion_m: parseFloat(nivelCongelacionMin.toFixed(0)),
      lluvia_total_24h_mm: parseFloat(lluviaTotal.toFixed(1)),
      potencial_desplome: parseFloat(potencialDesplome.toFixed(0)),
      cizalladura_max_kmh: parseFloat(shearMax.toFixed(1)),
      peso_inestabilidad: parseFloat(pesoInestabilidad.toFixed(2))
    }
  };
}