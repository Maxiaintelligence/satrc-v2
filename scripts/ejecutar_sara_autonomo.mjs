import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { put, list } from '@vercel/blob';

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
// FASE 1: Selección de nodos regionales (uno por zona)
// ============================================================

function seleccionarNodosRegionales() {
  const nodos = {};
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

  Object.values(zonas).forEach(n => { nodos[n.zona_id] = n; });
  return nodos;
}

// ============================================================
// FASE 2: Consulta de Open-Meteo por zona, con reintentos
// ============================================================

function extraerValor(h, indice, nombreBase, valorDefecto = 0) {
  if (!h) return valorDefecto;
  return h[nombreBase]?.[indice] ??
         h[`${nombreBase}_gfs_seamless`]?.[indice] ??
         h[`${nombreBase}_icon_seamless`]?.[indice] ??
         valorDefecto;
}

async function consultarZonaUnaVez(nodo) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${nodo.lat}&longitude=${nodo.lon}` +
              `&hourly=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,visibility` +
              `&models=gfs_seamless,icon_seamless&past_days=7&forecast_days=3&timezone=America%2FMexico_City`;

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_FETCH_MS) });
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const data = await res.json();
  const h = data.hourly;
  if (!h || !h.time) {
    throw new Error("Respuesta sin bloque hourly");
  }

  const serie = [];
  for (let i = 0; i < h.time.length; i++) {
    serie.push({
      fecha_hora: h.time[i],
      lluvia_mm: extraerValor(h, i, 'precipitation', 0),
      temperatura_c: extraerValor(h, i, 'temperature_2m', 15),
      humedad_relativa_pct: extraerValor(h, i, 'relative_humidity_2m', 60),
      viento_kmh: extraerValor(h, i, 'wind_speed_10m', 10),
      rafagas_kmh: extraerValor(h, i, 'wind_gusts_10m', 15),
      visibilidad_km: extraerValor(h, i, 'visibility', 10000) / 1000
    });
  }

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
  console.log(`\n🌐 Consultando ${zonaIds.length} nodos regionales en paralelo...`);

  const t0 = Date.now();

  const promesas = zonaIds.map((zonaId, indice) => {
    const nodo = nodos[zonaId];
    // Stagger: 200ms entre cada fetch para no gatillar rate limits de Open-Meteo
    return new Promise(r => setTimeout(r, indice * 200))
      .then(() => consultarZonaConReintentos(nodo))
      .then(resultado => ({
        zonaId,
        nodo,
        ...resultado
      }));
  });

  const resultados = await Promise.allSettled(promesas);

  const series = {};
  const zonasOk = [];
  const zonasFallidas = [];

  resultados.forEach((r, i) => {
    const zonaId = zonaIds[i];
    if (r.status === 'fulfilled') {
      series[zonaId] = r.value;
      if (r.value.ok) {
        zonasOk.push(`${zonaId}(${r.value.serie.length}h)`);
        console.log(`  ✅ [${zonaId}] ${r.value.serie.length}h en ${r.value.intentos} intento(s)`);
      } else {
        zonasFallidas.push(zonaId);
        console.warn(`  ❌ [${zonaId}] Falló después de ${r.value.intentos} intentos: ${r.value.error}`);
      }
    } else {
      series[zonaId] = { ok: false, serie: [], error: r.reason?.message || 'Promise rechazada', intentos: 0 };
      zonasFallidas.push(zonaId);
      console.error(`  ❌ [${zonaId}] Error inesperado: ${r.reason?.message}`);
    }
  });

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n📊 Cobertura: ${zonasOk.length}/${zonaIds.length} zonas OK en ${dt}s`);
  if (zonasFallidas.length > 0) {
    console.warn(`⚠️  Zonas sin datos: ${zonasFallidas.join(', ')}`);
  }

  return { series, zonasOk, zonasFallidas };
}

// ============================================================
// Helpers (fecha, hash, ID)
// ============================================================

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

function obtenerFechaHoraMexico(fecha = new Date()) {
  const fechaDia = fecha.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const horaExacta = fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const horaCorta = fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return { fechaDia, horaExacta, horaCorta };
}

function normalizarEstadoSituacion(estadoRaw) {
  if (!estadoRaw || typeof estadoRaw !== 'string') return 'SITUACION_NORMAL';
  const limpio = estadoRaw.trim().toUpperCase();
  if (limpio === 'CORRIDA_DEGRADADA') return 'CORRIDA_DEGRADADA';
  if (limpio === 'SITUACION_CRITICA' || limpio === 'CRITICA' || limpio === 'CRÍTICA' || limpio === 'EMERGENCIA') {
    return 'SITUACION_CRITICA';
  }
  if (limpio === 'SITUACION_GRAVE' || limpio === 'GRAVE' || limpio === 'ALERTA') {
    return 'SITUACION_GRAVE';
  }
  return 'SITUACION_NORMAL';
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
// Registro de corrida degradada (falla total de Open-Meteo)
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

    const nuevoHash = generarHashSHA256(prevHash, ahora.toISOString(), {
      tipo: "CORRIDA_DEGRADADA",
      motivo
    });

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
      resumen: `${motivo} a las ${horaMexicoStr}. No se publicó evaluación nueva para evitar alertas falsas. El estado anterior en el sistema permanece vigente.`,
      prev_hash: prevHash.slice(0, 16) + "...",
      hash: nuevoHash.slice(0, 16) + "...",
      hash_completo: nuevoHash
    });

    if (bitacoraHistorial.length > MAX_REGISTROS_BITACORA) {
      bitacoraHistorial = bitacoraHistorial.slice(-MAX_REGISTROS_BITACORA);
    }

    const payloadBitacora = { bitacora: bitacoraHistorial };
    if (ultimoDictamenPrevio) {
      payloadBitacora.ultimo_dictamen = ultimoDictamenPrevio;
    }

    await put('bitacora_sara.json', JSON.stringify(payloadBitacora), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log("📝 Corrida degradada registrada en bitácora SHA-256.");
  } catch (e) {
    console.error("❌ No se pudo registrar la corrida degradada:", e);
  }
}

// ============================================================
// Ejecución principal
// ============================================================

async function ejecutarSARA() {
  const ahora = new Date();
  const { fechaDia: fechaDiaMexico, horaExacta: horaExactaMexico, horaCorta: horaMexicoStr } = obtenerFechaHoraMexico(ahora);
  const proximaCorridaStr = obtenerFechaHoraMexico(new Date(ahora.getTime() + 3 * 3600000)).horaCorta;

  // --- 1. Aviso SMN ---
  let alertaSMN = null;
  try {
    const resSMN = await fetch("https://smn.conagua.gob.mx/tools/GUI/webservices/index.php?method=1").catch(() => null);
    if (resSMN && resSMN.ok) {
      const texto = (await resSMN.text()).toLowerCase();
      const afectaRegion = texto.includes("hidalgo") || texto.includes("puebla") || texto.includes("veracruz");
      const esIntensa = texto.includes("intensas") || texto.includes("torrenciales");

      if (afectaRegion && esIntensa) {
        alertaSMN = {
          titulo: "Aviso de Lluvias Intensas CONAGUA/SMN",
          rango_lluvia_min_mm: 75,
          rango_lluvia_max_mm: 150,
          estados_afectados: ["PUE", "HGO", "VER"]
        };
        console.log("🏛️ Aviso Severo del SMN activo para la región (75 a 150 mm).");
      } else if (afectaRegion) {
        alertaSMN = {
          titulo: "Aviso de Lluvias Fuertes CONAGUA/SMN",
          rango_lluvia_min_mm: 25,
          rango_lluvia_max_mm: 50,
          estados_afectados: ["PUE", "HGO"]
        };
        console.log("🏛️ Aviso Preventivo del SMN activo (25 a 50 mm).");
      } else {
        console.log("🏛️ Sin avisos extraordinarios del SMN para Hidalgo/Puebla en este ciclo.");
      }
    }
  } catch (e) {
    console.log("🏛️ Sin conexión con SMN; evaluando únicamente con modelos meteorológicos vivos.");
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
    const motivo = `Falla total de Open-Meteo en las ${Object.keys(nodos).length} zonas. Zonas afectadas: ${zonasFallidas.join(', ')}`;
    console.error("\n⚠️  MODO DEGRADADO ACTIVADO (falla total)");
    console.error(`⚠️  Motivo: ${motivo}`);
    console.error("⚠️  No se publicará estado_diocesano.json. El estado anterior en Blob permanece vigente.");

    await registrarCorridaDegradada(horaMexicoStr, fechaDiaMexico, horaExactaMexico, ahora, motivo);

    console.log("ℹ️  Corrida finalizada en modo degradado. Workflow sale con código 0.");
    process.exit(0);
  }

  // --- 4. Construir seriesPorZona para el motor ---
  // Cada zona tiene su serie real o un array vacío si falló
  const seriesPorZona = {};
  Object.keys(nodos).forEach(zonaId => {
    seriesPorZona[zonaId] = series[zonaId]?.ok ? series[zonaId].serie : [];
  });

  // --- 5. Evaluación de cada localidad con SU serie regional ---
  const evaluaciones = todasLocalidades.map(loc => {
    const zonaId = loc.zona_id;
    const serieZona = seriesPorZona[zonaId] || [];
    const zonaSinDatos = series[zonaId]?.ok === false;

    // Reutilizamos la lógica de evaluación existente pero por zona
    const esAltiplano = ['APN', 'TIZ', 'PMS', 'ACT'].includes(zonaId);
    const esSierra = ['HUA', 'SPP', 'ZAC', 'CHG', 'ZAH', 'ATG', 'TUL'].includes(zonaId);

    // --- Cálculos previos sobre la serie de la zona ---
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
    const visMinHoy = eventoActual.length ? Math.min(...eventoActual.map(h => h.visibilidad_km), 10) : 10;

    // --- Reglas del motor (idénticas a las originales) ---
    const pendiente = loc.topografia.pendiente_max_deg || 0;
    const relieve = loc.topografia.relieve || 'MESETA';
    const esLadera = relieve === 'LADERA' || pendiente >= 25;
    const distRio = loc.hidrologia.distancia_cauce_km || 99;
    const twi = loc.topografia.twi || 0;
    const esTerraceria = loc.vulnerabilidad.acceso_vial === 'CAMINO_TERRACERIA' || loc.vulnerabilidad.acceso_vial === 'BRECHA';

    const lluviaEfectiva24h = (esSierra && alertaSMN) ? Math.max(lluviaEventoHoy, alertaSMN.rango_lluvia_min_mm) : lluviaEventoHoy;
    const saturacionSuelo = parseFloat((api7DiasPrevios + lluviaEfectiva24h).toFixed(1));

    let nivel = 1;
    let vectorDominante = zonaSinDatos ? "SIN_DATOS_REGIONALES" : "ATMOSFERA_ESTABLE";
    let tituloDiagnostico = zonaSinDatos ? "Sin datos meteorológicos regionales" : "Condiciones de Estabilidad y Calma";
    let causa = zonaSinDatos
      ? `La zona ${zonaId} no reportó datos meteorológicos en esta corrida. Localidad evaluada con mínimos por defecto.`
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
            causa = `Suelo saturado (${saturacionSuelo} mm) sobre talud crítico de ${pendiente}°. Falla inminente de talud habitado.`;
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
          tituloDiagnostico = "Vigilancia Preventiva por Lluvia Activa y Niebla";
          causa = `Precipitación continua moderada (${lluviaEfectiva24h} mm) en valles y lomas de transición.`;
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
        rafagaMaximaKmh: rafagaMaxHoy
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

  console.log(`📊 [SARA CLASIFICACIÓN MULTI-NODO] N4: ${n4} | N3: ${n3} | N2: ${n2} | N1: ${n1} | Sin datos: ${sinDatos}`);

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
            {
              role: "system",
              content: `Eres SARA, Oficial Meteoróloga de Guardia de Cáritas Tulancingo. Hora oficial de México: ${horaMexicoStr}.
Genera el informe diocesano multimodal en JSON con claves: estado_situacion, color, titulo, comentario_oficial.
REGLA: Si no hay emergencias activas, declara situación normal con serenidad profesional.
REGLA: NO menciones conteos numéricos de niveles en el comentario. Se agregarán aparte.`
            },
            {
              role: "user",
              content: `Hora México: ${horaMexicoStr}. Aviso SMN: ${alertaSMN ? alertaSMN.titulo : 'Sin aviso severo vigente'}.
Zonas OK: ${zonasOk.length}/${Object.keys(nodos).length}. Zonas sin datos: ${zonasFallidas.join(', ') || 'ninguna'}.
Nivel 4: ${n4}, Nivel 3: ${n3}, Nivel 2: ${n2}, Nivel 1: ${n1}.
Comunidades críticas bajo tensión: ${JSON.stringify(criticas)}.`
            }
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
      comentario_oficial: `Corrida autónoma multi-nodo (${horaMexicoStr}): Evaluación sobre ${zonasOk.length} zonas meteorológicas con datos reales.`
    };
  }

  dictamenSARA.estado_situacion = normalizarEstadoSituacion(dictamenSARA.estado_situacion);
  dictamenSARA.hora_evaluacion = horaMexicoStr;
  dictamenSARA.proxima_evaluacion = proximaCorridaStr;
  dictamenSARA.timestamp = ahora.toISOString();

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
  const nuevoHash = generarHashSHA256(prevHash, dictamenSARA.timestamp, { n4, n3, n2, n1, zonaOk: zonasOk.length, hora: horaMexicoStr });
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
    evaluaciones: evaluaciones
  };

  try {
    await put('estado_diocesano.json', JSON.stringify(paqueteMaestro), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    await put('bitacora_sara.json', JSON.stringify({ bitacora: bitacoraHistorial, ultimo_dictamen: dictamenSARA }), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log(`✅ [SARA RUNNER] Publicación exitosa con ${zonasOk.length} zonas a las ${horaMexicoStr}.`);
  } catch (e) {
    console.error("❌ Error al publicar en Vercel Blob:", e);
    process.exit(1);
  }
}

ejecutarSARA();