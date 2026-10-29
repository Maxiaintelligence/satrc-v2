/**
 * Adaptador para Google Drive
 * Reemplaza a Vercel Blob usando Google Apps Script como puente.
 */
export async function leerJSONBlob(nombreArchivo) {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) throw new Error("Falta GOOGLE_SCRIPT_URL");

  try {
    const res = await fetch(`${url}?action=leer&file=${nombreArchivo}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`Error leyendo ${nombreArchivo} de Drive:`, e.message);
    return null;
  }
}

// --- INICIO DEL NUEVO BLOQUE ---
export async function escribirJSONBlob(nombreArchivo, contenido) {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) throw new Error("Falta GOOGLE_SCRIPT_URL");

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'escribir',
        file: nombreArchivo,
        content: contenido
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`Error escribiendo ${nombreArchivo} en Drive:`, e.message);
    throw e;
  }
}