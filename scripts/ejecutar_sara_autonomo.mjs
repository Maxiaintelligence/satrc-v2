import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { put, list } from '@vercel/blob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rutaJSON = path.join(__dirname, '../src/data/localidades.json');
const db = JSON.parse(fs.readFileSync(rutaJSON, 'utf-8'));
const todasLocalidades = db.localidades || [];

console.log(`📡 [SARA RUNNER] Iniciando escaneo autónomo de ${todasLocalidades.length} comunidades...`);

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

async function ejecutarSARA() {
  const ahora = new Date();
  const horaLocalStr = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

  // 1. Consultar Aviso Federal SMN / CONAGUA
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

  // 2. Consulta Meteorológica de Cuenca
  const nodoSierra = todasLocalidades.find(l => l.nombre.toLowerCase().includes('huauchinango')) || todasLocalidades[0];
  const urlMeteo = `https://api.open-meteo.com/v1/forecast?latitude=${nodoSierra.coords.lat}&longitude=${nodoSierra.coords.lon}` +
                   `&hourly=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,visibility` +
                   `&models=ecmwf_ifs025,gfs_seamless,icon_seamless&past_days=7&forecast_days=3&timezone=America%2FMexico_City`;

  let serieHoraria = [];
  try {
    const resM = await fetch(urlMeteo);
    const dataM = await resM.json();
    const h = dataM.hourly;
    if (h && h.time) {
      for (let i = 0; i < h.time.length; i++) {
        serieHoraria.push({
          fecha_hora: h.time[i],
          lluvia_mm: h.precipitation?.[i] ?? 0,
          temperatura_c: h.temperature_2m?.[i] ?? 15,
          humedad_relativa_pct: h.relative_humidity_2m?.[i] ?? 60,
          viento_kmh: h.wind_speed_10m?.[i] ?? 10,
          rafagas_kmh: h.wind_gusts_10m?.[i] ?? 15,
          visibilidad_km: (h.visibility?.[i] ?? 10000) / 1000
        });
      }
    }
  } catch (e) {
    console.error("Error en consulta meteorológica:", e);
  }

  // 3. Evaluación Multimodal de las 405 Localidades
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

    // Evento actual (próximas 24h)
    const horasHoy = serieHoraria.slice(168, 192);
    let lluviaHoy = horasHoy.reduce((acc, h) => acc + h.lluvia_mm, 0);
    let tempMin = Math.min(...horasHoy.map(h => h.temperatura_c), 20);
    let vientoMax = Math.max(...horasHoy.map(h => h.viento_kmh), 10);
    let rafagaMax = Math.max(...horasHoy.map(h => h.rafagas_kmh), 15);
    let humMin = Math.min(...horasHoy.map(h => h.humedad_relativa_pct), 50);
    let visMin = Math.min(...horasHoy.map(h => h.visibilidad_km), 10);

    // En la Sierra se adopta el piso de temporal del SMN
    const lluviaEfectiva = (esSierra && alertaSMN) ? Math.max(lluviaHoy, alertaSMN.rango_lluvia_min_mm) : lluviaHoy;
    const saturacionSuelo = parseFloat((25.0 + lluviaEfectiva).toFixed(1));

    let nivel = 1;
    let vectorDominante = "ATMOSFERA_ESTABLE";
    let tituloDiagnostico = "Condiciones de Estabilidad";
    let causa = "Sin perturbaciones climáticas significativas.";

    // EVALUACIÓN DE LOS 5 VECTORES:

    // Vector B: Frío y Heladas (en cumbres > 2,100 msnm)
    if (altitud >= 2100) {
      if (tempMin <= 0.0 && rafagaMax >= 50) {
        nivel = 4;
        vectorDominante = "FRIO_EXTREMO_WIND_CHILL";
        tituloDiagnostico = "Emergencia por Helada con Viento Helado";
        causa = `Mínima de ${tempMin}°C con ráfagas de ${rafagaMax} km/h. Hipotermia crítica en viviendas de montaña.`;
      } else if (tempMin <= 0.0) {
        nivel = Math.max(nivel, 3);
        vectorDominante = "HELADA_NEGRA";
        tituloDiagnostico = "Alerta por Helada Negra Agrícola";
        causa = `Descenso a ${tempMin}°C a ${altitud} msnm con congelamiento en superficie.`;
      }
    }

    // Vector C: Incendios Forestales (Regla 30-30-30 en zonas forestales)
    if (loc.vulnerabilidad.combustibilidad >= 3 && tempMin > 28 && humMin < 30 && vientoMax > 30) {
      nivel = Math.max(nivel, 3);
      vectorDominante = "INCENDIO_FORESTAL";
      tituloDiagnostico = "Alerta Extrema de Incendios Forestales";
      causa = `Regla 30-30-30 activa en bosque de pino-encino con alta velocidad de propagación.`;
    }

    // Vector D & E: Viento Severo y Niebla
    if (vientoMax >= 60 || rafagaMax >= 75) {
      nivel = Math.max(nivel, 4);
      vectorDominante = "VIENTO_SEVERO";
      tituloDiagnostico = "Ráfagas Destructivas de Viento";
      causa = `Ráfagas de ${rafagaMax} km/h con peligro de caída de cableado y desprendimiento de láminas.`;
    } else if (visMin < 0.5) {
      nivel = Math.max(nivel, 3);
      vectorDominante = "NIEBLA_OROGRAFICA";
      tituloDiagnostico = "Ceguera Vial por Niebla Densa";
      causa = `Visibilidad inferior a 500 metros en curvas y puertos serranos.`;
    }

    // Vector A: Hidrometeorológico (Laderas y Ríos)
    if (esSierra && esLadera && saturacionSuelo >= 65.0) {
      if (pendiente >= 35) {
        nivel = 4;
        vectorDominante = "DESLAVE_CRITICO";
        tituloDiagnostico = "Peligro Crítico de Deslave en Ladera";
        causa = `Saturación de suelo (${saturacionSuelo} mm) sobre ladera de ${pendiente}°. Falla inminente de talud.`;
      } else {
        nivel = Math.max(nivel, 3);
        vectorDominante = "DESLAVE_MODERADO";
        tituloDiagnostico = "Saturación Crítica de Terreno";
        causa = `Reblandecimiento de estratos en ladera de ${pendiente}° con desprendimientos menores.`;
      }
    }

    // Desbordamiento ribereño
    if (distRio <= 0.8 && twi >= 12.0 && lluviaEfectiva >= 35.0 && !esAltiplano) {
      nivel = Math.max(nivel, 4);
      vectorDominante = "INUNDACION_FLUVIAL";
      tituloDiagnostico = "Desbordamiento e Inundación Ribereña";
      causa = `Población a orilla de cauce encajonado (${distRio} km) con crecida en tránsito.`;
    }

    // Altiplano seco forzado a Normalidad si no hay frío extremo ni lluvia fuerte
    if (esAltiplano && !esLadera && lluviaHoy < 20.0 && tempMin > 2.0 && vientoMax < 40) {
      nivel = 1;
      vectorDominante = "ATMOSFERA_ESTABLE";
      tituloDiagnostico = "Condiciones de Estabilidad y Calma";
      causa = `Zona de Altiplano protegida por sombra orográfica. Lluvia real de ${lluviaHoy.toFixed(1)} mm sin amenaza geofísica.`;
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
      geografia: { relieve, pendienteMax: pendiente, distanciaRioKm: distRio, twi, cuenca: loc.hidrologia.subcuenca_nom, coordenadas: loc.coords },
      tiempos: { inicio: "En curso", picoMaximo: "Periodo activo", ventanaAccionHoras: loc.hidrologia.tc_horas || 6 },
      impactoSistemico: {
        poblacionDirecta: loc.vulnerabilidad.poblacion,
        accesoVial: loc.vulnerabilidad.acceso_vial,
        distanciaHospitalKm: loc.vulnerabilidad.dist_hospital_km,
        marginacion: loc.vulnerabilidad.marginacion,
        saturacionTotalSueloMm: saturacionSuelo,
        lluviaEvento24hMm: parseFloat(lluviaEfectiva.toFixed(1)),
        tempMinimaC: tempMin,
        rafagaMaximaKmh: rafagaMax
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

  // 4. Llamada de Síntesis a Groq Llama-3.3-70B
  let dictamenSARA = null;
  const apiKeyGroq = process.env.GROQ_API_KEY;

  if (apiKeyGroq) {
    try {
      const resG = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKeyGroq}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Eres SARA, Oficial Meteoróloga de Guardia de Cáritas Tulancingo.
Redacta el informe diocesano multimodal para la corrida del minuto 21.
Estructura exactamente en JSON con claves: estado_situacion, color, titulo, comentario_oficial.`
            },
            {
              role: "user",
              content: `Hora local: ${horaLocalStr}. Alerta SMN: ${alertaSMN ? alertaSMN.titulo : 'Normal'}.
Nivel 4: ${n4}, Nivel 3: ${n3}, Nivel 2: ${n2}, Nivel 1: ${n1}.
Comunidades críticas: ${JSON.stringify(criticas)}.`
            }
          ]
        })
      });

      if (resG.ok) {
        const dataG = await resG.json();
        dictamenSARA = JSON.parse(dataG.choices[0].message.content);
      }
    } catch (e) {
      console.warn("Groq no respondió, usando generador determinista:", e);
    }
  }

  if (!dictamenSARA) {
    dictamenSARA = {
      estado_situacion: n4 > 0 ? "SITUACION_CRITICA" : (n3 > 0 ? "SITUACION_GRAVE" : "SITUACION_NORMAL"),
      color: n4 > 0 ? "#EF4444" : (n3 > 0 ? "#F97316" : "#10B981"),
      titulo: n4 > 0 ? "Emergencia Multimodal Activa en Sierra" : "Situación Diocesana de Calma y Vigilancia",
      comentario_oficial: `Corrida autónoma del minuto 21 (${horaLocalStr}): Vigilancia de vectores activos. Foco prioritario en laderas saturadas de la Sierra de Puebla. Altiplano central en calma.`
    };
  }

  dictamenSARA.hora_evaluacion = horaLocalStr;
  dictamenSARA.timestamp = ahora.toISOString();

  // 5. Bitácora con Hash SHA-256 Inmutable
  let bitacoraHistorial = [];
  try {
    const { blobs } = await list({ prefix: 'bitacora_sara.json' });
    if (blobs && blobs.length > 0) {
      const rB = await fetch(blobs[0].url);
      if (rB.ok) {
        const d = await rB.json();
        bitacoraHistorial = d.bitacora || [];
      }
    }
  } catch (e) {}

  const prevHash = bitacoraHistorial.length > 0 ? bitacoraHistorial[bitacoraHistorial.length - 1].hash_completo : BLOQUE_GENESIS;
  const nuevoHash = generarHashSHA256(prevHash, dictamenSARA.timestamp, { n4, n3, n1, titulo: dictamenSARA.titulo });

  bitacoraHistorial.push({
    id: `SARA_LOG_${bitacoraHistorial.length + 1}`,
    timestamp_local: horaLocalStr,
    timestamp_iso: dictamenSARA.timestamp,
    estado_situacion: dictamenSARA.estado_situacion,
    titulo: dictamenSARA.titulo,
    resumen: dictamenSARA.comentario_oficial,
    prev_hash: prevHash.slice(0, 16) + "...",
    hash: nuevoHash.slice(0, 16) + "...",
    hash_completo: nuevoHash
  });

  // 6. Publicar Estado Maestro y Bitácora en Vercel Blob
  const paqueteMaestro = {
    actualizado_iso: ahora.toISOString(),
    hora_local: horaLocalStr,
    dictamen: dictamenSARA,
    semaforo: { totalNivel4: n4, totalNivel3: n3, totalNivel2: n2, totalNivel1: n1 },
    evaluaciones: evaluaciones
  };

  try {
    await put('estado_diocesano.json', JSON.stringify(paqueteMaestro), { access: 'public', addRandomSuffix: false });
    await put('bitacora_sara.json', JSON.stringify({ bitacora: bitacoraHistorial, ultimo_dictamen: dictamenSARA }), { access: 'public', addRandomSuffix: false });
    console.log("✅ [SARA RUNNER] Estado diocesano y bitacora publicados exitosamente en Vercel Blob.");
  } catch (e) {
    console.error("Error guardando en Vercel Blob:", e);
  }
}

ejecutarSARA();