/**
 * SatRC V2.0 - Core Engine: Conector Multi-Modelo con Memoria Hídrica (7 días previos)
 * Consulta lluvia acumulada pasada (past_days=7) + pronóstico 72h (forecast_days=3).
 */

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export async function consultarModelosDeterministas(lat, lon) {
  const variables = [
    "precipitation",
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "weather_code"
  ].join(",");

  const modelos = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless"].join(",");

  // past_days=7 nos da la memoria del suelo real de la última semana
  const url = `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}` +
              `&hourly=${variables}` +
              `&models=${modelos}` +
              `&past_days=7` +
              `&forecast_days=3` +
              `&timezone=America%2FMexico_City`;

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error(`Error en API meteorológica: Código HTTP ${respuesta.status}`);
    }
    const datos = await respuesta.json();
    return {
      exito: true,
      coordenadas: { lat, lon },
      zona_horaria: datos.timezone,
      datos_horarios: datos.hourly
    };
  } catch (error) {
    console.error("❌ Fallo en consultarModelosDeterministas:", error);
    return {
      exito: false,
      error: error.message
    };
  }
}