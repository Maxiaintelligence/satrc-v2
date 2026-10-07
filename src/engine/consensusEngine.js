/**
 * SatRC V2.0 - Core Engine: Algoritmo de Consenso Multi-Modelo Robusto
 * Procesa GFS (EE.UU.), ICON (Alemania) y GEM (Canadá). Filtro anti-ceros espurios.
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

function filtrarCerosEspurios(p_gfs, p_icon, p_gem) {
  const lecturas = [
    { modelo: 'gfs', valor: Math.max(0, p_gfs || 0) },
    { modelo: 'icon', valor: Math.max(0, p_icon || 0) },
    { modelo: 'gem', valor: Math.max(0, p_gem || 0) }
  ];

  const conLluvia = lecturas.filter(l => l.valor >= 0.5);
  const ceros = lecturas.filter(l => l.valor < 0.1);

  if (conLluvia.length === 2 && ceros.length === 1) {
    return conLluvia.map(l => l.valor);
  }
  return lecturas.map(l => l.valor);
}

export function generarConsensoDeterminista(datosHorarios) {
  if (!datosHorarios || !datosHorarios.time) return [];

  const horas = datosHorarios.time;
  const serieConsenso = [];

  for (let i = 0; i < horas.length; i++) {
    // Precipitación por modelo (GFS, ICON, GEM)
    const p_gfs = datosHorarios["precipitation_gfs_seamless"]?.[i] ?? datosHorarios["precipitation"]?.[i] ?? 0;
    const p_icon = datosHorarios["precipitation_icon_seamless"]?.[i] ?? 0;
    const p_gem = datosHorarios["precipitation_gem_seamless"]?.[i] ?? 0;

    const valoresValidosLluvia = filtrarCerosEspurios(p_gfs, p_icon, p_gem);
    const lluviaConsenso = calcularMediana(valoresValidosLluvia);

    // Temperaturas
    const t_gfs = datosHorarios["temperature_2m_gfs_seamless"]?.[i] ?? datosHorarios["temperature_2m"]?.[i] ?? 15;
    const t_icon = datosHorarios["temperature_2m_icon_seamless"]?.[i] ?? 15;
    const t_gem = datosHorarios["temperature_2m_gem_seamless"]?.[i] ?? 15;
    const tempConsenso = calcularMediana([t_gfs, t_icon, t_gem]);

    // Viento y Ráfagas
    const v_gfs = datosHorarios["wind_speed_10m_gfs_seamless"]?.[i] ?? datosHorarios["wind_speed_10m"]?.[i] ?? 0;
    const v_icon = datosHorarios["wind_speed_10m_icon_seamless"]?.[i] ?? 0;
    const v_gem = datosHorarios["wind_speed_10m_gem_seamless"]?.[i] ?? 0;
    const vientoConsenso = calcularMediana([v_gfs, v_icon, v_gem]);

    const r_gfs = datosHorarios["wind_gusts_10m_gfs_seamless"]?.[i] ?? datosHorarios["wind_gusts_10m"]?.[i] ?? 0;
    const r_icon = datosHorarios["wind_gusts_10m_icon_seamless"]?.[i] ?? 0;
    const r_gem = datosHorarios["wind_gusts_10m_gem_seamless"]?.[i] ?? 0;
    const rafagaConsenso = Math.max(r_gfs, r_icon, r_gem);

    // Humedad
    const h_gfs = datosHorarios["relative_humidity_2m_gfs_seamless"]?.[i] ?? datosHorarios["relative_humidity_2m"]?.[i] ?? 50;
    const h_icon = datosHorarios["relative_humidity_2m_icon_seamless"]?.[i] ?? 50;
    const h_gem = datosHorarios["relative_humidity_2m_gem_seamless"]?.[i] ?? 50;
    const humedadConsenso = calcularMediana([h_gfs, h_icon, h_gem]);

    // Visibilidad
    const vis = (datosHorarios["visibility"]?.[i] ?? 10000) / 1000;

    // Dispersión inter-modelo
    const dispersion = Math.max(p_gfs, p_icon, p_gem) - Math.min(p_gfs, p_icon, p_gem);
    let confiabilidad = "ALTA";
    if (dispersion > 12.0) confiabilidad = "EN_DISPUTA";
    else if (dispersion > 4.0) confiabilidad = "MODERADA";

    serieConsenso.push({
      fecha_hora: horas[i],
      lluvia_mm: parseFloat(lluviaConsenso.toFixed(1)),
      temperatura_c: parseFloat(tempConsenso.toFixed(1)),
      viento_kmh: parseFloat(vientoConsenso.toFixed(1)),
      rafagas_kmh: parseFloat(rafagaConsenso.toFixed(1)),
      humedad_relativa_pct: Math.round(humedadConsenso),
      visibility_km: vis,
      confiabilidad: confiabilidad,
      detalle_modelos: {
        lluvia: { gfs: p_gfs, icon: p_icon, gem: p_gem },
        temp: { gfs: t_gfs, icon: t_icon, gem: t_gem }
      }
    });
  }

  return serieConsenso;
}