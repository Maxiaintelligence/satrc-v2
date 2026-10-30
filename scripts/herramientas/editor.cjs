'use strict';
/**
 * scripts/herramientas/editor.cjs
 * Helper compartido de edicion por script (Fase 2.6).
 *
 * Uso desde un script temporal (.cjs):
 *   const e = require('./scripts/herramientas/editor.cjs');
 *   const d = e.abrir('docs/06_PENDIENTES.md');   // Fase A
 *   e.reemplazarEnLinea(d, 'ID-006', 'PENDIENTE', 'CERRADO', 'estado 006'); // Fase B
 *   e.guardar(d);                                  // Fase C
 *
 * Garantias:
 *  - Anclaje unico: 0 o >1 coincidencias => FALLO, exit 1, no se escribe nada.
 *  - Doble ejecucion: las inserciones se detienen si la primera linea nueva ya
 *    existe; los reemplazos fallan porque su anclaje ya no esta.
 *  - Los reemplazos usan funcion: "$&" y "$$" quedan literales.
 *  - Conserva CRLF o LF, el salto de linea final y NO agrega BOM.
 *  - Aborta si el archivo mezcla CRLF y LF.
 *  - NO valida sintaxis: en codigo usar siempre `node --check` (2.6.5).
 *  - Opera por lineas: un anclaje es una substring dentro de UNA sola linea.
 */

const fs = require('fs');

function fallar(msg) {
  console.error('FALLO: ' + msg);
  process.exit(1);
}

/** Fase A: lee, quita BOM, detecta separador y divide en lineas. */
function abrir(ruta) {
  if (typeof ruta !== 'string' || ruta === '') fallar('abrir: falta la ruta del archivo');
  let crudo;
  try {
    crudo = fs.readFileSync(ruta, 'utf-8');
  } catch (err) {
    fallar('abrir: no se pudo leer "' + ruta + '" (' + err.message + ')');
  }
  const s = crudo.charCodeAt(0) === 0xFEFF ? crudo.slice(1) : crudo;
  const crlf = (s.match(/\r\n/g) || []).length;
  const lf = (s.match(/\n/g) || []).length; // incluye los \n de cada \r\n
  if (crlf > 0 && lf > crlf) fallar('el archivo mezcla CRLF y LF; normalizar antes de editar');
  const sep = crlf > 0 ? '\r\n' : '\n';
  return {
    ruta: ruta,
    sep: sep,
    lineas: s.split(/\r?\n/),
    longitudOriginal: s.length,
    log: []
  };
}

/** Indices de las lineas que contienen la substring. */
function indices(d, sub) {
  const r = [];
  for (let i = 0; i < d.lineas.length; i++) {
    if (d.lineas[i].includes(sub)) r.push(i);
  }
  return r;
}

/** Exige exactamente 1 coincidencia y devuelve su indice. */
function unico(d, sub, et) {
  if (typeof sub !== 'string' || sub === '') fallar(et + ': el anclaje esta vacio o no es texto');
  const ix = indices(d, sub);
  if (ix.length !== 1) {
    fallar(et + ': el anclaje "' + sub + '" aparece ' + ix.length + ' veces (se espera exactamente 1)');
  }
  return ix[0];
}

function exigirLineas(nuevas, et) {
  if (!Array.isArray(nuevas)) fallar(et + ': las lineas nuevas deben ir en un arreglo');
}

/** Guarda contra doble ejecucion: la primera linea nueva no vacia no debe existir ya. */
function guardaDuplicado(d, nuevas, et) {
  const primera = nuevas.find(function (l) { return l.trim() !== ''; });
  if (primera !== undefined && d.lineas.includes(primera)) {
    fallar(et + ': la linea "' + primera + '" ya existe (posible doble ejecucion)');
  }
}

/** Localiza una linea por su ID unico y reemplaza una substring dentro de ella. */
function reemplazarEnLinea(d, id, buscar, reemplazo, et) {
  const i = unico(d, id, et);
  if (!d.lineas[i].includes(buscar)) fallar(et + ': "' + buscar + '" no esta en la linea ancla');
  d.lineas[i] = d.lineas[i].replace(buscar, function () { return reemplazo; });
  d.log.push('OK: ' + et);
}

/** Reemplaza una substring que aparece en una sola linea del documento. No cruza lineas. */
function reemplazarPorContenido(d, sub, reemplazo, et) {
  const i = unico(d, sub, et);
  d.lineas[i] = d.lineas[i].replace(sub, function () { return reemplazo; });
  d.log.push('OK: ' + et);
}

/** Inserta N lineas antes de la linea que contiene el ID. */
function insertarAntesDe(d, id, nuevas, et) {
  exigirLineas(nuevas, et);
  const i = unico(d, id, et);
  guardaDuplicado(d, nuevas, et);
  d.lineas.splice.apply(d.lineas, [i, 0].concat(nuevas));
  d.log.push('OK: ' + et);
}

/** Inserta N lineas despues de la linea que contiene el ID. */
function insertarDespuesDe(d, id, nuevas, et) {
  exigirLineas(nuevas, et);
  const i = unico(d, id, et);
  guardaDuplicado(d, nuevas, et);
  d.lineas.splice.apply(d.lineas, [i + 1, 0].concat(nuevas));
  d.log.push('OK: ' + et);
}

/** Elimina la unica linea que contiene la substring. */
function borrarLinea(d, sub, et) {
  const i = unico(d, sub, et);
  d.lineas.splice(i, 1);
  d.log.push('OK: ' + et);
}

/**
 * Reemplaza desde la linea unica que contiene `inicio` hasta la primera linea
 * posterior que contiene `fin`, ambas incluidas. Patron para bloques multilinea.
 */
function reemplazarBloque(d, inicio, fin, nuevas, et) {
  exigirLineas(nuevas, et);
  const i = unico(d, inicio, et);
  let j = -1;
  for (let k = i + 1; k < d.lineas.length; k++) {
    if (d.lineas[k].includes(fin)) { j = k; break; }
  }
  if (j === -1) fallar(et + ': no se encontro el cierre "' + fin + '" despues del inicio');
  d.lineas.splice.apply(d.lineas, [i, j - i + 1].concat(nuevas));
  d.log.push('OK: ' + et);
}

/** Fase C: escribe UTF-8 sin BOM con el separador original e imprime el resumen. */
function guardar(d) {
  if (d.log.length === 0) fallar('no hay cambios que guardar');
  const nuevo = d.lineas.join(d.sep);
  fs.writeFileSync(d.ruta, nuevo, 'utf-8');
  d.log.forEach(function (l) { console.log(l); });
  console.log(
    'Separador: ' + (d.sep === '\r\n' ? 'CRLF' : 'LF') +
    ' | longitud: ' + d.longitudOriginal + ' -> ' + nuevo.length
  );
}

module.exports = {
  abrir,
  reemplazarEnLinea,
  reemplazarPorContenido,
  insertarAntesDe,
  insertarDespuesDe,
  borrarLinea,
  reemplazarBloque,
  guardar
};
