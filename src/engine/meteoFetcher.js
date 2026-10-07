/**
 * SatRC V2.0 - Core Engine: Conector Multi-Modelo Oficial
 * Tríada Activa para México: GFS (EE.UU.) + ICON (Alemania) + GEM (Canadá).
 */

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export async function consultarModelosDeterministas(lat, lon) {
  const variables = [
    "precipitation",
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "visibility",
    "weather_code"
  ].join(",");

  // Tríada verificada y sin deprecaciones: GFS (NOAA), ICON (DWD) y GEM (Canadá)
  const modelos = ["gfs_seamless", "icon_seamless", "gem_seamless"].join(",");

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