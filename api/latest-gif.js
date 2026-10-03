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

    if (!archivos.length) {
      return res.status(404).json({ error: "No se encontraron GIFs generados" });
    }

    // Ordenar: el más reciente tiene la mayor marca de fin (índices 12 a 23);
    // a igualdad, el bucle que inició antes (índices 0 a 11)
    archivos.sort((a, b) =>
      b.slice(12, 23).localeCompare(a.slice(12, 23)) || a.slice(0, 11).localeCompare(b.slice(0, 11))
    );

    const nombreMasReciente = archivos[0];

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