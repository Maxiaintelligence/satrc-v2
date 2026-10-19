import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { put, list } from '@vercel/blob';
import { generarReporteDiario } from './reportes/reporteDiario.mjs';
import { seleccionarNodosRegionales as seleccionarNodosRegionalesShared } from '../src/lib/compartido/nodos.js';
import { repararMojibake } from '../src/lib/compartido/mojibake.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rutaJSON = path.join(__dirname, '../src/data/localidades.json');
const db = JSON.parse(fs.readFileSync(rutaJSON, 'utf-8'));
const todasLocalidades = db.localidades || [];

console.log(`📡 [SARA RUNNER RESILIENTE] Evaluando ${todasLocalidades.length} localidades...`);

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MIN_HORAS_REQUERIDAS = 192;
const MAX_REGISTROS_BITACORA = 500;
const TIMEOUT_FETCH_MS = 30000;
const ESPERA_REINTENTO_MS = 3000;

// ============================================================
// MOTOR DE CONSENSO MULTI-MODELO
// Replica de consensusEngine.js del frontend.
// Modelos: GFS (EE.UU.), ICON (Alemania), GEM (Canadá)
// ============================================================

function calcularMediana(valores) {
  if (!valores || valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 !== 0) {
    return ordenados[mitad];
  }
  return (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

function filtrarCerosEspurios(p_gfs, p_icon, p_gem) {
  const lecturas = [
    { modelo: 'gfs', valor: Math.max(0, p_gfs || 0) },
    { modelo: 'icon', valor: Math.max(0, p_icon || 0) },
    { modelo: 'gem', valor: Math.max(0, p_gem || 0) }
  ];

  const conLluvia = lecturas.filter(l => l.valor >= 0.5);
  const ceros = lecturas.filter(l => l.valor < 0.1);

  if (conLluvia.length === 2 && ceros.length === 1) {
    return conLluvia.map(l => l.valor);
  }
  return lecturas.map(l => l.valor);
}

function generarConsensoDeterminista(datosHorarios) {
  if (!datosHorarios || !datosHorarios.time) return [];

  const horas = datosHorarios.time;
  const serieConsenso = [];

  for (let i = 0; i < horas.length; i++) {
    // --- Precipitación: mediana con filtro de ceros espurios ---
    const p_gfs = datosHorarios["precipitation_gfs_seamless"]?.[i] ?? datosHorarios["precipitation"]?.[i] ?? 0;
    const p_icon = datosHorarios["precipitation_icon_seamless"]?.[i] ?? 0;
    const p_gem = datosHorarios["precipitation_gem_seamless"]?.[i] ?? 0;

    const valoresValidosLluvia = filtrarCerosEspurios(p_gfs, p_icon, p_gem);
    const lluviaConsenso = calcularMediana(valoresValidosLluvia);

    // --- Temperatura: mediana ---
    const t_gfs = datosHorarios["temperature_2m_gfs_seamless"]?.[i] ?? datosHorarios["temperature_2m"]?.[i] ?? 15;
    const t_icon = datosHorarios["temperature_2m_icon_seamless"]?.[i] ?? 15;
    const t_gem = datosHorarios["temperature_2m_gem_seamless"]?.[i] ?? 15;
    const tempConsenso = calcularMediana([t_gfs, t_icon, t_gem]);

    // --- Viento sostenido: mediana ---
    const v_gfs = datosHorarios["wind_speed_10m_gfs_seamless"]?.[i] ?? datosHorarios["wind_speed_10m"]?.[i] ?? 0;
    const v_icon = datosHorarios["wind_speed_10m_icon_seamless"]?.[i] ?? 0;
    const v_gem = datosHorarios["wind_speed_10m_gem_seamless"]?.[i] ?? 0;
    const vientoConsenso = calcularMediana([v_gfs, v_icon, v_gem]);

    // --- Ráfagas: máximo (criterio conservador) ---
    const r_gfs = datosHorarios["wind_gusts_10m_gfs_seamless"]?.[i] ?? datosHorarios["wind_gusts_10m"]?.[i] ?? 0;
    const r_icon = datosHorarios["wind_gusts_10m_icon_seamless"]?.[i] ?? 0;
    const r_gem = datosHorarios["wind_gusts_10m_gem_seamless"]?.[i] ?? 0;
    const rafagaConsenso = Math.max(r_gfs, r_icon, r_gem);

    // --- Humedad relativa: mediana ---
    const h_gfs = datosHorarios["relative_humidity_2m_gfs_seamless"]?.[i] ?? datosHorarios["relative_humidity_2m"]?.[i] ?? 50;
    const h_icon = datosHorarios["relative_humidity_2m_icon_seamless"]?.[i] ?? 50;
    const h_gem = datosHorarios["relative_humidity_2m_gem_seamless"]?.[i] ?? 50;
    const humedadConsenso = calcularMediana([h_gfs, h_icon, h_gem]);

    // --- Visibilidad: solo GFS la provee. ICON y GEM no. ---
    const vis = (datosHorarios["visibility_gfs_seamless"]?.[i]
              ?? datosHorarios["visibility"]?.[i]
              ?? 10000) / 1000;

    // --- Confiabilidad según dispersión inter-modelo ---
    const dispersion = Math.max(p_gfs, p_icon, p_gem) - Math.min(p_gfs, p_icon, p_gem);
    let confiabilidad = "ALTA";
    if (dispersion > 12.0) confiabilidad = "EN_DISPUTA";
    else if (dispersion > 4.0) confiabilidad = "MODERADA";

    serieConsenso.push({
      fecha_hora: horas[i],
      lluvia_mm: parseFloat(lluviaConsenso.toFixed(1)),
      temperatura_c: parseFloat(tempConsenso.toFixed(1)),
      viento_kmh: parseFloat(vientoConsenso.toFixed(1)),
      rafagas_kmh: parseFloat(rafagaConsenso.toFixed(1)),
      humedad_relativa_pct: Math.round(humedadConsenso),
      visibility_km: vis,
      confiabilidad: confiabilidad,
      detalle_modelos: {
        lluvia: { gfs: p_gfs, icon: p_icon, gem: p_gem },
        temp: { gfs: t_gfs, icon: t_icon, gem: t_gem }
      }
    });
  }

  return serieConsenso;
}

// ============================================================
// SELECCIÓN DE NODOS REGIONALES
// ============================================================

/**
 * Wrapper local: pasa `todasLocalidades` a la función compartida.
 * Mantiene la firma `seleccionarNodosRegionales()` sin parámetros
 * para no romper los callers existentes en el runner.
 */
function seleccionarNodosRegionales() {
  return seleccionarNodosRegionalesShared(todasLocalidades);
}

// ============================================================
// CONSULTA DE OPEN-METEO POR ZONA (con reintentos)
// ============================================================

async function consultarZonaUnaVez(nodo) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${nodo.lat}&longitude=${nodo.lon}` +
              `&hourly=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,visibility` +
              `&models=gfs_seamless,icon_seamless,gem_seamless&past_days=7&forecast_days=3&timezone=America%2FMexico_City`;

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_FETCH_MS) });
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.hourly || !data.hourly.time) {
    throw new Error("Respuesta sin bloque hourly");
  }

  const serie = generarConsensoDeterminista(data.hourly);

  if (serie.length < MIN_HORAS_REQUERIDAS) {
    throw new Error(`Serie insuficiente: ${serie.length} horas (mínimo ${MIN_HORAS_REQUERIDAS})`);
  }

  return serie;
}

async function consultarZonaConReintentos(nodo) {
  const intentos = 2;
  let ultimoError = null;

  for (let i = 1; i <= intentos; i++) {
    try {
      const serie = await consultarZonaUnaVez(nodo);
      return { ok: true, serie, intentos: i };
    } catch (e) {
      ultimoError = e.message;
      if (i < intentos) {
        console.warn(`  ⏳ [${nodo.zona_id}] Intento ${i} falló: ${e.message}. Reintentando en ${ESPERA_REINTENTO_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, ESPERA_REINTENTO_MS));
      }
    }
  }

  return { ok: false, serie: [], error: ultimoError, intentos };
}

async function cargarSeriesRegionales(nodos) {
  const zonaIds = Object.keys(nodos);
  console.log(`\n🌐 Consultando ${zonaIds.length} nodos regionales en lotes de 4 (GFS + ICON + GEM)...`);

  const t0 = Date.now();

  // N26 — Lotes de 4 en vuelo simultáneo para no saturar Open-Meteo.
  // Réplica del patrón usado en src/engine/reportesRegionales.js (frontend).
  // Cada lote espera a que sus 4 fetches terminen antes de disparar el siguiente.
  const TAMANO_LOTE = 4;
  const DELAY_ENTRE_LOTES_MS = 500;

  const series = {};
  const zonasOk = [];
  const zonasFallidas = [];

  for (let i = 0; i < zonaIds.length; i += TAMANO_LOTE) {
    const lote = zonaIds.slice(i, i + TAMANO_LOTE);
    const numeroLote = Math.floor(i / TAMANO_LOTE) + 1;
    const totalLotes = Math.ceil(zonaIds.length / TAMANO_LOTE);
    console.log(`\n  📦 Lote ${numeroLote}/${totalLotes}: ${lote.join(', ')}`);

    const promesasLote = lote.map(zonaId => {
      const nodo = nodos[zonaId];
      return consultarZonaConReintentos(nodo)
        .then(resultado => ({ zonaId, nodo, ...resultado }));
    });

    const resultadosLote = await Promise.allSettled(promesasLote);

    resultadosLote.forEach((r, j) => {
      const zonaId = lote[j];
      if (r.status === 'fulfilled') {
        series[zonaId] = r.value;
        if (r.value.ok) {
          zonasOk.push(`${zonaId}(${r.value.serie.length}h)`);
          console.log(`    ✅ [${zonaId}] ${r.value.serie.length}h en ${r.value.intentos} intento(s)`);
        } else {
          zonasFallidas.push(zonaId);
          console.warn(`    ❌ [${zonaId}] Falló después de ${r.value.intentos} intentos: ${r.value.error}`);
        }
      } else {
        series[zonaId] = { ok: false, serie: [], error: r.reason?.message || 'Promise rechazada', intentos: 0 };
        zonasFallidas.push(zonaId);
        console.error(`    ❌ [${zonaId}] Error inesperado: ${r.reason?.message}`);
      }
    });

    // Delay entre lotes (excepto después del último)
    if (i + TAMANO_LOTE < zonaIds.length) {
      await new Promise(r => setTimeout(r, DELAY_ENTRE_LOTES_MS));
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n📊 Cobertura: ${zonasOk.length}/${zonaIds.length} zonas OK en ${dt}s`);
  if (zonasFallidas.length > 0) {
    console.warn(`⚠️  Zonas sin datos: ${zonasFallidas.join(', ')}`);
  }

  return { series, zonasOk, zonasFallidas };
}

// ============================================================
// HELPERS (fecha, hash, IDs, normalización)
// ============================================================

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

function obtenerFechaHoraMexico(fecha = new Date()) {
  const fechaDia = fecha.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City', day: '2-digit', month: 'long', year: 'numeric'
  });
  const horaExacta = fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  const horaCorta = fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true
  });
  return { fechaDia, horaExacta, horaCorta };
}

function normalizarEstadoSituacion(estadoRaw) {
  if (!estadoRaw || typeof estadoRaw !== 'string') return 'SITUACION_NORMAL';
  const limpio = estadoRaw.trim().toUpperCase();
  if (limpio === 'CORRIDA_DEGRADADA') return 'CORRIDA_DEGRADADA';
  if (limpio === 'SITUACION_CRITICA' || limpio === 'CRITICA' || limpio === 'CRÍTICA' || limpio === 'EMERGENCIA') return 'SITUACION_CRITICA';
  if (limpio === 'SITUACION_GRAVE' || limpio === 'GRAVE' || limpio === 'ALERTA') return 'SITUACION_GRAVE';
  return 'SITUACION_NORMAL';
}

/**
 * N28 — Detección de la ventana del reporte diario.
 * 
 * Reglas:
 * 1. La hora México debe ser >= 06:00.
 * 2. No debe existir una entrada PROGRAMADO_REPORTE_DIARIO con la fecha de hoy.
 * 
 * @param {string} horaMexicoStr - Hora en formato "06:00 a.m."
 * @param {string} fechaDiaMexico - Fecha en formato "16 de octubre de 2026"
 * @param {Array} bitacoraHistorial - Historial de bitácora
 * @returns {boolean} - true si debe generarse el reporte diario
 */
function debeGenerarReporteDiario(horaMexicoStr, fechaDiaMexico, bitacoraHistorial) {
  // 1. Parsear la hora: extraer la hora en formato 24h
  const match = horaMexicoStr.match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)/i);
  if (!match) return false;

  let horas = parseInt(match[1], 10);
  const minutos = parseInt(match[2], 10);
  const periodo = match[3].toLowerCase();

  if (periodo.startsWith('p') && horas !== 12) horas += 12;
  if (periodo.startsWith('a') && horas === 12) horas = 0;

  // 2. Verificar que la hora >= 6:00 (360 minutos desde medianoche)
  const minutosDesdeMedianoche = horas * 60 + minutos;
  if (minutosDesdeMedianoche < 360) {
    return false; // aún no son las 6 AM
  }

  // 3. Verificar que no exista un reporte diario hoy
  const yaExiste = bitacoraHistorial.some(entry =>
    entry.origen_evento === 'PROGRAMADO_REPORTE_DIARIO' &&
    entry.fecha_dia_mexico === fechaDiaMexico
  );

  return !yaExiste;
}

function siguienteIdBitacora(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return 1;
  let maxId = 0;
  for (const entry of historial) {
    if (!entry?.id) continue;
    const num = parseInt(String(entry.id).replace('SARA_LOG_', ''), 10);
    if (Number.isFinite(num) && num > maxId) maxId = num;
  }
  return maxId + 1;
}

// ============================================================
// REGISTRO DE CORRIDA DEGRADADA
// ============================================================

async function registrarCorridaDegradada(horaMexicoStr, fechaDiaMexico, horaExactaMexico, ahora, motivo) {
  try {
    let bitacoraHistorial = [];
    let ultimoDictamenPrevio = null;
    try {
      const listado = await list();
      const blobB = listado?.blobs?.find(b => b.pathname.includes('bitacora_sara.json'));
      if (blobB) {
        const rB = await fetch(blobB.url, { cache: 'no-store' });
        if (rB.ok) {
          const dB = await rB.json();
          bitacoraHistorial = dB.bitacora || [];
          ultimoDictamenPrevio = dB.ultimo_dictamen || null;
        }
      }
    } catch (e) {}

    const prevHash = bitacoraHistorial.length > 0
      ? bitacoraHistorial[bitacoraHistorial.length - 1].hash_completo
      : BLOQUE_GENESIS;
    const nuevoHash = generarHashSHA256(prevHash, ahora.toISOString(), { tipo: "CORRIDA_DEGRADADA", motivo });
    const nuevoId = siguienteIdBitacora(bitacoraHistorial);

    bitacoraHistorial.push({
      id: `SARA_LOG_${nuevoId}`,
      fecha_dia_mexico: fechaDiaMexico,
      hora_exacta_mexico: horaExactaMexico,
      timestamp_iso_utc: ahora.toISOString(),
      timestamp_local: horaMexicoStr,
      origen_evento: "CORRIDA_DEGRADADA",
      estado_situacion: "CORRIDA_DEGRADADA",
      titulo: "Corrida degradada: sin datos meteorológicos de ninguna zona",
      resumen: `${motivo} a las ${horaMexicoStr}. No se publicó evaluación nueva para evitar alertas falsas.`,
      prev_hash: prevHash.slice(0, 16) + "...",
      hash: nuevoHash.slice(0, 16) + "...",
      hash_completo: nuevoHash
    });

    if (bitacoraHistorial.length > MAX_REGISTROS_BITACORA) {
      bitacoraHistorial = bitacoraHistorial.slice(-MAX_REGISTROS_BITACORA);
    }

    const payloadBitacora = { bitacora: bitacoraHistorial };
    if (ultimoDictamenPrevio) payloadBitacora.ultimo_dictamen = ultimoDictamenPrevio;

    await put('bitacora_sara.json', JSON.stringify(payloadBitacora), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log("📝 Corrida degradada registrada en bitácora SHA-256.");
  } catch (e) {
    console.error("❌ No se pudo registrar la corrida degradada:", e);
  }
}

// ============================================================
// EJECUCIÓN PRINCIPAL
// ============================================================

async function ejecutarSARA() {
  const ahora = new Date();
  const { fechaDia: fechaDiaMexico, horaExacta: horaExactaMexico, horaCorta: horaMexicoStr } = obtenerFechaHoraMexico(ahora);
  const proximaCorridaStr = obtenerFechaHoraMexico(new Date(ahora.getTime() + 3 * 3600000)).horaCorta;

  // --- 1. Aviso SMN (scraping de la página principal, alineado con api/smn.js) ---
  let alertaSMN = null;
  try {
    const SMN_URL = "https://smn.conagua.gob.mx/es/";
    const resSMN = await fetch(SMN_URL, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 SatRC-Runner/2.0",
        "Accept": "text/html,application/xhtml+xml"
      }
    }).catch(() => null);

    if (resSMN && resSMN.ok) {
      const texto = (await resSMN.text()).toLowerCase();

      // Detección de entidades de la jurisdicción diocesana
      const mencionaHidalgo = texto.includes("hidalgo");
      const mencionaPuebla = texto.includes("puebla");
      const mencionaVeracruz = texto.includes("veracruz");
      const afectaRegion = mencionaHidalgo || mencionaPuebla || mencionaVeracruz;

      // Detección de fenómenos con patrones reales del SMN
      const hayTorrenciales = texto.includes("torrenciales");
      const hayIntensas = texto.includes("lluvias intensas") || texto.includes("lluvias puntuales intensas");
      const hayFuertes = texto.includes("lluvias fuertes") || texto.includes("lluvias muy fuertes");
      const hayChubascos = texto.includes("chubascos");
      const hayFrenteFrio = texto.includes("frente frío") || texto.includes("masa de aire polar");
      const hayCiclon = texto.includes("huracán") || texto.includes("tormenta tropical") || texto.includes("ciclón");

      if (afectaRegion) {
        const estados = [];
        if (mencionaHidalgo) estados.push("HGO");
        if (mencionaPuebla) estados.push("PUE");
        if (mencionaVeracruz) estados.push("VER");

        if (hayTorrenciales) {
          alertaSMN = {
            activo: true,
            nivel: 3,
            severidad: "Aviso Severo",
            titulo: "Lluvias Torrenciales en la Región",
            rango_lluvia_min_mm: 75,
            rango_lluvia_max_mm: 150,
            estados_afectados: estados
          };
          console.log(`🏛️ Aviso Severo del SMN (Lluvias Torrenciales) para ${estados.join(', ')}.`);
        } else if (hayIntensas) {
          alertaSMN = {
            activo: true,
            nivel: 2,
            severidad: "Aviso Preventivo",
            titulo: "Lluvias Intensas en la Región",
            rango_lluvia_min_mm: 25,
            rango_lluvia_max_mm: 75,
            estados_afectados: estados
          };
          console.log(`🏛️ Aviso Preventivo del SMN (Lluvias Intensas) para ${estados.join(', ')}.`);
        } else if (hayFuertes || hayChubascos) {
          alertaSMN = {
            activo: true,
            nivel: 2,
            severidad: "Aviso Preventivo",
            titulo: "Lluvias Fuertes en la Región",
            rango_lluvia_min_mm: 10,
            rango_lluvia_max_mm: 25,
            estados_afectados: estados
          };
          console.log(`🏛️ Aviso Preventivo del SMN (Lluvias Fuertes) para ${estados.join(', ')}.`);
        } else if (hayFrenteFrio) {
          alertaSMN = {
            activo: true,
            nivel: 2,
            severidad: "Aviso Preventivo",
            titulo: "Frente Frío en la Región",
            rango_lluvia_min_mm: 0,
            rango_lluvia_max_mm: 25,
            estados_afectados: estados
          };
          console.log(`🏛️ Aviso Preventivo del SMN (Frente Frío) para ${estados.join(', ')}.`);
        } else if (hayCiclon) {
          alertaSMN = {
            activo: true,
            nivel: 3,
            severidad: "Aviso Severo",
            titulo: "Ciclón o Tormenta Tropical en la Región",
            rango_lluvia_min_mm: 50,
            rango_lluvia_max_mm: 200,
            estados_afectados: estados
          };
          console.log(`🏛️ Aviso Severo del SMN (Ciclón/Tormenta Tropical) para ${estados.join(', ')}.`);
        } else {
          console.log("🏛️ La región aparece en la página del SMN, pero sin fenómeno severo detectado.");
        }
      } else {
        console.log("🏛️ Sin avisos extraordinarios del SMN para Hidalgo/Puebla/Veracruz en este ciclo.");
      }
    } else {
      console.log("🏛️ Sin conexión con SMN; evaluando únicamente con modelos meteorológicos vivos.");
    }
  } catch (e) {
    console.log("🏛️ Error consultando el SMN; evaluando únicamente con modelos meteorológicos vivos.");
  }

  // --- 2. Cargar series por zona ---
  const nodos = seleccionarNodosRegionales();
  console.log(`\n🗺️  Nodos regionales seleccionados: ${Object.keys(nodos).length} zonas`);
  Object.values(nodos).forEach(n => {
    console.log(`  ${n.zona_id.padEnd(5)} | ${n.localidad.padEnd(32)} | ${n.poblacion.toLocaleString()} hab.`);
  });

  const { series, zonasOk, zonasFallidas } = await cargarSeriesRegionales(nodos);

  // --- 3. Modo degradado si TODAS las zonas fallaron ---
  if (zonasOk.length === 0) {
    const motivo = `Falla total de Open-Meteo en las ${Object.keys(nodos).length} zonas.`;
    console.error("\n⚠️  MODO DEGRADADO ACTIVADO (falla total)");
    console.error(`⚠️  Motivo: ${motivo}`);
    await registrarCorridaDegradada(horaMexicoStr, fechaDiaMexico, horaExactaMexico, ahora, motivo);
    console.log("ℹ️  Corrida finalizada en modo degradado. Workflow sale con código 0.");
    process.exit(0);
  }

  // --- 4. Construir seriesPorZona ---
  const seriesPorZona = {};
  Object.keys(nodos).forEach(zonaId => {
    seriesPorZona[zonaId] = series[zonaId]?.ok ? series[zonaId].serie : [];
  });

  // --- 5. Evaluación por localidad ---
  const evaluaciones = todasLocalidades.map(loc => {
    const zonaId = loc.zona_id;
    const serieZona = seriesPorZona[zonaId] || [];
    const zonaSinDatos = series[zonaId]?.ok === false;

    const esAltiplano = ['ACT', 'APN', 'PMN', 'PMS', 'TIZ'].includes(zonaId);
    const esSierra = ['ATG', 'CHG', 'HUA', 'HYC', 'SPP', 'TUL', 'XIC', 'ZAC', 'ZAH'].includes(zonaId);

    // Cálculos previos sobre la serie consenso de la zona
    let api7DiasPrevios = 0;
    if (serieZona.length >= 168) {
      for (let d = 1; d <= 7; d++) {
        const idxInicio = (d - 1) * 24;
        const idxFin = d * 24;
        const lluviaDia = serieZona.slice(idxInicio, idxFin).reduce((acc, h) => acc + h.lluvia_mm, 0);
        api7DiasPrevios += lluviaDia * Math.pow(0.85, 8 - d);
      }
    }
    api7DiasPrevios = parseFloat(api7DiasPrevios.toFixed(1));

    const eventoActual = serieZona.length >= 192 ? serieZona.slice(168, 192) : [];
    const lluviaEventoHoy = parseFloat(eventoActual.reduce((acc, h) => acc + h.lluvia_mm, 0).toFixed(1));
    const tempMinHoy = eventoActual.length ? Math.min(...eventoActual.map(h => h.temperatura_c), 20) : 20;
    const vientoMaxHoy = eventoActual.length ? Math.max(...eventoActual.map(h => h.viento_kmh), 10) : 10;
    const rafagaMaxHoy = eventoActual.length ? Math.max(...eventoActual.map(h => h.rafagas_kmh), 15) : 15;
    const visMinHoy = eventoActual.length ? Math.min(...eventoActual.map(h => h.visibility_km)) : 999;

    const pendiente = loc.topografia.pendiente_max_deg || 0;
    const relieve = loc.topografia.relieve || 'MESETA';
    const esLadera = relieve === 'LADERA' || pendiente >= 25;
    const distRio = loc.hidrologia.distancia_cauce_km || 99;
    const twi = loc.topografia.twi || 0;
    const esTerraceria = loc.vulnerabilidad.acceso_vial === 'CAMINO_TERRACERIA' || loc.vulnerabilidad.acceso_vial === 'BRECHA';

    // H-MOTOR-06 — Solo aplicar el piso del aviso SMN si la localidad está en un estado afectado.
    // El parser SMN detecta 3 estados (HGO, PUE, VER). Antes se aplicaba el piso a TODAS las zonas de Sierra, sobre-alertando.
    const estadoAfectado = !!(alertaSMN?.estados_afectados?.some(e =>
      (e === 'HGO' && loc.estado?.toLowerCase().includes('hidalgo')) ||
      (e === 'PUE' && loc.estado?.toLowerCase().includes('puebla')) ||
      (e === 'VER' && loc.estado?.toLowerCase().includes('veracruz'))
    ));
    const lluviaEfectiva24h = (esSierra && alertaSMN && estadoAfectado)
      ? Math.max(lluviaEventoHoy, alertaSMN.rango_lluvia_min_mm || 0)
      : lluviaEventoHoy;
    const saturacionSuelo = parseFloat((api7DiasPrevios + lluviaEfectiva24h).toFixed(1));

    let nivel = 1;
    let vectorDominante = zonaSinDatos ? "SIN_DATOS_REGIONALES" : "ATMOSFERA_ESTABLE";
    let tituloDiagnostico = zonaSinDatos ? "Sin datos meteorológicos regionales" : "Condiciones de Estabilidad y Calma";
    let causa = zonaSinDatos
      ? `La zona ${zonaId} no reportó datos meteorológicos en esta corrida.`
      : "Sin perturbaciones climáticas significativas previstas.";

    if (!zonaSinDatos) {
      if (esAltiplano && pendiente < 15 && lluviaEventoHoy < 20.0 && tempMinHoy > 2.0 && vientoMaxHoy < 40) {
        nivel = 1;
        vectorDominante = "ATMOSFERA_ESTABLE";
        tituloDiagnostico = "Condiciones de Estabilidad y Calma";
        causa = `Zona del Altiplano bajo sombra orográfica. Lluvia de ${lluviaEventoHoy} mm sin riesgo geofísico.`;
      } else {
        if (esSierra && esLadera && saturacionSuelo >= 65.0) {
          if (pendiente >= 45.0) {
            nivel = 4;
            vectorDominante = "DESLAVE_CRITICO";
            tituloDiagnostico = "Peligro Crítico de Deslave en Ladera Escarpada";
            causa = `Suelo saturado (${saturacionSuelo} mm) sobre talud crítico de ${pendiente}°. Falla inminente.`;
          } else {
            nivel = Math.max(nivel, 3);
            vectorDominante = "DESLAVE_MODERADO";
            tituloDiagnostico = "Saturación Crítica de Terreno";
            causa = `Reblandecimiento de estratos en ladera de ${pendiente}° con desprendimientos menores.`;
          }
        }

        if (distRio <= 0.8 && twi >= 12.0 && lluviaEfectiva24h >= 35.0 && !esAltiplano) {
          nivel = Math.max(nivel, 4);
          vectorDominante = "INUNDACION_FLUVIAL";
          tituloDiagnostico = "Desbordamiento e Inundación Ribereña";
          causa = `Comunidad ribereña a ${distRio} km del cauce en punto de convergencia de flujo.`;
        }

        if (esTerraceria && (lluviaEfectiva24h >= 20.0 || saturacionSuelo >= 50.0) && nivel < 3) {
          nivel = 3;
          vectorDominante = "CORTE_VIAL";
          tituloDiagnostico = "Amenaza de Incomunicación y Corte de Acceso";
          causa = `Vía única de terracería/brecha vulnerable a corte total por lodo.`;
        }

        if (nivel === 1 && (lluviaEfectiva24h >= 8.0 || saturacionSuelo >= 30.0 || visMinHoy <= 2.0)) {
          nivel = 2;
          vectorDominante = "VIGILANCIA_NORMAL";

          // N20: identificar el disparador real de la vigilancia
          if (lluviaEfectiva24h >= 8.0) {
            tituloDiagnostico = "Vigilancia por Precipitación Activa";
            causa = `Precipitación activa en las últimas 24h (${lluviaEfectiva24h} mm). Suelo húmedo en valles y lomas de transición.`;
          } else if (saturacionSuelo >= 30.0) {
            tituloDiagnostico = "Vigilancia por Suelo Saturado";
            causa = `Suelo con humedad acumulada (${saturacionSuelo} mm de saturación). Sin lluvia activa, pero terreno sensible a nuevos eventos.`;
          } else if (visMinHoy <= 2.0) {
            tituloDiagnostico = "Vigilancia por Niebla Densa";
            causa = `Visibilidad reducida a ${visMinHoy} km. Niebla densa en valles y lomas de transición.`;
          } else {
            tituloDiagnostico = "Vigilancia Preventiva";
            causa = "Condiciones de vigilancia activa en la zona.";
          }
        }
      }
    }

    return {
      localidad_id: loc.id,
      nombre: loc.nombre,
      municipio: loc.municipio,
      estado: loc.estado,
      zona_id: zonaId,
      zona_nombre: loc.zona_nombre,
      nivel_alerta: nivel,
      color_alerta: ['#10B981', '#F59E0B', '#F97316', '#EF4444'][nivel - 1],
      estado_alerta: ['NORMAL', 'VIGILANCIA', 'ALERTA_TEMPRANA', 'EMERGENCIA'][nivel - 1],
      vector_dominante: vectorDominante,
      sin_datos_regionales: zonaSinDatos,
      diagnostico: { titulo: tituloDiagnostico, causa: causa },
      donde: {
        subcuenca_cve: loc.hidrologia.subcuenca_cve,
        subcuenca_nom: loc.hidrologia.subcuenca_nom,
        posicion_hidrologica: loc.hidrologia.posicion,
        tipo_relieve: relieve,
        pendiente_max_grados: pendiente,
        distancia_cauce_km: distRio,
        coordenadas: loc.coords
      },
      geografia: { relieve, pendienteMax: pendiente, distanciaRioKm: distRio, twi, cuenca: loc.hidrologia.subcuenca_nom, coordenadas: loc.coords },
      tiempos: { inicio: "En curso", picoMaximo: "Periodo activo", ventanaAccionHoras: loc.hidrologia.tc_horas || 6 },
      impactoSistemico: {
        poblacionDirecta: loc.vulnerabilidad.poblacion,
        accesoVial: loc.vulnerabilidad.acceso_vial,
        distanciaHospitalKm: loc.vulnerabilidad.dist_hospital_km,
        marginacion: loc.vulnerabilidad.marginacion,
        apiPrevio7DiasMm: api7DiasPrevios,
        saturacionTotalSueloMm: saturacionSuelo,
        lluviaEvento24hMm: parseFloat(lluviaEfectiva24h.toFixed(1)),
        tempMinimaC: tempMinHoy,
        rafagaMaximaKmh: rafagaMaxHoy,
        visibilidadMinKm: visMinHoy
      },
      protocolo: "Consulte al coordinador de Cáritas"
    };
  });

  evaluaciones.sort((a, b) => b.nivel_alerta - a.nivel_alerta);

  const n4 = evaluaciones.filter(e => e.nivel_alerta === 4).length;
  const n3 = evaluaciones.filter(e => e.nivel_alerta === 3).length;
  const n2 = evaluaciones.filter(e => e.nivel_alerta === 2).length;
  const n1 = evaluaciones.filter(e => e.nivel_alerta === 1).length;
  const sinDatos = evaluaciones.filter(e => e.sin_datos_regionales).length;
  const criticas = evaluaciones.filter(e => e.nivel_alerta >= 3).slice(0, 6).map(c => `${c.nombre} (${c.municipio})`);

  console.log(`📊 [SARA CONSENSO GFS+ICON+GEM] N4: ${n4} | N3: ${n3} | N2: ${n2} | N1: ${n1} | Sin datos: ${sinDatos}`);

  // --- 6. Inferencia con Groq ---
  let dictamenSARA = null;
  const apiKeyGroq = process.env.GROQ_API_KEY;

  if (apiKeyGroq) {
    try {
      const resG = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKeyGroq.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `Eres SARA, Oficial Meteoróloga de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo. Hora oficial de México: ${horaMexicoStr}.
Genera el informe diocesano multimodal en JSON con claves: estado_situacion, color, titulo, comentario_oficial.
REGLA CRÍTICA DE COHERENCIA (OBLIGATORIA):
- Si N4 > 0: estado_situacion DEBE ser "SITUACION_CRITICA", color DEBE ser "#EF4444", titulo DEBE mencionar la emergencia (ej. "Emergencia por Lluvias Torrenciales en la Región").
- Si N4 = 0 y N3 > 0: estado_situacion DEBE ser "SITUACION_GRAVE", color DEBE ser "#F97316", titulo DEBE mencionar alerta (ej. "Alerta Temprana por Lluvias Intensas").
- Si N4 = 0 y N3 = 0: estado_situacion DEBE ser "SITUACION_NORMAL", color DEBE ser "#10B981", titulo DEBE ser sereno.
Esta regla es determinista. NO puedes declarar "Normal" si hay N4 > 0 o N3 > 0. El conteo de niveles es la fuente de verdad.
REGLA: NO menciones conteos numéricos en el comentario_oficial. Se agregarán aparte en la bitácora.` },
{ role: "user", content: `Hora México: ${horaMexicoStr}. Aviso SMN: ${alertaSMN ? `${alertaSMN.titulo} (Nivel ${alertaSMN.nivel || 'N/D'}, lluvia esperada ${alertaSMN.rango_lluvia_min_mm || 0}-${alertaSMN.rango_lluvia_max_mm || 0} mm)` : 'Sin aviso severo vigente'}.
Zonas OK: ${zonasOk.length}/${Object.keys(nodos).length}. Zonas sin datos: ${zonasFallidas.join(', ') || 'ninguna'}.
Consenso: GFS + ICON + GEM.
Nivel 4: ${n4}, Nivel 3: ${n3}, Nivel 2: ${n2}, Nivel 1: ${n1}.
Comunidades críticas bajo tensión: ${JSON.stringify(criticas)}.` }
          ]
        })
      });

      if (resG.ok) {
        const dataG = await resG.json();
        dictamenSARA = JSON.parse(dataG.choices[0].message.content);
      }
    } catch (e) {
      console.warn("Fallo Groq en runner:", e);
    }
  }

  if (!dictamenSARA) {
    dictamenSARA = {
      estado_situacion: n4 > 0 ? "SITUACION_CRITICA" : (n3 > 0 ? "SITUACION_GRAVE" : "SITUACION_NORMAL"),
      color: n4 > 0 ? "#EF4444" : (n3 > 0 ? "#F97316" : "#10B981"),
      titulo: n4 > 0 ? "Emergencia por Deslaves en Taludes >= 45°" : (n3 > 0 ? "Alerta Temprana en Laderas Serranas" : "Situación Diocesana de Calma"),
      comentario_oficial: `Corrida autónoma multi-nodo con consenso GFS+ICON+GEM (${horaMexicoStr}): ${zonasOk.length} zonas evaluadas.`
    };
  }

  dictamenSARA.estado_situacion = normalizarEstadoSituacion(dictamenSARA.estado_situacion);
  dictamenSARA.hora_evaluacion = horaMexicoStr;
  dictamenSARA.proxima_evaluacion = proximaCorridaStr;
  dictamenSARA.timestamp = ahora.toISOString();

  // N24 — Reparar mojibake en los textos del dictamen
  if (typeof dictamenSARA.titulo === 'string') dictamenSARA.titulo = repararMojibake(dictamenSARA.titulo);
  if (typeof dictamenSARA.comentario_oficial === 'string') dictamenSARA.comentario_oficial = repararMojibake(dictamenSARA.comentario_oficial);

  // --- 7. Bitácora ---
  let bitacoraHistorial = [];
  try {
    const listado = await list();
    const blobB = listado?.blobs?.find(b => b.pathname.includes('bitacora_sara.json'));
    if (blobB) {
      const rB = await fetch(blobB.url, { cache: 'no-store' });
      if (rB.ok) {
        const dB = await rB.json();
        bitacoraHistorial = dB.bitacora || [];
      }
    }
  } catch (e) {}

  const prevHash = bitacoraHistorial.length > 0 ? bitacoraHistorial[bitacoraHistorial.length - 1].hash_completo : BLOQUE_GENESIS;
  const nuevoHash = generarHashSHA256(prevHash, dictamenSARA.timestamp, { n4, n3, n2, n1, zonaOk: zonasOk.length, hora: horaMexicoStr, consenso: "GFS+ICON+GEM" });
  const nuevoId = siguienteIdBitacora(bitacoraHistorial);

  bitacoraHistorial.push({
    id: `SARA_LOG_${nuevoId}`,
    fecha_dia_mexico: fechaDiaMexico,
    hora_exacta_mexico: horaExactaMexico,
    timestamp_iso_utc: dictamenSARA.timestamp,
    timestamp_local: horaMexicoStr,
    origen_evento: "PROGRAMADO_CRON",
    estado_situacion: dictamenSARA.estado_situacion,
    titulo: dictamenSARA.titulo,
    resumen: `N4=${n4}, N3=${n3}, N2=${n2}, N1=${n1} | Zonas OK: ${zonasOk.length}/${Object.keys(nodos).length}. ${dictamenSARA.comentario_oficial}`,
    prev_hash: prevHash.slice(0, 16) + "...",
    hash: nuevoHash.slice(0, 16) + "...",
    hash_completo: nuevoHash
  });

  if (bitacoraHistorial.length > MAX_REGISTROS_BITACORA) {
    bitacoraHistorial = bitacoraHistorial.slice(-MAX_REGISTROS_BITACORA);
  }

  // --- 8. Publicación ---
  const seriesPorZonaMeta = {};
  Object.keys(nodos).forEach(zonaId => {
    seriesPorZonaMeta[zonaId] = {
      nodo_referencia: nodos[zonaId].localidad,
      municipio: nodos[zonaId].municipio,
      poblacion: nodos[zonaId].poblacion,
      ok: series[zonaId]?.ok === true,
      horas: series[zonaId]?.serie?.length || 0,
      intentos: series[zonaId]?.intentos || 0,
      error: series[zonaId]?.error || null
    };
  });

  const paqueteMaestro = {
    actualizado_iso: ahora.toISOString(),
    hora_local_mexico: horaMexicoStr,
    dictamen: dictamenSARA,
    semaforo: { totalNivel4: n4, totalNivel3: n3, totalNivel2: n2, totalNivel1: n1 },
    zonas_sin_datos: zonasFallidas,
    series_por_zona: seriesPorZonaMeta,
    motor_consenso: "GFS + ICON + GEM (mediana con filtro de ceros)",
    evaluaciones: evaluaciones
  };

  // --- 7.5. Reporte Diario Automático (6:00 AM) ---
  // N28: Detectar si toca generar el reporte diario.
  if (apiKeyGroq && debeGenerarReporteDiario(horaMexicoStr, fechaDiaMexico, bitacoraHistorial)) {
    console.log('\n📋 [N28] Es la ventana del reporte diario. Generando...');
    try {
      const resultado = await generarReporteDiario({
        seriesPorZona,
        nodos,
        evaluaciones,
        semaforo: { totalNivel4: n4, totalNivel3: n3, totalNivel2: n2, totalNivel1: n1 },
        alertaSMN,
        fechaDiaMexico,
        horaExactaMexico,
        horaMexicoStr,
        apiKeyGroq,
        blobToken: process.env.BLOB_READ_WRITE_TOKEN
      });
      console.log(`📋 [N28] Reporte diario ${resultado.es_parcial ? 'PARCIAL' : 'COMPLETO'} generado.`);

      // Añadir la entrada del reporte diario al historial de bitácora local
      if (resultado.registro_bitacora) {
        bitacoraHistorial.push(resultado.registro_bitacora);
      }
    } catch (e) {
      console.error('❌ [N28] Fallo generando reporte diario:', e.message);
      // No interrumpir el flujo principal. El estado se publica igual.
    }
  }


  try {
    await put('estado_diocesano.json', JSON.stringify(paqueteMaestro), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    await put('bitacora_sara.json', JSON.stringify({ bitacora: bitacoraHistorial, ultimo_dictamen: dictamenSARA }), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log(`✅ [SARA RUNNER] Publicación exitosa con ${zonasOk.length} zonas y consenso GFS+ICON+GEM a las ${horaMexicoStr}.`);
  } catch (e) {
    console.error("❌ Error al publicar en Vercel Blob:", e);
    process.exit(1);
  }
}

ejecutarSARA();