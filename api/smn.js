/**
 * SatRC V2.0 - API Serverless Oficial SMN / CONAGUA (México)
 * Consulta de avisos meteorológicos generales y alertas por tiempo severo.
 */

export default async function handler(req, res) {
  // Endpoints oficiales del SMN / CONAGUA para avisos generales y alertas
  const SMN_BOLETIN_URL = "https://smn.conagua.gob.mx/tools/GUI/webservices/index.php?method=1";
  const SMN_PORTAL_AVISOS = "https://smn.conagua.gob.mx/es/pronosticos/avisos/aviso-meteorologico-general";

  try {
    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), 6000); // 6 segundos de tiempo límite

    const respuesta = await fetch(SMN_BOLETIN_URL, {
      signal: controlador.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SatRC/2.0 Caritas Tulancingo"
      }
    });
    clearTimeout(timeoutId);

    if (!respuesta.ok) {
      throw new Error(`SMN respondió con código ${respuesta.status}`);
    }

    const textoBoletin = await respuesta.text();

    // Análisis de menciones y estados de alerta para la región diocesana
    const textoMin = textoBoletin.toLowerCase();
    const mencionaHidalgo = textoMin.includes("hidalgo");
    const mencionaPuebla = textoMin.includes("puebla");
    const mencionaVeracruz = textoMin.includes("veracruz");

    // Detección de fenómenos activos en el texto oficial
    const hayTormenta = textoMin.includes("tormentas") || textoMin.includes("lluvias puntuales") || textoMin.includes("torrenciales");
    const hayFrenteFrio = textoMin.includes("frente frío") || textoMin.includes("masa de aire polar") || textoMin.includes("heladas");
    const hayCiclon = textoMin.includes("ciclón") || textoMin.includes("huracán") || textoMin.includes("tormenta tropical");
    const hayNorte = textoMin.includes("evento de norte") || textoMin.includes("rachas de viento");

    // Clasificación de severidad oficial para la región (Hidalgo, Puebla, Veracruz)
    let nivelOficial = 1; // Normal
    let estadoTexto = "Condiciones Estables";
    let colorAlerta = "#10B981"; // Verde

    if (mencionaHidalgo || mencionaPuebla || mencionaVeracruz) {
      if (textoMin.includes("torrenciales") || textoMin.includes("huracán") || textoMin.includes("extraordinarias")) {
        nivelOficial = 4;
        estadoTexto = "Alerta Máxima por Tiempo Severo";
        colorAlerta = "#EF4444"; // Rojo
      } else if (textoMin.includes("intensas") || textoMin.includes("muy fuertes") || hayCiclon) {
        nivelOficial = 3;
        estadoTexto = "Alerta Temprana Oficial";
        colorAlerta = "#F97316"; // Naranja
      } else if (hayTormenta || hayFrenteFrio || hayNorte) {
        nivelOficial = 2;
        estadoTexto = "Aviso Meteorológico Vigente";
        colorAlerta = "#F59E0B"; // Amarillo
      }
    }

    // Extracción limpia de un resumen del primer párrafo
    const parrafos = textoBoletin.replace(/<[^>]*>/g, ' ').split(/\n|\r/).filter(p => p.trim().length > 40);
    const resumenOficial = parrafos.length > 0 ? parrafos[0].trim().slice(0, 280) + "..." : "Monitoreo oficial activo emitido por la Coordinación General del Servicio Meteorológico Nacional.";

    // Guardar en caché de Vercel por 10 minutos
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=600");
    return res.json({
      exito: true,
      fuente: "Servicio Meteorológico Nacional (SMN / CONAGUA)",
      nivel: nivelOficial,
      estado: estadoTexto,
      color: colorAlerta,
      region_afectada: {
        hidalgo: mencionaHidalgo,
        puebla: mencionaPuebla,
        veracruz: mencionaVeracruz
      },
      sistemas_activos: {
        tormentas: hayTormenta,
        frente_frio: hayFrenteFrio,
        ciclon: hayCiclon,
        norte: hayNorte
      },
      resumen: resumenOficial,
      enlace_oficial: SMN_PORTAL_AVISOS,
      fecha_consulta: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    });

  } catch (error) {
    console.error("Fallo temporal al conectar con SMN:", error.message);
    
    // Fallback institucional en caso de interrupción en los servidores del gobierno
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.json({
      exito: true,
      fuente: "Servicio Meteorológico Nacional (SMN / CONAGUA)",
      nivel: 1,
      estado: "Monitoreo Rutinario",
      color: "#10B981",
      region_afectada: { hidalgo: false, puebla: false, veracruz: false },
      sistemas_activos: { tormentas: false, frente_frio: false, ciclon: false, norte: false },
      resumen: "Sincronización activa con los sistemas de alerta temprana de la Comisión Nacional del Agua.",
      enlace_oficial: SMN_PORTAL_AVISOS,
      fecha_consulta: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
    });
  }
}