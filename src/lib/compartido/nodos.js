/**
 * SatRC V2.0 — Selección de nodos regionales
 *
 * Extraído en Etapa 3 (H6.3) para eliminar duplicación entre:
 * - scripts/ejecutar_sara_autonomo.mjs (runner)
 * - src/engine/reportesRegionales.js (frontend)
 *
 * Selecciona la localidad más poblada de cada zona como nodo de referencia.
 * Recibe el array de localidades como parámetro para no acoplar la función
 * al mecanismo de import (fs.readFileSync en Node, import de JSON en Vite).
 *
 * ⚠️ SINCRONIZACIÓN REQUERIDA ⚠️
 * Si cambia el criterio de selección (ej. "más poblada" → "más céntrica"),
 * actualizar AMBOS callers:
 * - scripts/ejecutar_sara_autonomo.mjs
 * - src/engine/reportesRegionales.js
 */

/**
 * Selecciona la localidad más poblada de cada zona como nodo de referencia.
 *
 * @param {Array} localidades - Array de localidades (con zona_id, coords, vulnerabilidad.poblacion).
 * @returns {Object} Objeto indexado por zona_id con { zona_id, zona_nombre, localidad, municipio, lat, lon, poblacion }.
 */
export function seleccionarNodosRegionales(localidades) {
  const zonas = {};

  if (!Array.isArray(localidades)) return zonas;

  localidades.forEach(loc => {
    const zonaId = loc.zona_id;
    if (!zonaId) return;

    const poblacion = parseInt(loc.vulnerabilidad?.poblacion || 0, 10);
    if (!zonas[zonaId] || poblacion > zonas[zonaId].poblacion) {
      zonas[zonaId] = {
        zona_id: zonaId,
        zona_nombre: loc.zona_nombre || zonaId,
        localidad: loc.nombre,
        municipio: loc.municipio,
        lat: loc.coords.lat,
        lon: loc.coords.lon,
        poblacion
      };
    }
  });

  return zonas;
}