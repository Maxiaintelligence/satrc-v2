/**
 * SatRC V2.0 - Core Engine: Algoritmo de Consenso Multi-Modelo
 * Ponderación no lineal, filtro de ceros espurios y cálculo de incertidumbre.
 */

/**
 * Calcula la mediana de una lista de números
 */
function calcularMediana(valores) {
  if (!valores || valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 !== 0) {
    return ordenados[mitad];
  }
  return (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

/**
 * Filtro de Cero Espurio para precipitación:
 * Si dos modelos marcan precipitación significativa (> 0.5 mm) y el tercero marca 0.0,
 * se descarta el cero por ceguera de cuadrícula local orográfica.
 */
function filtrarCerosEspurios(p_ecmwf, p_gfs, p_icon) {
  const lecturas = [
    { modelo: 'ecmwf', valor: Math.max(0, p_ecmwf || 0) },
    { modelo: 'gfs', valor: Math.max(0, p_gfs || 0) },
    { modelo: 'icon', valor: Math.max(0, p_icon || 0) }
  ];

  const conLluvia = lecturas.filter(l => l.valor >= 0.5);
  const ceros = lecturas.filter(l => l.valor < 0.1);

  // Si dos modelos ven lluvia clara y uno ve cero absoluto: descartamos el cero
  if (conLluvia.length === 2 && ceros.length === 1) {
    return conLluvia.map(l => l.valor);
  }

  // De lo contrario, tomamos los 3 valores
  return lecturas.map(l => l.valor);
}

/**
 * Procesa las 72 horas y genera la serie temporal de consenso
 * @param {Object} datosHorarios Objeto retornado por Open-Meteo
 * @returns {Array<Object>} 72 registros con los valores consolidados
 */
export function generarConsensoDeterminista(datosHorarios) {
  if (!datosHorarios || !datosHorarios.time) return [];

  const horas = datosHorarios.time;
  const serieConsenso = [];

  for (let i = 0; i < horas.length; i++) {
    // 1. Precipitación por modelo
    const p_ec = datosHorarios["precipitation_ecmwf_ifs025"]?.[i] ?? 0;
    const p_gfs = datosHorarios["precipitation_gfs_seamless"]?.[i] ?? 0;
    const p_icon = datosHorarios["precipitation_icon_seamless"]?.[i] ?? 0;

    const valoresLluviaValidos = filtrarCerosEspurios(p_ec, p_gfs, p_icon);
    const lluviaConsenso = calcularMediana(valoresLluviaValidos);

    // 2. Temperaturas a 2m
    const t_ec = datosHorarios["temperature_2m_ecmwf_ifs025"]?.[i] ?? 15;
    const t_gfs = datosHorarios["temperature_2m_gfs_seamless"]?.[i] ?? 15;
    const t_icon = datosHorarios["temperature_2m_icon_seamless"]?.[i] ?? 15;
    const tempConsenso = calcularMediana([t_ec, t_gfs, t_icon]);

    // 3. Viento y Ráfagas
    const v_ec = datosHorarios["wind_speed_10m_ecmwf_ifs025"]?.[i] ?? 0;
    const v_gfs = datosHorarios["wind_speed_10m_gfs_seamless"]?.[i] ?? 0;
    const v_icon = datosHorarios["wind_speed_10m_icon_seamless"]?.[i] ?? 0;
    const vientoConsenso = calcularMediana([v_ec, v_gfs, v_icon]);

    const r_ec = datosHorarios["wind_gusts_10m_ecmwf_ifs025"]?.[i] ?? 0;
    const r_gfs = datosHorarios["wind_gusts_10m_gfs_seamless"]?.[i] ?? 0;
    const r_icon = datosHorarios["wind_gusts_10m_icon_seamless"]?.[i] ?? 0;
    const rafagaConsenso = Math.max(r_ec, r_gfs, r_icon); // Tomamos la ráfaga máxima prevista

    // 4. Humedad Relativa
    const h_ec = datosHorarios["relative_humidity_2m_ecmwf_ifs025"]?.[i] ?? 50;
    const h_gfs = datosHorarios["relative_humidity_2m_gfs_seamless"]?.[i] ?? 50;
    const h_icon = datosHorarios["relative_humidity_2m_icon_seamless"]?.[i] ?? 50;
    const humedadConsenso = calcularMediana([h_ec, h_gfs, h_icon]);

    // 5. Índice de Discrepancia entre Modelos (Spread)
    const dispersionLluvia = Math.max(p_ec, p_gfs, p_icon) - Math.min(p_ec, p_gfs, p_icon);
    let confiabilidad = "ALTA";
    if (dispersionLluvia > 15.0) confiabilidad = "EN_DISPUTA";
    else if (dispersionLluvia > 5.0) confiabilidad = "MODERADA";

    serieConsenso.push({
      fecha_hora: horas[i],
      lluvia_mm: parseFloat(lluviaConsenso.toFixed(1)),
      temperatura_c: parseFloat(tempConsenso.toFixed(1)),
      viento_kmh: parseFloat(vientoConsenso.toFixed(1)),
      rafagas_kmh: parseFloat(rafagaConsenso.toFixed(1)),
      humedad_relativa_pct: Math.round(humedadConsenso),
      confiabilidad: confiabilidad,
      detalle_modelos: {
        lluvia: { ecmwf: p_ec, gfs: p_gfs, icon: p_icon },
        temp: { ecmwf: t_ec, gfs: t_gfs, icon: t_icon }
      }
    });
  }

  return serieConsenso;
}