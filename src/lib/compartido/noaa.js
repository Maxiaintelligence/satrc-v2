/**
 * SatRC V2.0 — Utilidades de parseo NOAA GOES-19
 *
 * Extraído en Etapa 3 (H7b.2) para eliminar lógica inline en `api/latest-gif.js`.
 * Resuelve H-UI-19: la validación de rangos (día juliano 1-366, hora 0-23, minuto 0-59)
 * no se hacía. Ahora `parseNoaaStamp` retorna null si el stamp es inválido.
 *
 * Formato NOAA: [YYYY][JJJ][HH][MM] (11 dígitos)
 *   - YYYY: año (4 dígitos)
 *   - JJJ:  día juliano del año (3 dígitos, 1-366)
 *   - HH:   hora (2 dígitos, 0-23)
 *   - MM:   minuto (2 dígitos, 0-59)
 *
 * Ejemplo: "20262901530" = 2026, día juliano 290, 15:30.
 */

/**
 * Parsea un stamp NOAA de 11 dígitos.
 *
 * @param {string} stamp - String de 11 dígitos (YYYYJJJHHMM).
 * @returns {{year: number, dayOfYear: number, hour: number, minute: number}|null}
 *   Objeto parseado, o null si el stamp es inválido (longitud, no numérico, o rangos fuera de límite).
 */
export function parseNoaaStamp(stamp) {
  if (typeof stamp !== 'string' || stamp.length !== 11) return null;
  if (!/^\d{11}$/.test(stamp)) return null;

  const year = parseInt(stamp.slice(0, 4), 10);
  const dayOfYear = parseInt(stamp.slice(4, 7), 10);
  const hour = parseInt(stamp.slice(7, 9), 10);
  const minute = parseInt(stamp.slice(9, 11), 10);

  // Validación de rangos (H-UI-19)
  if (year < 2000 || year > 2100) return null;
  if (dayOfYear < 1 || dayOfYear > 366) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  return { year, dayOfYear, hour, minute };
}

/**
 * Compara dos stamps NOAA para ordenamiento.
 * Retorna:
 *   - Negativo si `a` es más reciente que `b` (para sort descendente).
 *   - Positivo si `a` es más antiguo.
 *   - 0 si son iguales.
 *
 * Lógica: compara año, luego día juliano, luego hora, luego minuto.
 * Los stamps inválidos se consideran "más antiguos" que cualquier válido.
 *
 * @param {string} stampA
 * @param {string} stampB
 * @returns {number}
 */
export function compararNoaaStamps(stampA, stampB) {
  const a = parseNoaaStamp(stampA);
  const b = parseNoaaStamp(stampB);

  if (!a && !b) return 0;
  if (!a) return 1;  // inválido va al final
  if (!b) return -1; // inválido va al final

  if (a.year !== b.year) return b.year - a.year;             // descendente
  if (a.dayOfYear !== b.dayOfYear) return b.dayOfYear - a.dayOfYear;
  if (a.hour !== b.hour) return b.hour - a.hour;
  return b.minute - a.minute;
}