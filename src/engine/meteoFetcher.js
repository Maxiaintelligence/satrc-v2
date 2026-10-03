/**
 * SatRC V2.0 - Core Engine: Conector Multi-Modelo Determinista
 * Consulta simultánea a ECMWF, GFS e ICON para un horizonte de 72 horas.
 */

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Consulta pronóstico horario determinista para una coordenada (lat, lon)
 * @param {number} lat Latitud decimal
 * @param {number} lon Longitud decimal
 * @returns {Promise<Object>} Datos horarios crudos de los 3 modelos
 */
export async function consultarModelosDeterministas(lat, lon) {
  // Parámetros horarios requeridos para alimentar los 5 vectores
  const variables = [
    "precipitation",
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "weather_code"
  ].join(",");

  // Modelos oficiales: ECMWF IFS, GFS y DWD ICON
  const modelos = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless"].join(",");

  const url = `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}` +
              `&hourly=${variables}` +
              `&models=${modelos}` +
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