import crypto from 'crypto';
import { put, list } from '@vercel/blob';

/**
 * SatRC V2.0 - SARA: Sistema de Alerta y Respuesta Automatizada
 * Persistencia permanente en Vercel Blob, Groq Llama-3.3-70B e Inmutabilidad SHA-256.
 */

const NOMBRE_ARCHIVO_BLOB = 'bitacora_sara.json';
const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

export default async function handler(req, res) {
  const ahora = Date.now();
  const TRES_HORAS_MS = 3 * 60 * 60 * 1000;

  // 1. Recuperar la Bitácora Histórica Permanente desde Vercel Blob
  let historialBitacora = [];
  let ultimoDictamen = null;
  let hashUltimo = BLOQUE_GENESIS;

  try {
    const { blobs } = await list({ prefix: NOMBRE_ARCHIVO_BLOB });
    if (blobs && blobs.length > 0) {
      const respuestaBlob = await fetch(blobs[0].url);
      if (respuestaBlob.ok) {
        const datosAlmacenados = await respuestaBlob.json();
        historialBitacora = datosAlmacenados.bitacora || [];
        ultimoDictamen = datosAlmacenados.ultimo_dictamen || null;
        if (historialBitacora.length > 0) {
          hashUltimo = historialBitacora[historialBitacora.length - 1].hash_completo || BLOQUE_GENESIS;
        }
      }
    }
  } catch (errorBlob) {
    console.warn("Aviso: Iniciando almacén Blob por primera vez:", errorBlob.message);
  }

  // Si tenemos un dictamen guardado de hace menos de 3 horas, servirlo de inmediato (0ms de latencia)
  const tiempoUltima = ultimoDictamen?.timestamp_ms || 0;
  if (ultimoDictamen && (ahora - tiempoUltima < TRES_HORAS_MS) && req.query.forzar !== 'true') {
    res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=1800");
    return res.json({
      exito: true,
      origen: "VERCEL_BLOB_CACHE_3H",
      dictamen: ultimoDictamen,
      bitacora: historialBitacora
    });
  }

  // 2. Ejecutar la Evaluación con SARA (Groq Llama-3.3)
  const contexto = req.body || {};
  const { alertaSMN, resumenSeveridad } = contexto;
  const apiKeyGroq = process.env.GROQ_API_KEY;

  // Fallback seguro si no hay API Key de Groq
  const generarDictamenFallback = () => {
    const hayCriticas = (resumenSeveridad?.totalNivel4 || 0) > 0;
    const hayAlerta = (resumenSeveridad?.totalNivel3 || 0) > 0;
    return {
      estado_situacion: hayCriticas ? "SITUACION_CRITICA" : (hayAlerta ? "SITUACION_GRAVE" : "SITUACION_NORMAL"),
      color: hayCriticas ? "#EF4444" : (hayAlerta ? "#F97316" : "#10B981"),
      titulo: hayCriticas ? "Emergencia por Temporal en Sierra" : (hayAlerta ? "Alerta Temprana por Sistema Frontal" : "Situación Normal y Estable"),
      comentario_oficial: hayCriticas 
        ? `Aviso de Frente Frío en interacción con el Golfo. Vigilancia prioritaria en ${resumenSeveridad?.criticasNombres?.slice(0, 3).join(', ') || 'laderas de la Sierra de Puebla'}. Altiplano central en calma.`
        : "Condiciones de estabilidad en la Arquidiócesis. Suelos con drenaje adecuado y cuencas en niveles base.",
      hora_evaluacion: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      proxima_evaluacion: new Date(ahora + TRES_HORAS_MS).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      timestamp: new Date().toISOString(),
      timestamp_ms: ahora,
      modelo_ia: "SARA Core Determinista"
    };
  };

  let dictamenFinal = null;

  if (!apiKeyGroq) {
    dictamenFinal = generarDictamenFallback();
  } else {
    const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), la Oficial Meteoróloga de Guardia de Cáritas Tulancingo.
Tu rol es redactar una síntesis sinóptica breve, profesional, sobria y pastoral.
REGLAS:
1. No cambias números ni niveles calculados.
2. Reconoce que el Altiplano (Pachuca, Tizayuca, Apan) está en calma y que el temporal del Frente Frío afecta a la Sierra de Puebla e Hidalgo.
3. Responde ÚNICAMENTE un JSON válido con estas claves:
{"estado_situacion": "...", "color": "...", "titulo": "...", "comentario_oficial": "..."}`;

    const userPrompt = `Situación:
Aviso SMN: ${alertaSMN ? alertaSMN.titulo : "Sin aviso severo"}.
Comunidades en Emergencia N4: ${resumenSeveridad?.totalNivel4 || 0}.
Comunidades en Alerta Temprana N3: ${resumenSeveridad?.totalNivel3 || 0}.
Comunidades Estables N1: ${resumenSeveridad?.totalNivel1 || 350}.
Focos prioritarios de sierra: ${JSON.stringify(resumenSeveridad?.criticasNombres || [])}.`;

    try {
      const respuestaGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKeyGroq.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (respuestaGroq.ok) {
        const resultado = await respuestaGroq.json();
        const contenido = JSON.parse(resultado.choices[0].message.content);
        dictamenFinal = {
          ...contenido,
          timestamp: new Date().toISOString(),
          timestamp_ms: ahora,
          hora_evaluacion: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
          proxima_evaluacion: new Date(ahora + TRES_HORAS_MS).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
          modelo_ia: "Groq Llama-3.3-70B LPU"
        };
      } else {
        dictamenFinal = generarDictamenFallback();
      }
    } catch (e) {
      console.error("Error en inferencia Groq:", e);
      dictamenFinal = generarDictamenFallback();
    }
  }

  // 3. Encadenar el nuevo bloque a la Bitácora con Hash SHA-256
  const nuevoHash = generarHashSHA256(hashUltimo, dictamenFinal.timestamp, {
    estado: dictamenFinal.estado_situacion,
    nivel4: resumenSeveridad?.totalNivel4,
    nivel3: resumenSeveridad?.totalNivel3
  });

  const entradaNueva = {
    id: `SARA_LOG_${historialBitacora.length + 1}`,
    timestamp_local: dictamenFinal.hora_evaluacion,
    timestamp_iso: dictamenFinal.timestamp,
    estado_situacion: dictamenFinal.estado_situacion,
    titulo: dictamenFinal.titulo,
    resumen: dictamenFinal.comentario_oficial,
    prev_hash: hashUltimo.slice(0, 16) + "...",
    hash: nuevoHash.slice(0, 16) + "...",
    hash_completo: nuevoHash
  };

  historialBitacora.push(entradaNueva);

  // 4. Guardar en Vercel Blob de Forma Permanente (Inmutable)
  try {
    const estructuraGuardar = {
      actualizado_iso: new Date().toISOString(),
      ultimo_dictamen: dictamenFinal,
      total_entradas: historialBitacora.length,
      bitacora: historialBitacora
    };

    await put(NOMBRE_ARCHIVO_BLOB, JSON.stringify(estructuraGuardar, null, 2), {
      access: 'public',
      addRandomSuffix: false // Conserva el nombre para persistencia
    });
  } catch (errGuardar) {
    console.error("Error al persistir en Vercel Blob:", errGuardar);
  }

  res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=1800");
  return res.json({
    exito: true,
    origen: "VERCEL_BLOB_NUEVO_BLOQUE",
    dictamen: dictamenFinal,
    bitacora: historialBitacora
  });
}