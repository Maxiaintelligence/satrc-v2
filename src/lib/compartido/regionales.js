/**
 * SatRC V2.0 — Normalización y formateo de datos regionales
 *
 * Extraído en Etapa 3 (H6.5) para eliminar duplicación entre:
 * - api/reporte-ondemand.js (ventana 48h: ayer + hoy)
 * - scripts/reportes/reporteDiario.mjs (ventana 72h: ayer + hoy + mañana)
 *
 * ⚠️ Las 2 versiones originales NO eran idénticas:
 * - reporteDiario.mjs incluía el campo `lluvia_manana_24h_mm` (ventana 72h).
 * - reporte-ondemand.js NO lo incluía (ventana 48h).
 *
 * Esta versión unificada SIEMPRE incluye el campo `lluvia_manana_24h_mm`.
 * Si el caller no lo envía (ej. reporte-ondemand), se normaliza a null.
 * Esto es inocuo porque el prompt de Groq en reporte-ondemand NO menciona
 * ese campo, así que null o valor real no cambia el comportamiento.
 */

/**
 * Normaliza el objeto de datos regionales que llega del frontend (o del runner).
 * Limpia strings largos, valida números, y garantiza la estructura esperada.
 *
 * @param {Object} raw - Datos regionales crudos.
 * @returns {Object|null} Datos normalizados o null si el input es inválido.
 */
export function normalizarDatosRegionales(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.resumenes)) return null;

  const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

  const resumenes = raw.resumenes.map(r => ({
    zona_id: String(r.zona_id || '').slice(0, 5),
    zona_nombre: String(r.zona_nombre || '').slice(0, 100),
    nodo_referencia: String(r.nodo_referencia || '').slice(0, 150),
    poblacion: num(r.poblacion) || 0,
    lluvia_ayer_24h_mm: num(r.lluvia_ayer_24h_mm),
    lluvia_hoy_24h_mm: num(r.lluvia_hoy_24h_mm),
    lluvia_manana_24h_mm: num(r.lluvia_manana_24h_mm),
    temperatura_min_c: num(r.temperatura_min_c),
    temperatura_max_c: num(r.temperatura_max_c),
    temperatura_actual_c: num(r.temperatura_actual_c),
    viento_max_kmh: num(r.viento_max_kmh),
    rafaga_max_kmh: num(r.rafaga_max_kmh),
    humedad_min_pct: num(r.humedad_min_pct),
    humedad_max_pct: num(r.humedad_max_pct),
    visibilidad_min_km: num(r.visibilidad_min_km),
    confiabilidad_dominante: String(r.confiabilidad_dominante || 'DESCONOCIDA').slice(0, 20)
  }));

  return {
    zonas_totales: parseInt(raw.zonas_totales) || 14,
    zonas_ok: parseInt(raw.zonas_ok) || 0,
    zonas_fallidas: Array.isArray(raw.zonas_fallidas) ? raw.zonas_fallidas.slice(0, 14).map(z => String(z).slice(0, 5)) : [],
    resumenes
  };
}

/**
 * Construye el bloque de texto que se le pasa a Groq como contexto.
 * Incluye SIEMPRE las 3 ventanas (ayer + hoy + mañana).
 *
 * @param {Object} datosRegionales - Datos normalizados.
 * @returns {string} Bloque de texto formateado para el prompt.
 */
export function construirBloqueRegional(datosRegionales) {
  if (!datosRegionales || datosRegionales.resumenes.length === 0) {
    return 'DATOS REGIONALES: no disponibles en esta emisión.';
  }

  const lineas = datosRegionales.resumenes.map(r => {
    const fmt = (v) => v === null || v === undefined ? 's/d' : v;
    return `${r.zona_nombre} (nodo: ${r.nodo_referencia})
  AYER: Lluvia ${fmt(r.lluvia_ayer_24h_mm)} mm
  HOY: Lluvia ${fmt(r.lluvia_hoy_24h_mm)} mm | Temp ${fmt(r.temperatura_min_c)}/${fmt(r.temperatura_max_c)} °C | Viento máx ${fmt(r.viento_max_kmh)} km/h | Ráfaga máx ${fmt(r.rafaga_max_kmh)} km/h
  MAÑANA: Lluvia ${fmt(r.lluvia_manana_24h_mm)} mm
  Humedad ${fmt(r.humedad_min_pct)}%-${fmt(r.humedad_max_pct)}% | Visibilidad mín ${fmt(r.visibilidad_min_km)} km | Confiabilidad: ${r.confiabilidad_dominante}`;
  });

  const encabezado = `DATOS REGIONALES (${datosRegionales.zonas_ok}/${datosRegionales.zonas_totales} zonas disponibles, ventana 72h, consenso GFS + ICON + GEM):`;

  let bloque = encabezado + '\n\n' + lineas.join('\n\n');

  if (datosRegionales.zonas_fallidas.length > 0) {
    bloque += `\n\nZONAS SIN DATOS EN ESTA EMISIÓN: ${datosRegionales.zonas_fallidas.join(', ')}.`;
  }

  return bloque;
}