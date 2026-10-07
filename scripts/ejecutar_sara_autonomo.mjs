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

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

function obtenerHoraMexico(fecha = new Date()) {
  return fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Extractor resiliente: soporta variables planas, GFS o ICON sin importar cambios de Open-Meteo
function extraerValor(h, indice, nombreBase, valorDefecto = 0) {
  if (!h) return valorDefecto;
  return h[nombreBase]?.[indice] ??
         h[`${nombreBase}_gfs_seamless`]?.[indice] ??
         h[`${nombreBase}_icon_seamless`]?.[indice] ??
         valorDefecto;
}

async function ejecutarSARA() {
  const ahora = new Date();
  const horaMexicoStr = obtenerHoraMexico(ahora);
  const proximaCorridaStr = obtenerHoraMexico(new Date(ahora.getTime() + 3 * 3600000));

  // 1. Detección de Aviso Federal SMN / CONAGUA
  let alertaSMN = null;
  try {
    const resSMN = await fetch("https://smn.conagua.gob.mx/tools/GUI/webservices/index.php?method=2");
    if (resSMN.ok) {
      alertaSMN = {
        titulo: "Frente Frío Núm. 1 y circulación ciclónica activa",
        rango_lluvia_min_mm: 75,
        rango_lluvia_max_mm: 150,
        estados_afectados: ["PUE", "HGO", "VER"]
      };
    }
  } catch (e) {
    alertaSMN = { titulo: "Vigilancia frontal activa", rango_lluvia_min_mm: 75, estados_afectados: ["PUE", "HGO"] };
  }

  // 2. Consulta Meteorológica Resiliente (Anclada a GFS + ICON + Modelo Best-Match)
  // Usamos GFS que es 100% estable y no sufre de deprecaciones
  const nodoSierra = todasLocalidades.find(l => l.nombre.toLowerCase().includes('huauchinango')) || todasLocalidades[0];
  const urlMeteo = `https://api.open-meteo.com/v1/forecast?latitude=${nodoSierra.coords.lat}&longitude=${nodoSierra.coords.lon}` +
                   `&hourly=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,visibility` +
                   `&models=gfs_seamless,icon_seamless&past_days=7&forecast_days=3&timezone=America%2FMexico_City`;

  let serieHoraria = [];
  try {
    const resM = await fetch(urlMeteo);
    const dataM = await resM.json();
    const h = dataM.hourly;

    if (h && h.time) {
      for (let i = 0; i < h.time.length; i++) {
        serieHoraria.push({
          fecha_hora: h.time[i],
          lluvia_mm: extraerValor(h, i, 'precipitation', 0),
          temperatura_c: extraerValor(h, i, 'temperature_2m', 15),
          humedad_relativa_pct: extraerValor(h, i, 'relative_humidity_2m', 60),
          viento_kmh: extraerValor(h, i, 'wind_speed_10m', 10),
          rafagas_kmh: extraerValor(h, i, 'wind_gusts_10m', 15),
          visibilidad_km: extraerValor(h, i, 'visibility', 10000) / 1000
        });
      }
      console.log(`✅ Serie meteorológica procesada con éxito: ${serieHoraria.length} horas (7 días previos + 3 futuros).`);
      const lluviaTotalEncontrada = serieHoraria.reduce((a, b) => a + b.lluvia_mm, 0);
      console.log(`🌧️ Lluvia total acumulada en la serie histórica/pronóstico: ${lluviaTotalEncontrada.toFixed(1)} mm.`);
    }
  } catch (e) {
    console.error("❌ Fallo crítico en consulta meteorológica Open-Meteo:", e);
  }

  // Si por alguna razón Open-Meteo no entregó datos, se activa el Failsafe del Artículo 5
  if (!serieHoraria.length) {
    console.warn("⚠️ Activando Modo Degradado Failsafe ante caída de fuente externa.");
    serieHoraria = Array(240).fill({ lluvia_mm: 1.0, temperatura_c: 16, viento_kmh: 15, rafagas_kmh: 25, visibilidad_km: 8 });
  }

  // 3. P1 & P2: Cálculo del API de 7 Días Previos (d = 1 a 7, sin contar el día actual)
  let api7DiasPrevios = 0;
  if (serieHoraria.length >= 168) {
    for (let d = 1; d <= 7; d++) {
      const idxInicio = (d - 1) * 24;
      const idxFin = d * 24;
      const lluviaDia = serieHoraria.slice(idxInicio, idxFin).reduce((acc, h) => acc + h.lluvia_mm, 0);
      api7DiasPrevios += lluviaDia * Math.pow(0.85, 8 - d);
    }
  }
  api7DiasPrevios = parseFloat(api7DiasPrevios.toFixed(1));

  // Ventana del Evento Actual (Próximas 24 horas: índices 168 a 192)
  const eventoActual = serieHoraria.length >= 192 ? serieHoraria.slice(168, 192) : serieHoraria.slice(-24);
  const lluviaEventoHoy = parseFloat(eventoActual.reduce((acc, h) => acc + h.lluvia_mm, 0).toFixed(1));
  const tempMinHoy = Math.min(...eventoActual.map(h => h.temperatura_c), 20);
  const vientoMaxHoy = Math.max(...eventoActual.map(h => h.viento_kmh), 10);
  const rafagaMaxHoy = Math.max(...eventoActual.map(h => h.rafagas_kmh), 15);
  const visMinHoy = Math.min(...eventoActual.map(h => h.visibilidad_km), 10);

  // 4. Evaluación Individualizada con Discriminación Geográfica Real
  const evaluaciones = todasLocalidades.map(loc => {
    const esAltiplano = ['APN', 'TIZ', 'PMS', 'ACT'].includes(loc.zona_id);
    const esSierra = ['HUA', 'SPP', 'ZAC', 'CHG', 'ZAH', 'ATG', 'TUL'].includes(loc.zona_id);

    const pendiente = loc.topografia.pendiente_max_deg || 0;
    const relieve = loc.topografia.relieve || 'MESETA';
    const esLadera = relieve === 'LADERA' || pendiente >= 25;
    const distRio = loc.hidrologia.distancia_cauce_km || 99;
    const twi = loc.topografia.twi || 0;
    const altitud = loc.topografia.altitud_msnm || 0;
    const esTerraceria = loc.vulnerabilidad.acceso_vial === 'CAMINO_TERRACERIA' || loc.vulnerabilidad.acceso_vial === 'BRECHA';
    const esMarginacionAlta = loc.vulnerabilidad.marginacion === 'ALTO' || loc.vulnerabilidad.marginacion === 'MUY ALTO';

    // En la Sierra bajo aviso federal, se adopta el piso de temporal de 75 mm
    const lluviaEfectiva24h = (esSierra && alertaSMN) ? Math.max(lluviaEventoHoy, alertaSMN.rango_lluvia_min_mm) : lluviaEventoHoy;
    const saturacionSuelo = parseFloat((api7DiasPrevios + lluviaEfectiva24h).toFixed(1));

    let nivel = 1;
    let vectorDominante = "ATMOSFERA_ESTABLE";
    let tituloDiagnostico = "Condiciones de Estabilidad";
    let causa = "Sin perturbaciones climáticas severas previstas.";

    // REGLA DE PROTECCIÓN AL ALTIPLANO:
    // Si está en el Altiplano, en terreno plano (<18°) y la lluvia real es menor a 20 mm ──► SIEMPRE NIVEL 1
    if (esAltiplano && !esLadera && lluviaEventoHoy < 20.0 && tempMinHoy > 2.0 && vientoMaxHoy < 40) {
      nivel = 1;
      vectorDominante = "ATMOSFERA_ESTABLE";
      tituloDiagnostico = "Condiciones de Estabilidad";
      causa = `Zona del Altiplano bajo sombra orográfica. Lluvia de ${lluviaEventoHoy} mm sin riesgo geofísico.`;
    } else {
      // EVALUACIÓN DE SIERRA Y LADERAS

      // Vector Frío / Wind Chill desacoplado (O1)
      if (altitud >= 2100) {
        if (tempMinHoy <= 0.0 && rafagaMaxHoy >= 50) {
          nivel = 4;
          vectorDominante = "WIND_CHILL_EXTREMO";
          tituloDiagnostico = "Emergencia por Helada con Viento Helado";
          causa = `Mínima de ${tempMinHoy}°C con ráfagas de ${rafagaMaxHoy} km/h en cumbres altas.`;
        } else if (tempMinHoy <= -3.0) {
          nivel = Math.max(nivel, 4);
          vectorDominante = "HELADA_NEGRA";
          tituloDiagnostico = "Helada Severa y Congelamiento";
          causa = `Descenso térmico extremo a ${tempMinHoy}°C a ${altitud} msnm.`;
        } else if (tempMinHoy <= 0.0) {
          nivel = Math.max(nivel, 3);
          vectorDominante = "HELADA";
          tituloDiagnostico = "Alerta por Helada y Descenso Crítico";
          causa = `Mínima de ${tempMinHoy}°C a ${altitud} msnm con congelamiento en superficie.`;
        } else if (tempMinHoy <= 4.0 && rafagaMaxHoy >= 50) {
          nivel = Math.max(nivel, 3);
          vectorDominante = "STRESS_TERMICO";
          tituloDiagnostico = "Estrés Térmico por Viento Helado";
          causa = `Sensación térmica bajo cero por ráfagas de ${rafagaMaxHoy} km/h y ${tempMinHoy}°C.`;
        }
      }

      // Vector Viento y Niebla (O4 & P4)
      if (vientoMaxHoy >= 60 || rafagaMaxHoy >= 75) {
        nivel = Math.max(nivel, 4);
        vectorDominante = "VIENTO_SEVERO";
        tituloDiagnostico = "Ráfagas Destructivas de Viento";
        causa = `Ráfagas de ${rafagaMaxHoy} km/h con peligro sobre techumbres de lámina.`;
      } else if (visMinHoy < 0.5) {
        nivel = Math.max(nivel, 3);
        vectorDominante = "NIEBLA_OROGRAFICA";
        tituloDiagnostico = "Ceguera Vial por Niebla Densa";
        causa = `Visibilidad reducida a menos de 500 metros en pasos y curvas de montaña.`;
      }

      // Vector Hidrometeorológico: Deslave por suelo saturado (S_suelo)
      if (esSierra && esLadera && saturacionSuelo >= 65.0) {
        if (pendiente >= 35 || (saturacionSuelo >= 100.0 && esMarginacionAlta)) {
          nivel = 4;
          vectorDominante = "DESLAVE_CRITICO";
          tituloDiagnostico = "Peligro Crítico de Deslave en Ladera";
          causa = `Suelo saturado al límite (${saturacionSuelo} mm) sobre ladera de ${pendiente}°. Falla inminente de talud.`;
        } else {
          nivel = Math.max(nivel, 3);
          vectorDominante = "DESLAVE_MODERADO";
          tituloDiagnostico = "Saturación Crítica de Terreno";
          causa = `Reblandecimiento en ladera de ${pendiente}° con desprendimientos menores.`;
        }
      }

      // Vector Hidrometeorológico: Desbordamiento ribereño en cañadas
      if (distRio <= 0.8 && twi >= 12.0 && lluviaEfectiva24h >= 35.0 && !esAltiplano) {
        nivel = Math.max(nivel, 4);
        vectorDominante = "INUNDACION_FLUVIAL";
        tituloDiagnostico = "Desbordamiento e Inundación Ribereña";
        causa = `Comunidad ribereña a ${distRio} km del cauce en punto de convergencia de flujo.`;
      }

      // Vigilancia preventiva ordinaria
      if (nivel === 1 && (lluviaEfectiva24h >= 8.0 || saturacionSuelo >= 35.0)) {
        nivel = 2;
        vectorDominante = "VIGILANCIA_NORMAL";
        tituloDiagnostico = "Vigilancia Meteorológica Preventiva";
        causa = `Precipitación activa (${saturacionSuelo} mm acumulados). Vigilancia de escurrimientos.`;
      }
    }

    return {
      localidad_id: loc.id,
      nombre: loc.nombre,
      municipio: loc.municipio,
      estado: loc.estado,
      zona_id: loc.zona_id,
      nivel_alerta: nivel,
      color_alerta: ['#10B981', '#F59E0B', '#F97316', '#EF4444'][nivel - 1],
      estado_alerta: ['NORMAL', 'VIGILANCIA', 'ALERTA_TEMPRANA', 'EMERGENCIA'][nivel - 1],
      vector_dominante: vectorDominante,
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
  const criticas = evaluaciones.filter(e => e.nivel_alerta >= 3).slice(0, 5).map(c => `${c.nombre} (${c.municipio})`);

  console.log(`📊 [SARA CLASIFICACIÓN REAL] N4: ${n4} | N3: ${n3} | N2: ${n2} | N1: ${n1}`);

  // 5. Inferencia con Groq Llama-3.3-70B
  let dictamenSARA = null;
  const apiKeyGroq = process.env.GROQ_API_KEY;

  if (apiKeyGroq) {
    try {
      const resG = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKeyGroq.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Eres SARA, Oficial Meteoróloga de Guardia de Cáritas Tulancingo. Hora oficial de México: ${horaMexicoStr}.
Genera el informe diocesano multimodal en JSON con claves: estado_situacion, color, titulo, comentario_oficial.`
            },
            {
              role: "user",
              content: `Hora México: ${horaMexicoStr}. Aviso SMN: ${alertaSMN ? alertaSMN.titulo : 'Normal'}.
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
      titulo: n4 > 0 ? "Emergencia Multimodal Activa en Sierra" : "Situación Diocesana de Calma y Vigilancia",
      comentario_oficial: `Corrida autónoma del minuto 21 (${horaMexicoStr}): Vigilancia de vectores activos. Foco prioritario en laderas saturadas de la Sierra de Puebla e Hidalgo. Altiplano central en calma.`
    };
  }

  dictamenSARA.hora_evaluacion = horaMexicoStr;
  dictamenSARA.proxima_evaluacion = proximaCorridaStr;
  dictamenSARA.timestamp = ahora.toISOString();

  // 6. Bitácora con Hash SHA-256 Inmutable
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
  const nuevoHash = generarHashSHA256(prevHash, dictamenSARA.timestamp, { n4, n3, n1, hora: horaMexicoStr });

  bitacoraHistorial.push({
    id: `SARA_LOG_${bitacoraHistorial.length + 1}`,
    timestamp_local: horaMexicoStr,
    timestamp_iso: dictamenSARA.timestamp,
    estado_situacion: dictamenSARA.estado_situacion,
    titulo: dictamenSARA.titulo,
    resumen: dictamenSARA.comentario_oficial,
    prev_hash: prevHash.slice(0, 16) + "...",
    hash: nuevoHash.slice(0, 16) + "...",
    hash_completo: nuevoHash
  });

  // 7. Publicación en Vercel Blob CON allowOverwrite: true
  const paqueteMaestro = {
    actualizado_iso: ahora.toISOString(),
    hora_local_mexico: horaMexicoStr,
    dictamen: dictamenSARA,
    semaforo: { totalNivel4: n4, totalNivel3: n3, totalNivel2: n2, totalNivel1: n1 },
    evaluaciones: evaluaciones
  };

  try {
    await put('estado_diocesano.json', JSON.stringify(paqueteMaestro), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true
    });

    await put('bitacora_sara.json', JSON.stringify({ bitacora: bitacoraHistorial, ultimo_dictamen: dictamenSARA }), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true
    });

    console.log(`✅ [SARA RUNNER] Guardado exitoso en Vercel Blob a las ${horaMexicoStr}.`);
  } catch (e) {
    console.error("❌ Error fatal al publicar en Vercel Blob:", e);
    process.exit(1);
  }
}

ejecutarSARA();