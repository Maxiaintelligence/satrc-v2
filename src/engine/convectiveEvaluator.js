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
  // N-MOTOR-06 (29/10/2026): filtrar nulls antes de Math.min.
  // Math.min(null, 100) devuelve 0 en JS, inflando el potencial de desplome
  // a capeMax. Sin datos de humedad en capas medias, asumimos aire húmedo
  // (humedadMin = 100) bajo DEC-011: "sin datos = sin downburst".
  const humedadesValidas = humedades.filter(h => h != null && Number.isFinite(h));
  const humedadMin = humedadesValidas.length > 0 ? Math.min(...humedadesValidas) : 100;
  const lluviaTotal = lluvias.reduce((a, b) => a + b, 0);
  const nivelesValidos = nivelesCongelacion.filter(n => n != null);
  const nivelCongelacionMin = nivelesValidos.length ? Math.min(...nivelesValidos) : null;

  // 3. Cálculo del Espesor de la Capa de Fusión (Granizo)
  // El granizo llega intacto si la capa cálida entre el nivel de congelación y el suelo es delgada.
  // N-MOTOR-06-bis (29/10/2026): si nivelCongelacionMin es null (GFS también falla),
  // espesorFusion debe ser null, no -altitud (que daría un falso positivo de granizo).
  const espesorFusion = nivelCongelacionMin !== null ? (nivelCongelacionMin - altitud) : null;
  const hayRiesgoGranizo = espesorFusion !== null && capeMax > 1000 && espesorFusion < 1000 && lluviaTotal > 5;

  // 4. Cálculo del Potencial de Downburst
  // Si el aire en capas medias es seco, la lluvia se evapora, enfría la masa y se desploma.
  const potencialDesplome = capeMax * (100 - humedadMin) / 100;


  // 5. Cálculo de la Cizalladura Vertical (Wind Shear)
  // H-CONV-02 / Opción A (29/10/2026): cizalladura vectorial.
  //
  // Estrategia de 2 niveles:
  //   1. Usar componentes u,v consensuadas (producción, propagadas por el orquestador).
  //   2. Si no existen, computar desde speed+dir (compatibilidad con tests legacy).
  //   3. Si ninguna fuente está disponible → null (no se clasifica downburst).
  //
  // Bajo DEC-011, ante la duda, NO se emite alerta.
  const u10s = ventana(serieHoraria.u10_ms);
  const v10s = ventana(serieHoraria.v10_ms);
  const u700s = ventana(serieHoraria.u700_ms);
  const v700s = ventana(serieHoraria.v700_ms);

  let shearVectorialMs = null;

  if (u10s.length > 0 && v10s.length > 0 && u700s.length > 0 && v700s.length > 0) {
    // Vía 1: componentes consensuadas
    let shearVecMax = 0;
    let horasValidas = 0;
    for (let i = 0; i < u10s.length; i++) {
      const u10 = u10s[i], v10 = v10s[i], u700 = u700s[i], v700 = v700s[i];
      if (!Number.isFinite(u10) || !Number.isFinite(v10) || !Number.isFinite(u700) || !Number.isFinite(v700)) continue;
      horasValidas++;
      const du = u700 - u10;
      const dv = v700 - v10;
      const s = Math.sqrt(du * du + dv * dv);
      if (s > shearVecMax) shearVecMax = s;
    }
    if (horasValidas > 0) shearVectorialMs = shearVecMax;
  } else {
    // Vía 2: computar desde speed+dir
    const dir10s = ventana(serieHoraria.wind_direction_10m);
    const dir700s = ventana(serieHoraria.wind_direction_700hPa);
    if (dir10s.length > 0 && dir700s.length > 0) {
      let shearVecMax = 0;
      let horasValidas = 0;
      const n = Math.min(dir10s.length, dir700s.length, vientos10m.length, vientos700.length);
      for (let i = 0; i < n; i++) {
        const d10 = dir10s[i], d700 = dir700s[i];
        const s10 = vientos10m[i] / 3.6;
        const s700 = vientos700[i] / 3.6;
        if (!Number.isFinite(d10) || !Number.isFinite(d700) || !Number.isFinite(s10) || !Number.isFinite(s700)) continue;
        horasValidas++;
        const u10 = -s10 * Math.sin(d10 * Math.PI / 180);
        const v10 = -s10 * Math.cos(d10 * Math.PI / 180);
        const u700 = -s700 * Math.sin(d700 * Math.PI / 180);
        const v700 = -s700 * Math.cos(d700 * Math.PI / 180);
        const du = u700 - u10;
        const dv = v700 - v10;
        const s = Math.sqrt(du * du + dv * dv);
        if (s > shearVecMax) shearVecMax = s;
      }
      if (horasValidas > 0) shearVectorialMs = shearVecMax;
    }
  }

  // Cizalladura escalar (legacy): se conserva solo para reporte en datos_tecnicos.
  // NO se usa para clasificar desde Opción A.
  let shearMax = 0;
  for (let i = 0; i < vientos700.length; i++) {
    const diff = (vientos700[i] || 0) - (vientos10m[i] || 0);
    if (diff > shearMax) shearMax = diff;
  }

  // H-CONV-02 / Opción A: gate convectivo.
  // Bajo DEC-011, un downburst o supercélula requiere convección activa
  // con precipitación. Umbral inicial 0.5 mm/h (calibración pendiente, PEND-11).
  const MIN_CONVECTIVE_PRECIP_MMH = 0.5;
  const showersField = serieHoraria.showers_mm ?? serieHoraria.showers;
  const showersVentana = ventana(showersField);
  const showersMax = showersVentana.length > 0
    ? Math.max(...showersVentana.filter(v => v != null && Number.isFinite(v)), 0)
    : 0;
  const precipMaxVentana = lluvias.length > 0
    ? Math.max(...lluvias.filter(v => v != null && Number.isFinite(v)), 0)
    : 0;
  const hayConveccionActiva = showersMax >= MIN_CONVECTIVE_PRECIP_MMH
                           || precipMaxVentana >= MIN_CONVECTIVE_PRECIP_MMH;

  // 6. Determinar Nivel de Alerta (Continuo y Discreto)
  let nivel = 1;
  let titulo = "Atmósfera Estable";
  let causa = "Sin riesgo de convección severa.";
  let vectorDominante = "CONVECTIVO_NORMAL";

  // Evaluación de granizo (sin cambios respecto a la versión anterior)
  if (hayRiesgoGranizo && capeMax > 1500) {
    nivel = 3;
    titulo = "Alerta por Tormenta Severa con Granizo";
    causa = `CAPE de ${capeMax.toFixed(0)} J/kg con capa de fusión de ${espesorFusion.toFixed(0)}m. Riesgo de granizo intacto.`;
    vectorDominante = "GRANIZO";
  }

  // H-CONV-02 / Opción A (29/10/2026): Downburst.
  // Requiere cizalladura vectorial >= 10 m/s (ECMWF 10-15 m/s para
  // organización convectiva) y convección activa. Sin los 3, no se clasifica.
  if (capeMax > 1000 && potencialDesplome > 100
      && shearVectorialMs !== null && shearVectorialMs >= 10
      && hayConveccionActiva) {
    nivel = 3;
    titulo = "Alerta por Rachas Descendentes (Downburst)";
    causa = `CAPE ${capeMax.toFixed(0)} J/kg, humedad 700hPa ${humedadMin.toFixed(0)}%, cizalladura vectorial ${shearVectorialMs.toFixed(1)} m/s, precipitación convectiva ${Math.max(showersMax, precipMaxVentana).toFixed(1)} mm/h. Riesgo de vientos destructivos.`;
    vectorDominante = "DOWNBURST";
  }

  // Supercélula: cizalladura vectorial >= 15 m/s y convección activa.
  if (potencialDesplome > 150
      && shearVectorialMs !== null && shearVectorialMs >= 15
      && capeMax > 2500 && hayConveccionActiva) {
    nivel = 4;
    titulo = "Emergencia por Supercélula";
    causa = `Inestabilidad extrema (CAPE ${capeMax.toFixed(0)} J/kg) con cizalladura vectorial ${shearVectorialMs.toFixed(1)} m/s y precipitación convectiva. Vientos huracanados locales.`;
    vectorDominante = "SUPERCELULA";
  }

  // Vigilancia por inestabilidad moderada: también requiere convección activa.
  if (nivel === 1 && capeMax > 800 && hayConveccionActiva) {
    nivel = 2;
    titulo = "Vigilancia por Tormentas Dispersas";
    causa = `CAPE ${capeMax.toFixed(0)} J/kg con precipitación convectiva. Posibles chubascos fuertes aislados.`;
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
      espesor_capa_fusion_m: espesorFusion !== null ? parseFloat(espesorFusion.toFixed(0)) : null,
      nivel_congelacion_m: nivelCongelacionMin !== null ? parseFloat(nivelCongelacionMin.toFixed(0)) : null,
      lluvia_total_24h_mm: parseFloat(lluviaTotal.toFixed(1)),
      potencial_desplome: parseFloat(potencialDesplome.toFixed(0)),
      // H-CONV-02 / Opción A: cizalladura vectorial + gate convectivo
      cizalladura_max_kmh: parseFloat(shearMax.toFixed(1)),
      cizalladura_vectorial_ms: shearVectorialMs !== null ? parseFloat(shearVectorialMs.toFixed(2)) : null,
      showers_max_mmh: parseFloat(showersMax.toFixed(1)),
      precipitacion_max_mmh: parseFloat(precipMaxVentana.toFixed(1)),
      conveccion_activa: hayConveccionActiva,
      peso_inestabilidad: parseFloat(pesoInestabilidad.toFixed(2))
    }
  };
}