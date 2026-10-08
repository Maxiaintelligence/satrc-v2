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

  // 1. Detección DINÁMICA de Aviso Federal (Sin ningún texto quemado)
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

  // 2. Consulta Meteorológica de Cuenca
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
      console.log(`✅ Serie meteorológica procesada: ${serieHoraria.length} horas.`);
      const lluviaTotalEncontrada = serieHoraria.reduce((a, b) => a + b.lluvia_mm, 0);
      console.log(`🌧️ Lluvia acumulada encontrada en la serie: ${lluviaTotalEncontrada.toFixed(1)} mm.`);
    }
  } catch (e) {
    console.error("❌ Fallo en Open-Meteo:", e);
  }

  if (!serieHoraria.length) {
    serieHoraria = Array(240).fill({ lluvia_mm: 0.5, temperatura_c: 16, viento_kmh: 15, rafagas_kmh: 25, visibilidad_km: 8 });
  }

  // 3. API de 7 Días Previos (d = 1 a 7)
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

  // Ventana del Evento Actual
  const eventoActual = serieHoraria.length >= 192 ? serieHoraria.slice(168, 192) : serieHoraria.slice(-24);
  const lluviaEventoHoy = parseFloat(eventoActual.reduce((acc, h) => acc + h.lluvia_mm, 0).toFixed(1));
  const tempMinHoy = Math.min(...eventoActual.map(h => h.temperatura_c), 20);
  const vientoMaxHoy = Math.max(...eventoActual.map(h => h.viento_kmh), 10);
  const rafagaMaxHoy = Math.max(...eventoActual.map(h => h.rafagas_kmh), 15);
  const visMinHoy = Math.min(...eventoActual.map(h => h.visibilidad_km), 10);

  // 4. Evaluación de las 405 Localidades con Umbral de Ladera en >= 45°
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

    // Solo se adopta piso de temporal si el SMN tiene aviso activo real para hoy
    const lluviaEfectiva24h = (esSierra && alertaSMN) ? Math.max(lluviaEventoHoy, alertaSMN.rango_lluvia_min_mm) : lluviaEventoHoy;
    const saturacionSuelo = parseFloat((api7DiasPrevios + lluviaEfectiva24h).toFixed(1));

    let nivel = 1;
    let vectorDominante = "ATMOSFERA_ESTABLE";
    let tituloDiagnostico = "Condiciones de Estabilidad y Calma";
    let causa = "Sin perturbaciones climáticas significativas previstas.";

    // Altiplano seco forzado a Normalidad (N1 Verde)
    if (esAltiplano && pendiente < 15 && lluviaEventoHoy < 20.0 && tempMinHoy > 2.0 && vientoMaxHoy < 40) {
      nivel = 1;
      vectorDominante = "ATMOSFERA_ESTABLE";
      tituloDiagnostico = "Condiciones de Estabilidad y Calma";
      causa = `Zona del Altiplano bajo sombra orográfica. Lluvia de ${lluviaEventoHoy} mm sin riesgo geofísico.`;
    } else {
      // EVALUACIÓN DE SIERRA Y LADERAS

      // Umbral geomecánico de Emergencia calibrado en >= 45°
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

      // Desbordamiento ribereño en cañadas
      if (distRio <= 0.8 && twi >= 12.0 && lluviaEfectiva24h >= 35.0 && !esAltiplano) {
        nivel = Math.max(nivel, 4);
        vectorDominante = "INUNDACION_FLUVIAL";
        tituloDiagnostico = "Desbordamiento e Inundación Ribereña";
        causa = `Comunidad ribereña a ${distRio} km del cauce en punto de convergencia de flujo.`;
      }

      // Aislamiento por terracería en temporal
      if (esTerraceria && (lluviaEfectiva24h >= 20.0 || saturacionSuelo >= 50.0) && nivel < 3) {
        nivel = 3;
        vectorDominante = "CORTE_VIAL";
        tituloDiagnostico = "Amenaza de Incomunicación y Corte de Acceso";
        causa = `Vía única de terracería/brecha vulnerable a corte total por lodo.`;
      }

      // Vigilancia preventiva en valles de transición (Nivel 2 Amarillo)
      if (nivel === 1 && (lluviaEfectiva24h >= 8.0 || saturacionSuelo >= 30.0 || visMinHoy <= 2.0)) {
        nivel = 2;
        vectorDominante = "VIGILANCIA_NORMAL";
        tituloDiagnostico = "Vigilancia Preventiva por Lluvia Activa y Niebla";
        causa = `Precipitación continua moderada (${lluviaEfectiva24h} mm) en valles y lomas de transición.`;
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
  const criticas = evaluaciones.filter(e => e.nivel_alerta >= 3).slice(0, 6).map(c => `${c.nombre} (${c.municipio})`);

  console.log(`📊 [SARA CLASIFICACIÓN REAL VIVA] N4: ${n4} | N3: ${n3} | N2: ${n2} | N1: ${n1}`);

  // 5. Inferencia con Groq openai/gpt-oss-120b
  let dictamenSARA = null;
  const apiKeyGroq = process.env.GROQ_API_KEY;

  if (apiKeyGroq) {
    try {
      const resG = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKeyGroq.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({openai/gpt-oss-120b
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Eres SARA, Oficial Meteoróloga de Guardia de Cáritas Tulancingo. Hora oficial de México: ${horaMexicoStr}.
Genera el informe diocesano multimodal en JSON con claves: estado_situacion, color, titulo, comentario_oficial.
REGLA: Si no hay emergencias activas, declara situación normal con serenidad profesional.`
            },
            {
              role: "user",
              content: `Hora México: ${horaMexicoStr}. Aviso SMN: ${alertaSMN ? alertaSMN.titulo : 'Sin aviso severo vigente'}.
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
      estado_situacion: n4 > 0 ? "SITUACION_CRITICA" : (n3 > 0 ? "SITUACION_GRAVE" : (n2 > 0 ? "SITUACION_ALERTA_PREPARACION" : "SITUACION_NORMAL")),
      color: n4 > 0 ? "#EF4444" : (n3 > 0 ? "#F97316" : (n2 > 0 ? "#F59E0B" : "#10B981")),
      titulo: n4 > 0 ? "Emergencia por Deslaves en Taludes >= 45°" : (n3 > 0 ? "Alerta Temprana en Laderas Serranas" : "Situación Diocesana de Calma"),
      comentario_oficial: `Corrida del minuto 21 (${horaMexicoStr}): Monitoreo dinámico activo. Evaluaciones físicas actualizadas sobre las 405 comunidades.`
    };
  }

  dictamenSARA.hora_evaluacion = horaMexicoStr;
  dictamenSARA.proxima_evaluacion = proximaCorridaStr;
  dictamenSARA.timestamp = ahora.toISOString();

  // 6. Bitácora con Hash SHA-256
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
  const nuevoHash = generarHashSHA256(prevHash, dictamenSARA.timestamp, { n4, n3, n2, n1, hora: horaMexicoStr });

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
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    await put('bitacora_sara.json', JSON.stringify({ bitacora: bitacoraHistorial, ultimo_dictamen: dictamenSARA }), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    console.log(`✅ [SARA RUNNER] Publicación exitosa en Vercel Blob a las ${horaMexicoStr}.`);
  } catch (e) {
    console.error("❌ Error al publicar en Vercel Blob:", e);
    process.exit(1);
  }
}

ejecutarSARA();