/**
 * SatRC V2.0 - API Serverless: Resolver Dinámico de Rayos GLM (GOES-19)
 * Detecta automáticamente el GIF con el timestamp más reciente generado por NOAA.
 */
export default async function handler(req, res) {
  const NOAA_DIR_URL = 'https://cdn.star.nesdis.noaa.gov/GOES19/GLM/SECTOR/mex/EXTENT3/';

  try {
    const respuesta = await fetch(NOAA_DIR_URL);
    if (!respuesta.ok) {
      throw new Error(`NOAA respondió con código ${respuesta.status}`);
    }

    const html = await respuesta.text();

    // Buscar todos los archivos que terminen en -GOES19-GLM-MEX-EXTENT3-1000x1000.gif
    const regex = /href="([^"]*GOES19-GLM-MEX-EXTENT3-1000x1000\.gif)"/gi;
    const coincidencias = [];
    let match;

    while ((match = regex.exec(html)) !== null) {
      coincidencias.push(match[1]);
    }

    if (coincidencias.length === 0) {
      // Si no encuentra el patrón exacto, fallback al enlace que confirmaste
      res.redirect(302, 'https://cdn.star.nesdis.noaa.gov/GOES19/GLM/SECTOR/mex/EXTENT3/20262761041-20262761456-GOES19-GLM-MEX-EXTENT3-1000x1000.gif');
      return;
    }

    // Tomamos el último archivo generado de la lista
    const archivoMasReciente = coincidencias[coincidencias.length - 1];
    const urlFinal = `${NOAA_DIR_URL}${archivoMasReciente}`;

    // Redirige al navegador al GIF vivo
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.redirect(302, urlFinal);
  } catch (error) {
    console.error('Error al resolver GLM de NOAA:', error);
    // Fallback de emergencia
    res.redirect(302, 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/GIFS/GOES16-MEX-GEOCOLOR-1000x1000.gif');
  }
}