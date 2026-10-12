/**
 * SatRC V2.0 — Motor de Reportes Regionales
 * 
 * Construye resúmenes atmosféricos de las 14 zonas de resguardo.
 * Réplica de la lógica del runner (scripts/ejecutar_sara_autonomo.mjs).
 * 
 * ⚠️ SINCRONIZACIÓN REQUERIDA ⚠️
 * La función seleccionarNodosRegionales() existe también en:
 *   scripts/ejecutar_sara_autonomo.mjs (función seleccionarNodosRegionales)
 * Si cambia el criterio de selección (ej. "más poblada" → "más céntrica"),
 * actualizar AMBOS lugares.
 */

import db from '../data/localidades.json';
import { consultarModelosDeterministas } from './meteoFetcher.js';
import { generarConsensoDeterminista } from './consensusEngine.js';

// ============================================================
// CACHÉ GLOBAL DE SERIES (a nivel de módulo)
// Los datos se reutilizan durante 30 minutos entre todos los
// operadores de la misma pestaña del navegador.
// Open-Meteo solo actualiza cada hora, así que 30 min es aceptable.
// ============================================================
let cacheSeries = {
  timestamp: 0,
  data: null
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const TIMEOUT_FETCH_MS = 20000;      // 20 segundos por fetch
const ESPERA_REINTENTO_MS = 3000;    // 3 segundos entre reintentos
const STAGGER_MS = 200;              // 200 ms entre cada fetch

/**
 * Selecciona la localidad más poblada de cada zona como nodo de referencia.
 * Réplica de scripts/ejecutar_sara_autonomo.mjs (seleccionarNodosRegionales).
 */
export function seleccionarNodosRegionales() {
  const todasLocalidades = db.localidades || [];
  const zonas = {};

  todasLocalidades.forEach(loc => {
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

/**
 * Consulta una zona con reintentos. Devuelve la serie de consenso.
 */
async function consultarZonaConReintentos(nodo) {
  const intentos = 2;
  let ultimoError = null;

  for (let i = 1; i <= intentos; i++) {
    try {
      const resM = await consultarModelosDeterministas(nodo.lat, nodo.lon);
      if (!resM?.exito || !resM?.datos_horarios) {
        throw new Error(resM?.error || 'Respuesta sin datos horarios');
      }

      const serie = generarConsensoDeterminista(resM.datos_horarios);
      if (serie.length < 192) {
        throw new Error(`Serie insuficiente: ${serie.length} horas (mínimo 192)`);
      }

      return { ok: true, serie, intentos: i };
    } catch (e) {
      ultimoError = e.message;
      if (i < intentos) {
        await new Promise(r => setTimeout(r, ESPERA_REINTENTO_MS));
      }
    }
  }

  return { ok: false, serie: [], error: ultimoError, intentos };
}

/**
 * Extrae un resumen atmosférico real de la serie de consenso.
 * Serie: 240 horas. Índices 0-167 = 7 días pasados. 168-191 = hoy. 192-215 = mañana.
 * 
 * Ventana ampliada (C2c.2): analizará ayer + hoy + mañana.
 * En C2c.1 solo usamos ayer + hoy.
 */
function construirResumenAtmosferico(serie, nodoNombre) {
  if (!Array.isArray(serie) || serie.length < 192) return null;

  const hoy = serie.slice(168, 192);        // Próximas 24h (hoy)
  const ayer = serie.slice(144, 168);       // Últimas 24h (ayer)

  const lluviaAyer = ayer.reduce((a, h) => a + (h.lluvia_mm || 0), 0);
  const lluviaHoy = hoy.reduce((a, h) => a + (h.lluvia_mm || 0), 0);

  const temps = hoy.map(h => h.temperatura_c).filter(Number.isFinite);
  const vientos = hoy.map(h => h.viento_kmh).filter(Number.isFinite);
  const rafagas = hoy.map(h => h.rafagas_kmh).filter(Number.isFinite);
  const humedades = hoy.map(h => h.humedad_relativa_pct).filter(Number.isFinite);
  const visibilidades = hoy.map(h => h.visibility_km).filter(Number.isFinite);

  const actual = serie[168] || hoy[0] || {};

  const cuentaConfiabilidad = { ALTA: 0, MODERADA: 0, EN_DISPUTA: 0 };
  hoy.forEach(h => {
    if (h.confiabilidad && cuentaConfiabilidad[h.confiabilidad] !== undefined) {
      cuentaConfiabilidad[h.confiabilidad]++;
    }
  });
  const confiabilidadDominante = Object.entries(cuentaConfiabilidad)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'DESCONOCIDA';

  return {
    nodo_nombre: nodoNombre,
    lluvia_ayer_24h_mm: parseFloat(lluviaAyer.toFixed(1)),
    lluvia_hoy_24h_mm: parseFloat(lluviaHoy.toFixed(1)),
    temperatura_min_c: temps.length ? parseFloat(Math.min(...temps).toFixed(1)) : null,
    temperatura_max_c: temps.length ? parseFloat(Math.max(...temps).toFixed(1)) : null,
    temperatura_actual_c: Number.isFinite(actual.temperatura_c) ? parseFloat(actual.temperatura_c.toFixed(1)) : null,
    viento_max_kmh: vientos.length ? parseFloat(Math.max(...vientos).toFixed(1)) : null,
    rafaga_max_kmh: rafagas.length ? parseFloat(Math.max(...rafagas).toFixed(1)) : null,
    humedad_min_pct: humedades.length ? Math.round(Math.min(...humedades)) : null,
    humedad_max_pct: humedades.length ? Math.round(Math.max(...humedades)) : null,
    visibilidad_min_km: visibilidades.length ? parseFloat(Math.min(...visibilidades).toFixed(1)) : null,
    confiabilidad_dominante: confiabilidadDominante
  };
}

/**
 * Construye los 14 resúmenes regionales con caché de 30 minutos.
 * 
 * Devuelve: { zonas_totales, zonas_ok, zonas_fallidas, resumenes }
 */
export async function construirResumenesRegionales() {
  const ahora = Date.now();
  if (cacheSeries.data && (ahora - cacheSeries.timestamp) < CACHE_TTL_MS) {
    console.log('[Reportes Regionales] Usando caché de 30 min');
    return cacheSeries.data;
  }

  console.log('[Reportes Regionales] Consultando 14 nodos (sin caché)');
  const nodos = seleccionarNodosRegionales();
  const zonaIds = Object.keys(nodos);

  const promesas = zonaIds.map((zonaId, indice) => {
    const nodo = nodos[zonaId];
    return new Promise(r => setTimeout(r, indice * STAGGER_MS))
      .then(() => consultarZonaConReintentos(nodo))
      .then(resultado => ({ zonaId, nodo, ...resultado }));
  });

  const resultados = await Promise.allSettled(promesas);

  const resumenes = [];
  const zonasOk = [];
  const zonasFallidas = [];

  resultados.forEach((r, i) => {
    const zonaId = zonaIds[i];
    const nodo = nodos[zonaId];

    if (r.status === 'fulfilled' && r.value.ok) {
      const resumen = construirResumenAtmosferico(r.value.serie, nodo.localidad);
      if (resumen) {
        resumenes.push({
          zona_id: zonaId,
          zona_nombre: nodo.zona_nombre,
          nodo_referencia: `${nodo.localidad} (${nodo.municipio})`,
          poblacion: nodo.poblacion,
          ...resumen
        });
        zonasOk.push(zonaId);
      } else {
        zonasFallidas.push(zonaId);
      }
    } else {
      zonasFallidas.push(zonaId);
    }
  });

  const data = {
    zonas_totales: zonaIds.length,
    zonas_ok: zonasOk.length,
    zonas_fallidas: zonasFallidas,
    resumenes
  };

  cacheSeries.data = data;
  cacheSeries.timestamp = ahora;

  return data;
}

/**
 * Invalida la caché. Se usa cuando el operador pulsa "Generar On-Demand" 
 * por segunda vez consecutiva (para no reutilizar datos viejos en reintentos).
 */
export function invalidarCache() {
  cacheSeries.data = null;
  cacheSeries.timestamp = 0;
  console.log('[Reportes Regionales] Caché invalidada');
}