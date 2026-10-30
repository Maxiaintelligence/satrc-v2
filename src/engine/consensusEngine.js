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

/**
 * H6.3 — Consensúa una variable E4 extrayendo los 3 valores del modelo
 * y aplicando la estrategia indicada.
 * 
 * @param {Object} datosHorarios - Objeto hourly de Open-Meteo (con sufijos _gfs_seamless, _icon_seamless, _gem_seamless).
 * @param {string} nombreVariable - Nombre base sin sufijo (ej. "surface_pressure").
 * @param {number} indice - Índice de la hora.
 * @param {string} estrategia - "mediana" (default) | "max" | "gfs_preferente".
 * @returns {number|null} Valor consensuado o null si no hay datos.
 */
function consensuarVariableE4(datosHorarios, nombreVariable, indice, estrategia = "mediana") {
  const gfs = datosHorarios[`${nombreVariable}_gfs_seamless`]?.[indice];
  const icon = datosHorarios[`${nombreVariable}_icon_seamless`]?.[indice];
  const gem = datosHorarios[`${nombreVariable}_gem_seamless`]?.[indice];

  const validos = [gfs, icon, gem].filter(v => v !== null && v !== undefined && Number.isFinite(v));

  if (validos.length === 0) return null;

  if (estrategia === "gfs_preferente") {
    // Para freezing_level_height: GEM devuelve null, GFS es la fuente preferida
    if (Number.isFinite(gfs)) return gfs;
    if (Number.isFinite(icon)) return icon;
    if (Number.isFinite(gem)) return gem;
    return null;
  }

  if (estrategia === "max") {
    return Math.max(...validos);
  }

  // "mediana" (default)
  return calcularMediana(validos);
}

// ============================================================
// H-CONV-02 / Opción A (29/10/2026): Cizalladura vectorial
//
// Las direcciones de viento son circulares (0° = Norte, 90° = Este).
// Una mediana lineal de 350° y 10° da 180° (opuesto), lo cual es
// incorrecto. La solución es convertir a componentes u, v, consensuar
// cada componente por separado y recalcular dirección y velocidad.
//
// Convención meteorológica: la dirección indica DESDE dónde viene el
// viento. Componentes: u = -speed*sin(dir), v = -speed*cos(dir).
// ============================================================

function velocidadYDirAComponentes(speedMs, dirDeg) {
  if (!Number.isFinite(speedMs) || !Number.isFinite(dirDeg)) return null;
  const rad = dirDeg * Math.PI / 180;
  return {
    u: -speedMs * Math.sin(rad),
    v: -speedMs * Math.cos(rad)
  };
}

function componentesAVelocidadYDir(u, v) {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  const speedMs = Math.sqrt(u * u + v * v);
  let dirDeg = Math.atan2(-u, -v) * 180 / Math.PI;
  if (dirDeg < 0) dirDeg += 360;
  return { speedMs, dirDeg };
}

/**
 * Consensúa viento (speed + direction) de los 3 modelos devolviendo
 * componentes u, v en m/s y la dirección consensuada.
 *
 * @param {Object} datosHorarios - Objeto hourly de Open-Meteo.
 * @param {string} varSpeed - Nombre base de la variable de velocidad (ej. "wind_speed_10m").
 * @param {string} varDir - Nombre base de la dirección (ej. "wind_direction_10m").
 * @param {number} indice - Índice de la hora.
 * @param {number} factorMs - Factor de conversión a m/s (1/3.6 si el speed está en km/h).
 * @returns {{u:number, v:number, speedMs:number, dirDeg:number}|null}
 */
function consensuarVectorViento(datosHorarios, varSpeed, varDir, indice, factorMs) {
  const sufijos = ['_gfs_seamless', '_icon_seamless', '_gem_seamless'];
  const componentes = [];
  for (const suf of sufijos) {
    const speed = datosHorarios[`${varSpeed}${suf}`]?.[indice]
               ?? datosHorarios[varSpeed]?.[indice];
    const dir = datosHorarios[`${varDir}${suf}`]?.[indice]
             ?? datosHorarios[varDir]?.[indice];
    if (Number.isFinite(speed) && Number.isFinite(dir)) {
      const comp = velocidadYDirAComponentes(speed * factorMs, dir);
      if (comp) componentes.push(comp);
    }
  }
  if (componentes.length === 0) return null;
  const us = componentes.map(c => c.u).sort((a, b) => a - b);
  const vs = componentes.map(c => c.v).sort((a, b) => a - b);
  const medU = us[Math.floor(us.length / 2)];
  const medV = vs[Math.floor(vs.length / 2)];
  const reconstruido = componentesAVelocidadYDir(medU, medV);
  return {
    u: medU,
    v: medV,
    speedMs: reconstruido.speedMs,
    dirDeg: reconstruido.dirDeg
  };
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
    // H-CONV-02 / Opción A (29/10/2026): componentes vectoriales de viento
    // a 10m y 700hPa. Open-Meteo devuelve wind_speed en km/h → factor 1/3.6.
    const vector10m = consensuarVectorViento(datosHorarios, 'wind_speed_10m', 'wind_direction_10m', i, 1/3.6);
    const vector700 = consensuarVectorViento(datosHorarios, 'wind_speed_700hPa', 'wind_direction_700hPa', i, 1/3.6);

    // Gate convectivo: precipitación convectiva consensuada (mediana de 3 modelos).
    // Nota: `precipitation` (lluvia total) ya está consensuada como `lluviaConsenso`.
    const showersConsenso = consensuarVariableE4(datosHorarios, 'showers', i);

    // Humedad
    const h_gfs = datosHorarios["relative_humidity_2m_gfs_seamless"]?.[i] ?? datosHorarios["relative_humidity_2m"]?.[i] ?? 50;
    const h_icon = datosHorarios["relative_humidity_2m_icon_seamless"]?.[i] ?? 50;
    const h_gem = datosHorarios["relative_humidity_2m_gem_seamless"]?.[i] ?? 50;
    const humedadConsenso = calcularMediana([h_gfs, h_icon, h_gem]);

    // Visibilidad (Open-Meteo devuelve visibility_gfs_seamless cuando se piden múltiples modelos)
    const vis = (datosHorarios["visibility_gfs_seamless"]?.[i]
              ?? datosHorarios["visibility"]?.[i]
              ?? 10000) / 1000;

    // Dispersión inter-modelo
    const dispersion = Math.max(p_gfs, p_icon, p_gem) - Math.min(p_gfs, p_icon, p_gem);
    let confiabilidad = "ALTA";
    if (dispersion > 12.0) confiabilidad = "EN_DISPUTA";
    else if (dispersion > 4.0) confiabilidad = "MODERADA";

    // === H6.3: Variables E4 consensuadas (nombre plano para el orquestador) ===
    const presionHpaRaw = consensuarVariableE4(datosHorarios, "surface_pressure", i);
    const sensacionTermicaRaw = consensuarVariableE4(datosHorarios, "apparent_temperature", i);
    const coberturaNubosaRaw = consensuarVariableE4(datosHorarios, "cloud_cover", i);
    const bulboHumedoRaw = consensuarVariableE4(datosHorarios, "wet_bulb_temperature_2m", i);
    const capeJkgRaw = consensuarVariableE4(datosHorarios, "cape", i, "max");
    const nivelCongelacionRaw = consensuarVariableE4(datosHorarios, "freezing_level_height", i, "gfs_preferente");
    const humedad700Raw = consensuarVariableE4(datosHorarios, "relative_humidity_700hPa", i);
    const viento700Raw = consensuarVariableE4(datosHorarios, "wind_speed_700hPa", i, "max");

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
      },
      // === H6.3: Variables E4 consensuadas (nombre plano) ===
      presion_hpa: presionHpaRaw !== null ? parseFloat(presionHpaRaw.toFixed(1)) : null,
      sensacion_termica_c: sensacionTermicaRaw !== null ? parseFloat(sensacionTermicaRaw.toFixed(1)) : null,
      cobertura_nubosa_pct: coberturaNubosaRaw !== null ? Math.round(coberturaNubosaRaw) : null,
      bulbo_humedo_c: bulboHumedoRaw !== null ? parseFloat(bulboHumedoRaw.toFixed(1)) : null,
      cape_jkg: capeJkgRaw !== null ? parseFloat(capeJkgRaw.toFixed(1)) : null,
      nivel_congelacion_m: nivelCongelacionRaw !== null ? Math.round(nivelCongelacionRaw) : null,
      humedad_700hpa: humedad700Raw !== null ? Math.round(humedad700Raw) : null,
      viento_700hpa: viento700Raw !== null ? parseFloat(viento700Raw.toFixed(1)) : null,
      // H-CONV-02 / Opción A (29/10/2026): cizalladura vectorial y gate convectivo.
      // Los campos u/v se exponen en m/s (consistente con umbrales ECMWF de 10-15 m/s).
      // Los campos wind_direction_* están en grados meteorológicos (0=N, 90=E).
      wind_direction_10m: vector10m ? Math.round(vector10m.dirDeg) : null,
      wind_direction_700hpa: vector700 ? Math.round(vector700.dirDeg) : null,
      u10_ms: vector10m ? parseFloat(vector10m.u.toFixed(2)) : null,
      v10_ms: vector10m ? parseFloat(vector10m.v.toFixed(2)) : null,
      u700_ms: vector700 ? parseFloat(vector700.u.toFixed(2)) : null,
      v700_ms: vector700 ? parseFloat(vector700.v.toFixed(2)) : null,
      showers_mm: showersConsenso !== null ? parseFloat(showersConsenso.toFixed(1)) : null
    });
  }

  return serieConsenso;
}