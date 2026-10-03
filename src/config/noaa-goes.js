/**
 * SatRC V2.0 - Configuración Centralizada Oficial NOAA GOES-19
 * Servidor de Distribución: cdn.star.nesdis.noaa.gov
 * Sector: México (mex)
 */

const NOAA_CDN = "https://cdn.star.nesdis.noaa.gov";
const SATELLITE = "GOES19";
const SECTOR = "mex";

const ABI_BASE = `${NOAA_CDN}/${SATELLITE}/ABI/SECTOR/${SECTOR}`;
const GLM_BASE = `${NOAA_CDN}/${SATELLITE}/GLM/SECTOR/${SECTOR}`;

export const NOAA_PRODUCTS = {
  geocolor: {
    id: "geocolor",
    name: "GeoColor (Visible / Color Real)",
    shortName: "GeoColor",
    type: "ABI",
    directory: "GEOCOLOR",
    description: "Bucle animado continuo de nubosidad real, sombras orográficas, niebla y avance de frentes fríos en luz visible y nocturna.",
    updateInterval: 600_000, // 10 minutos
    gif: `${ABI_BASE}/GEOCOLOR/GOES19-MEX-GEOCOLOR-1000x1000.gif`,
    jpg: `${ABI_BASE}/GEOCOLOR/1000x1000.jpg`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector.php?sat=G19&sector=mex"
  },

  glmFed: {
    id: "glmFed",
    name: "Tormentas Eléctricas (GLM FED)",
    shortName: "Rayos GLM",
    type: "GLM",
    directory: "EXTENT3",
    description: "Geostationary Lightning Mapper (Flash Extent Density). Registro dinámico de actividad eléctrica y rayos. Celdas con destellos concentrados indican granizo y tormentas severas.",
    updateInterval: 300_000, // 5 minutos
    gif: `${GLM_BASE}/EXTENT3/GOES19-MEX-EXTENT3-1000x1000.gif`,
    jpg: `${GLM_BASE}/EXTENT3/1000x1000.jpg`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=EXTENT3&length=24"
  },

  fireTemperature: {
    id: "fireTemperature",
    name: "Incendios (Fire Temperature)",
    shortName: "Fuego / Incendios",
    type: "ABI",
    directory: "FireTemperature",
    description: "Temperatura de fuego en superficie (Infrarrojo de onda corta). Identifica anomalías térmicas y focos activos de incendios forestales y pastizales.",
    updateInterval: 600_000, // 10 minutos
    gif: `${ABI_BASE}/FireTemperature/GOES19-MEX-FireTemperature-1000x1000.gif`,
    jpg: `${ABI_BASE}/FireTemperature/1000x1000.jpg`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=FireTemperature&length=24"
  },

  band13: {
    id: "band13",
    name: "Celdas Convectivas (Banda 13)",
    shortName: "Tormentas / Celdas",
    type: "ABI",
    directory: "13",
    description: "Infrarrojo de onda larga (Clean IR 10.3 µm). Identifica topes fríos de nubes de tormenta con potencial de deslave y lluvias súbitas.",
    updateInterval: 600_000, // 10 minutos
    gif: `${ABI_BASE}/13/GOES19-MEX-13-1000x1000.gif`,
    jpg: `${ABI_BASE}/13/1000x1000.jpg`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=13&length=24"
  },

  airMass: {
    id: "airMass",
    name: "Masa de Aire (Air Mass)",
    shortName: "Masa de Aire",
    type: "ABI",
    directory: "AirMass",
    description: "RGB compuesto para análisis sinóptico de masas de aire, corrientes en chorro en altura, frentes fríos e intrusiones secas de la estratosfera.",
    updateInterval: 600_000, // 10 minutos
    gif: `${ABI_BASE}/AirMass/GOES19-MEX-AirMass-1000x1000.gif`,
    jpg: `${ABI_BASE}/AirMass/1000x1000.jpg`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=AirMass&length=24"
  }
};