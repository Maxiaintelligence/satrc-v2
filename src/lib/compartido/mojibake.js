/**
 * SatRC V2.0 — Reparación de doble encoding UTF-8 (mojibake)
 *
 * Extraído en Etapa 3 (H6.4) para eliminar duplicación entre:
 * - api/sara.js
 * - api/reporte-ondemand.js
 * - scripts/reportes/reporteDiario.mjs
 * - scripts/ejecutar_sara_autonomo.mjs
 *
 * ⚠️ El runtime de GitHub Actions introduce doble encoding al guardar en
 * @vercel/blob. Este parche revierte el daño en la LECTURA.
 *
 * La causa raíz (N22/N27) NO está resuelta. El parche es defensivo.
 * Si el Blob cambia su comportamiento (ej. @vercel/blob fixea el bug),
 * estas funciones deberían ser no-op (retornar el input tal cual).
 *
 * Uso:
 *   import { repararMojibake, repararObjeto } from './lib/compartido/mojibake.js';
 *
 *   const textoLimpio = repararMojibake('atmÃ³sferas');  // 'atmósferas'
 *   const objetoLimpio = repararObjeto({ a: 'Ã³' });      // { a: 'ó' }
 */

/**
 * Repara un string con doble encoding UTF-8.
 * Si el string no tiene mojibake, lo retorna tal cual.
 *
 * Ejemplo: 'atmÃ³sferas' → 'atmósferas'
 *
 * @param {string} texto - String a reparar.
 * @returns {string} String reparado (o el original si no tiene mojibake).
 */
export function repararMojibake(texto) {
  if (typeof texto !== 'string' || !texto) return texto;
  const tieneMojibake = /[ÃÂ][\u0080-\u00BF]/.test(texto);
  if (!tieneMojibake) return texto;
  try {
    const bytes = Buffer.from(texto, 'latin1');
    const reparado = bytes.toString('utf8');
    if (reparado.length < texto.length && !/[ÃÂ][\u0080-\u00BF]/.test(reparado)) {
      return reparado;
    }
    return texto;
  } catch (e) {
    return texto;
  }
}

/**
 * Repara un objeto recursivamente: aplica repararMojibake a cada string.
 * Soporta strings, arrays, objetos anidados, null y undefined.
 *
 * @param {*} obj - Objeto a reparar (puede ser string, array, objeto, null, undefined).
 * @returns {*} Copia del objeto con los strings reparados.
 */
export function repararObjeto(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return repararMojibake(obj);
  if (Array.isArray(obj)) return obj.map(repararObjeto);
  if (typeof obj === 'object') {
    const copia = {};
    for (const clave of Object.keys(obj)) {
      copia[clave] = repararObjeto(obj[clave]);
    }
    return copia;
  }
  return obj;
}