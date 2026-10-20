/**
 * SatRC V2.0 - Resolver Serverless Oficial NOAA GOES-19
 * Detecta dinámicamente el nombre del GIF más reciente generado por NOAA para cada producto.
 */

const DIRS = {
  geocolor: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/mex/GEOCOLOR/",
  glmFed: "https://cdn.star.nesdis.noaa.gov/GOES19/GLM/SECTOR/mex/EXTENT3/",
  fireTemperature: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/mex/FireTemperature/",
  sandwich: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/mex/Sandwich/",
  airMass: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/mex/AirMass/"
};

import { parseNoaaStamp, compararNoaaStamps } from '../src/lib/compartido/noaa.js';

export default async function handler(req, res) {
  const dir = DIRS[req.query.p];
  if (!dir) {
    return res.status(400).json({ error: "Producto no válido" });
  }

  try {
    const respuesta = await fetch(dir);
    if (!respuesta.ok) {
      throw new Error(`NOAA respondió con código ${respuesta.status}`);
    }

    const html = await respuesta.text();

    // Extraer todos los archivos con estructura: [Inicio 11 dig]-[Fin 11 dig]-...-1000x1000.gif
    const archivos = [...html.matchAll(/href="(\d{11}-\d{11}-[^"]*-1000x1000\.gif)"/g)]
      .map(m => m[1]);

    // Filtrar archivos con stamps inválidos (H-UI-19)
    const archivosValidos = archivos.filter(archivo => {
      const startStamp = archivo.slice(0, 11);
      const endStamp = archivo.slice(12, 23);
      return parseNoaaStamp(startStamp) !== null && parseNoaaStamp(endStamp) !== null;
    });

    if (!archivosValidos.length) {
      return res.status(404).json({ error: "No se encontraron GIFs válidos generados" });
    }

    // Ordenar: el más reciente tiene la mayor marca de fin (índices 12 a 23);
    // a igualdad, el bucle que inició antes (índices 0 a 11)
    archivosValidos.sort((a, b) => {
      const endA = a.slice(12, 23);
      const endB = b.slice(12, 23);
      const startA = a.slice(0, 11);
      const startB = b.slice(0, 11);

      // 1. Ordenar por stamp de fin (descendente)
      const compFin = compararNoaaStamps(endA, endB);
      if (compFin !== 0) return compFin;

      // 2. Desempate: ordenar por stamp de inicio (ascendente, el que empezó antes va primero)
      // Negamos el resultado porque compararNoaaStamps ordena descendente por defecto.
      return -compararNoaaStamps(startA, startB);
    });

    const nombreMasReciente = archivosValidos[0];

    // Caché en Edge de Vercel durante 5 minutos para respuesta ultra-rápida (20ms)
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    return res.json({ 
      url: dir + nombreMasReciente, 
      fin: nombreMasReciente.slice(12, 23),
      nombre: nombreMasReciente
    });
  } catch (e) {
    console.error("Error al consultar directorio NOAA:", e);
    return res.status(502).json({ error: "El servidor de NOAA no respondió" });
  }
}