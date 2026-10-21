/**
 * SatRC V2.0 — Módulo de Evaluación de Riesgo por Viento
 * Basado en la normalización por densidad de Richardson (Presión Dinámica).
 * Evalúa ráfagas y las normaliza a nivel del mar para eliminar el sesgo de altitud.
 */

const RHO_0 = 1.225; // Densidad del aire a nivel del mar (kg/m3)
const RD = 287.05;   // Constante del aire seco (J/(kg·K))

/**
 * Calcula la densidad del aire usando la ecuación de los gases ideales.
 */
function calcularDensidad(presionHpa, temperaturaC) {
  const p = presionHpa * 100; // Convertir hPa a Pa
  const t = temperaturaC + 273.15; // Convertir °C a Kelvin
  return p / (RD * t);
}

/**
 * Evalúa el riesgo por viento de una localidad.
 * 
 * @param {Object} localidad - Objeto con datos de altitud y relieve.
 * @param {Object} serieHoraria - Objeto con arrays de variables (promediadas o máximas).
 * @returns {Object} Resultado de la evaluación de viento.
 */
export function evaluarViento(localidad, serieHoraria) {
  const altitud = localidad.topografia.altitud_msnm || 2000;
  const relieve = localidad.topografia.relieve || 'MESETA';
  
  // Si no hay datos de viento, retornamos N1 (Fallback seguro)
  if (!serieHoraria || !serieHoraria.viento_kmh || !serieHoraria.rafagas_kmh) {
    return {
      modulo: "viento",
      nivel_alerta: 1,
      nivel_alerta_continuo: 1.0,
      vector_dominante: "VIENTO_NORMAL",
      diagnostico: { titulo: "Sin datos de viento", causa: "Faltan datos en la serie." }
    };
  }

  // 1. Suavizado y Extracción (Usamos el máximo de las próximas 24h)
  const idxHoy = serieHoraria.time ? Math.min(168, serieHoraria.time.length - 24) : 0;
  const ventana24h = serieHoraria.rafagas_kmh.slice(idxHoy, idxHoy + 24);
  const rafagaMax = Math.max(...ventana24h, 0);
  
  // Viento sostenido promedio en la misma ventana
  const ventanaSostenido = serieHoraria.viento_kmh.slice(idxHoy, idxHoy + 24);
  const vientoSostenido = ventanaSostenido.reduce((a, b) => a + b, 0) / (ventanaSostenido.length || 1);

  // Presión y temperatura media
  const presion = serieHoraria.presion_hpa ? (serieHoraria.presion_hpa[idxHoy] || 1013) : 1013;
  const temp = serieHoraria.temperatura_c ? (serieHoraria.temperatura_c[idxHoy] || 15) : 15;

  // 2. Cálculo de Densidad y Normalización
  const rho = calcularDensidad(presion, temp);
  const vEq = rafagaMax * Math.sqrt(rho / RHO_0);

  // 3. Factor de Rugosidad (Topografía)
  // En laderas/cumbres el daño es mayor por exposición
  let factorRugosidad = 1.0;
  if (relieve === 'LADERA' || relieve === 'CANADA') factorRugosidad = 1.1;
  else if (relieve === 'LOMA') factorRugosidad = 1.05;
  
  const vEqFinal = vEq * factorRugosidad;

  // 4. Factor de Ráfaga
  const factorRafaga = vientoSostenido > 0 ? (rafagaMax / vientoSostenido) : 1;

  // 5. Determinación de Nivel (Umbrales continuos)
  let nivel = 1;
  let titulo = "Vientos Normales";
  let causa = `Ráfagas de ${rafagaMax.toFixed(1)} km/h (Equivalentes a ${vEqFinal.toFixed(1)} km/h a nivel del mar).`;

  if (vEqFinal >= 90) {
    nivel = 4;
    titulo = "Emergencia por Vientos Huracanados";
    causa = `Ráfagas de ${rafagaMax.toFixed(1)} km/h superan los 90 km/h. Colapso estructural inminente.`;
  } else if (vEqFinal >= 65) {
    nivel = 3;
    titulo = "Alerta por Vientos Fuertes";
    causa = `Ráfagas de ${rafagaMax.toFixed(1)} km/h. Riesgo de caída de árboles y techos.`;
  } else if (vEqFinal >= 45) {
    nivel = 2;
    titulo = "Vigilancia por Ráfagas Moderadas";
    causa = `Ráfagas de ${rafagaMax.toFixed(1)} km/h. Precaución con objetos ligeros.`;
  }

  // Nivel continuo para el Orquestador (Ej: si vEq es 44.9, da 1.99)
  let nivelContinuo = nivel;
  if (nivel === 1 && vEqFinal > 35) nivelContinuo = 1.0 + ((vEqFinal - 35) / 10) * 0.99;
  if (nivel === 2 && vEqFinal > 55) nivelContinuo = 2.0 + ((vEqFinal - 55) / 10) * 0.99;
  if (nivel === 3 && vEqFinal > 75) nivelContinuo = 3.0 + ((vEqFinal - 75) / 15) * 0.99;

  return {
    modulo: "viento",
    nivel_alerta: nivel,
    nivel_alerta_continuo: parseFloat(nivelContinuo.toFixed(2)),
    vector_dominante: nivel === 1 ? "VIENTO_NORMAL" : (nivel === 4 ? "VIENTO_DESTRUCTIVO" : "VIENTO_FUERTE"),
    diagnostico: { titulo, causa },
    datos_tecnicos: {
      rafaga_real_kmh: parseFloat(rafagaMax.toFixed(1)),
      viento_sostenido_kmh: parseFloat(vientoSostenido.toFixed(1)),
      factor_rafaga: parseFloat(factorRafaga.toFixed(2)),
      densidad_aire_kgm3: parseFloat(rho.toFixed(3)),
      factor_rugosidad: factorRugosidad,
      velocidad_equivalente_kmh: parseFloat(vEqFinal.toFixed(1))
    }
  };
}