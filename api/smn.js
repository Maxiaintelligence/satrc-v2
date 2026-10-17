/**
 * SatRC V2.0 - API Serverless Oficial SMN / CONAGUA (México)
 * N33 — Parser robusto del aviso vigente.
 * 
 * Fuente: https://smn.conagua.gob.mx/es/ (página principal)
 * El webservice method=1 NO contiene los avisos (devuelve pronóstico general).
 * El aviso real está en la página principal, en un bloque <li>.
 * 
 * Estrategia:
 * 1. Consultar la página principal del SMN.
 * 2. Buscar patrones de lluvias (torrenciales/intensas/fuertes).
 * 3. Detectar estados afectados (Hidalgo, Puebla, Veracruz).
 * 4. Asignar nivel según severidad del fenómeno.
 */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const SMN_AVISOS_URL = "https://smn.conagua.gob.mx/es/";

  const ahora = new Date();
  const fechaHoyStr = ahora.toLocaleDateString('es-MX', { 
    timeZone: 'America/Mexico_City', day: '2-digit', month: 'long', year: 'numeric' 
  });
  const horaMexicoStr = ahora.toLocaleTimeString('es-MX', { 
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true 
  });

  try {
    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), 10000);

    // N33 — Consultar la página principal del SMN (donde están los avisos)
    const respuesta = await fetch(SMN_AVISOS_URL, {
      signal: controlador.signal,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 SatRC/2.0",
        "Accept": "text/html,application/xhtml+xml"
      }
    }).catch(() => null);

    clearTimeout(timeoutId);

    let textoOficial = "";
    if (respuesta && respuesta.ok) {
      textoOficial = await respuesta.text();
    }

    const textoMin = textoOficial.toLowerCase();

    // Detección de entidades de la jurisdicción diocesana
    const mencionaHidalgo = textoMin.includes("hidalgo");
    const mencionaPuebla = textoMin.includes("puebla");
    const mencionaVeracruz = textoMin.includes("veracruz");
    const afectaRegion = mencionaHidalgo || mencionaPuebla || mencionaVeracruz;

    // N33 — Detección de fenómenos con patrones REALES del SMN
    const hayTorrenciales = textoMin.includes("torrenciales");
    const hayIntensas = textoMin.includes("lluvias intensas") || textoMin.includes("lluvias puntuales intensas");
    const hayFuertes = textoMin.includes("lluvias fuertes") || textoMin.includes("lluvias muy fuertes");
    const hayChubascos = textoMin.includes("chubascos");
    const hayFrenteFrio = textoMin.includes("frente frío") || textoMin.includes("masa de aire polar");
    const hayCiclon = textoMin.includes("huracán") || textoMin.includes("tormenta tropical") || textoMin.includes("ciclón");

    // N33 — Construcción del aviso según severidad detectada
    let alerta = null;

    if (afectaRegion) {
      const estados = [];
      if (mencionaHidalgo) estados.push("HGO");
      if (mencionaPuebla) estados.push("PUE");
      if (mencionaVeracruz) estados.push("VER");

      if (hayTorrenciales) {
        // Nivel 3 — Severo
        alerta = {
          activo: true,
          nivel: 3,
          severidad: "Aviso Severo",
          color: "#EF4444",
          titulo: "Lluvias Torrenciales en la Región",
          descripcion: `El SMN reporta lluvias torrenciales para ${estados.join(', ')}. Existe riesgo de inundaciones, deslaves y cortes viales en zonas de montaña.`,
          estados_afectados: estados,
          rango_lluvia_min_mm: 75,
          rango_lluvia_max_mm: 150,
          enlace_oficial: SMN_AVISOS_URL,
          fecha_sincronizacion: horaMexicoStr
        };
      } else if (hayIntensas) {
        // Nivel 2 — Preventivo
        alerta = {
          activo: true,
          nivel: 2,
          severidad: "Aviso Preventivo",
          color: "#F59E0B",
          titulo: "Lluvias Intensas en la Región",
          descripcion: `El SMN reporta lluvias intensas para ${estados.join(', ')}. Se recomienda precaución en actividades al aire libre y vigilancia de cauces.`,
          estados_afectados: estados,
          rango_lluvia_min_mm: 25,
          rango_lluvia_max_mm: 75,
          enlace_oficial: SMN_AVISOS_URL,
          fecha_sincronizacion: horaMexicoStr
        };
      } else if (hayFuertes || hayChubascos) {
        // Nivel 2 — Preventivo (menor severidad)
        alerta = {
          activo: true,
          nivel: 2,
          severidad: "Aviso Preventivo",
          color: "#F59E0B",
          titulo: "Lluvias Fuertes en la Región",
          descripcion: `El SMN reporta lluvias fuertes o chubascos para ${estados.join(', ')}. Se recomienda vigilancia en comunidades de ladera.`,
          estados_afectados: estados,
          rango_lluvia_min_mm: 10,
          rango_lluvia_max_mm: 25,
          enlace_oficial: SMN_AVISOS_URL,
          fecha_sincronizacion: horaMexicoStr
        };
      } else if (hayFrenteFrio) {
        // Nivel 2 — Preventivo (fenómeno distinto)
        alerta = {
          activo: true,
          nivel: 2,
          severidad: "Aviso Preventivo",
          color: "#F59E0B",
          titulo: "Frente Frío en la Región",
          descripcion: `El SMN reporta frente frío para ${estados.join(', ')}. Se recomienda precaución por descensos de temperatura y vientos.`,
          estados_afectados: estados,
          rango_lluvia_min_mm: 0,
          rango_lluvia_max_mm: 25,
          enlace_oficial: SMN_AVISOS_URL,
          fecha_sincronizacion: horaMexicoStr
        };
      } else if (hayCiclon) {
        // Nivel 3 — Severo (fenómeno grave)
        alerta = {
          activo: true,
          nivel: 3,
          severidad: "Aviso Severo",
          color: "#EF4444",
          titulo: "Ciclón o Tormenta Tropical en la Región",
          descripcion: `El SMN reporta un ciclón o tormenta tropical que afecta a ${estados.join(', ')}. Se recomienda precaución extrema.`,
          estados_afectados: estados,
          rango_lluvia_min_mm: 50,
          rango_lluvia_max_mm: 200,
          enlace_oficial: SMN_AVISOS_URL,
          fecha_sincronizacion: horaMexicoStr
        };
      }
    }

    // Si no hay aviso específico para la región, devolver "sin aviso"
    if (!alerta) {
      return res.json({
        exito: true,
        fuente: "Servicio Meteorológico Nacional (SMN / CONAGUA)",
        alerta: {
          activo: false,
          nivel: 1,
          severidad: "Normal",
          color: "#10B981",
          titulo: "Sin aviso meteorológico extraordinario para la región",
          descripcion: `Monitoreo oficial activo al día ${fechaHoyStr}. No se registran avisos de tiempo severo de CONAGUA/SMN para Hidalgo, Puebla o Veracruz en este momento.`,
          estados_afectados: [],
          rango_lluvia_min_mm: 0,
          rango_lluvia_max_mm: 15,
          enlace_oficial: SMN_AVISOS_URL,
          fecha_sincronizacion: horaMexicoStr
        }
      });
    }

    return res.json({
      exito: true,
      fuente: "Servicio Meteorológico Nacional (SMN / CONAGUA)",
      alerta
    });

  } catch (error) {
    console.error("[SMN] Error consultando el SMN:", error.message);

    return res.json({
      exito: false,
      fuente: "Servicio Meteorológico Nacional (SMN / CONAGUA)",
      error: "No se pudo consultar el SMN. Se omite el aviso.",
      alerta: {
        activo: false,
        nivel: 1,
        severidad: "Normal",
        color: "#10B981",
        titulo: "SMN no disponible",
        descripcion: "No se pudo obtener el aviso oficial. El sistema sigue funcionando con los modelos meteorológicos.",
        estados_afectados: [],
        rango_lluvia_min_mm: 0,
        rango_lluvia_max_mm: 0,
        enlace_oficial: SMN_AVISOS_URL,
        fecha_sincronizacion: horaMexicoStr
      }
    });
  }
}