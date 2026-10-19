/**
 * SatRC V2.0 — Utilidades de fecha compartidas
 *
 * Extraídas en Etapa 3 (H6.1) para eliminar duplicación entre:
 * - src/views/MonitorPublico.jsx
 * - src/views/SatRCOperativo.jsx
 *
 * Formatea un timestamp ISO UTC a la hora local de México.
 * Devuelve un string tipo "19 oct • 13:00 hrs" o null si el input es inválido.
 */

/**
 * Formatea un timestamp ISO UTC en la hora local de México.
 *
 * @param {string|null|undefined} isoUtc - Timestamp ISO 8601 UTC.
 * @returns {string|null} String formateado o null si el input es inválido.
 */
export function formatearTimestamp(isoUtc) {
  if (!isoUtc) return null;
  try {
    const fecha = new Date(isoUtc);
    if (isNaN(fecha.getTime())) return null;
    const fechaMx = fecha.toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: 'short'
    });
    const horaMx = fecha.toLocaleTimeString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${fechaMx} • ${horaMx} hrs`;
  } catch (e) {
    return null;
  }
}