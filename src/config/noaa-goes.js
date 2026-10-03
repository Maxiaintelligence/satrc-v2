/**
 * SatRC V2.0 - Catálogo Oficial de Productos GOES-19 (Sector México)
 */

const NOAA_CDN = "https://cdn.star.nesdis.noaa.gov";

export const NOAA_PRODUCTS = {
  geocolor: {
    id: "geocolor",
    name: "GeoColor (Visible / Color Real)",
    shortName: "GeoColor",
    type: "ABI",
    description: "Nubosidad real de día e infrarrojo multiespectral de noche. Permite vigilar el avance de frentes y nubosidad orográfica.",
    dir: `${NOAA_CDN}/GOES19/ABI/SECTOR/mex/GEOCOLOR/`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=GEOCOLOR&length=24"
  },

  glmFed: {
    id: "glmFed",
    name: "Tormentas Eléctricas (GLM / EXTENT3)",
    shortName: "Rayos GLM",
    type: "GLM",
    description: "Geostationary Lightning Mapper (Flash Extent Density). Registro dinámico de actividad eléctrica y rayos. Destellos concentrados indican granizo y celdas convectivas severas.",
    dir: `${NOAA_CDN}/GOES19/GLM/SECTOR/mex/EXTENT3/`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=EXTENT3&length=24"
  },

  fireTemperature: {
    id: "fireTemperature",
    name: "Incendios (Fire Temperature)",
    shortName: "Fuego / Incendios",
    type: "ABI",
    description: "Infrarrojo térmico para identificar focos de calor y anomalías térmicas activas en superficie (incendios forestales y pastizales).",
    dir: `${NOAA_CDN}/GOES19/ABI/SECTOR/mex/FireTemperature/`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=FireTemperature&length=24"
  },

  sandwich: {
    id: "sandwich",
    name: "Tormentas Severas (Sandwich RGB)",
    shortName: "Tormentas / Celdas",
    type: "ABI",
    description: "Combina la imagen visible de alta resolución con infrarrojo coloreado de topes fríos. Permite ver la textura 3D de la nube y la violencia de las celdas convectivas.",
    dir: `${NOAA_CDN}/GOES19/ABI/SECTOR/mex/Sandwich/`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=Sandwich&length=24"
  },

  airMass: {
    id: "airMass",
    name: "Masa de Aire (Air Mass)",
    shortName: "Masa de Aire",
    type: "ABI",
    description: "RGB compuesto para análisis de masas de aire, corrientes en chorro en altura, frentes fríos e intrusiones secas de la estratosfera.",
    dir: `${NOAA_CDN}/GOES19/ABI/SECTOR/mex/AirMass/`,
    officialUrl: "https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G19&sector=mex&band=AirMass&length=24"
  }
};