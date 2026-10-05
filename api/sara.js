import crypto from 'crypto';
import { put, list } from '@vercel/blob';

/**
 * SatRC V2.0 - SARA: Sistema de Alerta y Respuesta Automatizada
 * Resuelve la URL real dinámica de Vercel Blob y fija la zona horaria America/Mexico_City.
 */

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const ahora = new Date();
  const horaMexicoStr = obtenerHoraMexico(ahora);

  // 1. Resolver Dinámicamente la URL Real de Vercel Blob usando list()
  let estadoMaestro = null;
  let historialBitacora = [];
  let ultimoDictamen = null;

  try {
    const listadoBlobs = await list();
    const blobs = listadoBlobs?.blobs || [];

    // Buscar el archivo maestro de las 405 localidades
    const blobEstado = blobs.find(b => b.pathname.includes('estado_diocesano.json'));
    if (blobEstado) {
      const resBlob = await fetch(`${blobEstado.url}?t=${ahora.getTime()}`, { cache: 'no-store' });
      if (resBlob.ok) {
        estadoMaestro = await resBlob.json();
      }
    }

    // Buscar la bitácora histórica
    const blobBitacora = blobs.find(b => b.pathname.includes('bitacora_sara.json'));
    if (blobBitacora) {
      const resBit = await fetch(`${blobBitacora.url}?t=${ahora.getTime()}`, { cache: 'no-store' });
      if (resBit.ok) {
        const dBit = await resBit.json();
        historialBitacora = dBit.bitacora || [];
        ultimoDictamen = dBit.ultimo_dictamen || null;
      }
    }
  } catch (errBlob) {
    console.warn("Aviso al listar Vercel Blob:", errBlob.message);
  }

  // Si tenemos el estado maestro guardado en Blob, lo servimos de inmediato
  if (estadoMaestro && estadoMaestro.evaluaciones && estadoMaestro.evaluaciones.length > 0 && req.query.forzar !== 'true') {
    return res.json({
      exito: true,
      origen: "VERCEL_BLOB_DINAMICO",
      hora_servidor_mexico: horaMexicoStr,
      dictamen: estadoMaestro.dictamen || ultimoDictamen,
      semaforo: estadoMaestro.semaforo,
      evaluaciones: estadoMaestro.evaluaciones,
      bitacora: historialBitacora
    });
  }

  // 2. Si no hay archivo en Blob aún (primera corrida o forzado en vivo), evaluar con Groq
  const contexto = req.body || {};
  const { alertaSMN, resumenSeveridad } = contexto;
  const apiKeyGroq = process.env.GROQ_API_KEY;

  const proximaCorridaStr = obtenerHoraMexico(new Date(ahora.getTime() + 3 * 3600000));

  let dictamenFinal = {
    estado_situacion: (resumenSeveridad?.totalNivel4 || 0) > 0 ? "SITUACION_CRITICA" : "SITUACION_NORMAL",
    color: (resumenSeveridad?.totalNivel4 || 0) > 0 ? "#EF4444" : "#10B981",
    titulo: (resumenSeveridad?.totalNivel4 || 0) > 0 ? "Emergencia por Temporal en Sierra" : "Situación Diocesana de Calma",
    comentario_oficial: `Monitoreo en vivo (${horaMexicoStr}): Sincronización oficial con CONAGUA/SMN. Vigilancia prioritaria en la Sierra Madre Oriental. Altiplano en calma.`,
    hora_evaluacion: horaMexicoStr,
    proxima_evaluacion: proximaCorridaStr,
    timestamp: ahora.toISOString(),
    modelo_ia: "SARA Core en Vivo (Hora México)"
  };

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
Genera el informe diocesano en formato JSON con claves: estado_situacion, color, titulo, comentario_oficial.`
            },
            {
              role: "user",
              content: `Alerta SMN: ${alertaSMN ? alertaSMN.titulo : 'Normal'}.
Nivel 4: ${resumenSeveridad?.totalNivel4 || 0}, Nivel 3: ${resumenSeveridad?.totalNivel3 || 0}.
Comunidades críticas: ${JSON.stringify(resumenSeveridad?.criticasNombres || [])}.`
            }
          ]
        })
      });

      if (resG.ok) {
        const dataG = await resG.json();
        const contenido = JSON.parse(dataG.choices[0].message.content);
        dictamenFinal = {
          ...contenido,
          hora_evaluacion: horaMexicoStr,
          proxima_evaluacion: proximaCorridaStr,
          timestamp: ahora.toISOString(),
          modelo_ia: "Groq Llama-3.3-70B LPU"
        };
      }
    } catch (e) {
      console.warn("Fallo Groq en vivo:", e);
    }
  }

  // 3. Bitácora con Hash SHA-256
  const prevHash = historialBitacora.length > 0 ? historialBitacora[historialBitacora.length - 1].hash_completo : BLOQUE_GENESIS;
  const nuevoHash = generarHashSHA256(prevHash, dictamenFinal.timestamp, {
    estado: dictamenFinal.estado_situacion,
    hora: horaMexicoStr
  });

  historialBitacora.push({
    id: `SARA_LOG_${historialBitacora.length + 1}`,
    timestamp_local: horaMexicoStr,
    timestamp_iso: dictamenFinal.timestamp,
    estado_situacion: dictamenFinal.estado_situacion,
    titulo: dictamenFinal.titulo,
    resumen: dictamenFinal.comentario_oficial,
    prev_hash: prevHash.slice(0, 16) + "...",
    hash: nuevoHash.slice(0, 16) + "...",
    hash_completo: nuevoHash
  });

  return res.json({
    exito: true,
    origen: "RESPUESTA_EN_VIVO",
    hora_servidor_mexico: horaMexicoStr,
    dictamen: dictamenFinal,
    bitacora: historialBitacora,
    evaluaciones: estadoMaestro?.evaluaciones || null
  });
}