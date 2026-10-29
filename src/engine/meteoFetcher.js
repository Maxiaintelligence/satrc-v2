/**
 * SatRC V2.0 - Core Engine: Conector Multi-Modelo Oficial
 * Tríada Activa para México: GFS (EE.UU.) + ICON (Alemania) + GEM (Canadá).
 */

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

export async function consultarModelosDeterministas(lat, lon) {
  const variables = [
    // Variables del motor hidrológico (producción actual)
    "precipitation",
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "visibility",
    "weather_code",
    // Variables E4 (H6.1) — verificadas empíricamente el 21/10/2026
    // Open-Meteo las expone con sufijo _gfs_seamless, _icon_seamless, _gem_seamless
    "surface_pressure",          // windEvaluator (densidad del aire)
    "apparent_temperature",      // thermalEvaluator (sensación térmica)
    "cloud_cover",               // thermalEvaluator (Grass Minimum)
    "wet_bulb_temperature_2m",   // thermalEvaluator (nevadas)
    "cape",                      // convectiveEvaluator (inestabilidad)
    "freezing_level_height",     // convectiveEvaluator (granizo) — GEM devuelve null
    "relative_humidity_700hPa",  // convectiveEvaluator (downburst)
    "wind_speed_700hPa"          // convectiveEvaluator (cizalladura)
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

    // N-FETCH-01 (29/10/2026): el motor asume que serie[168] es la medianoche
    // local del día de emisión. Si Open-Meteo cambia la política de alineación,
    // todas las ventanas de 24h del motor se desplazan silenciosamente. Se
    // emite un warn al log del runner para detectar la regresión. No se
    // lanza excepción para no romper la corrida (el motor sigue funcionando
    // con la alineación que venga, aunque el resultado se desplace).
    if (!datos.hourly?.time?.[0]?.endsWith('T00:00')) {
      console.warn(
        `⚠️ [N-FETCH-01] La serie de Open-Meteo no comienza a medianoche: ` +
        `${datos.hourly?.time?.[0] || 'null'}. El motor asume alineación midnight. ` +
        `Verificar política de Open-Meteo.`
      );
    }

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