import crypto from 'crypto';

/**
 * SatRC V2.0 - SARA: Sistema de Alerta y Respuesta Automatizada
 * Inferencia con Groq LPU (Llama-3.3-70B) y Bitácora Inmutable SHA-256
 */

let cacheDictamenSARA = null;
let ultimaEjecucionTimestamp = 0;
let bitacoraEncadenada = [];
let hashAnterior = "0000000000000000000000000000000000000000000000000000000000000000";

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

export default async function handler(req, res) {
  const ahora = Date.now();
  const TRES_HORAS_MS = 3 * 60 * 60 * 1000;

  // Servir caché si tiene menos de 3 horas y no se forzó refresco
  if (cacheDictamenSARA && (ahora - ultimaEjecucionTimestamp < TRES_HORAS_MS) && req.query.forzar !== 'true') {
    res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=1800");
    return res.json({
      exito: true,
      origen: "CACHE_GUARDIA_3H",
      dictamen: cacheDictamenSARA,
      bitacora: bitacoraEncadenada.slice(-15)
    });
  }

  const contexto = req.body || {};
  const { alertaSMN, resumenSeveridad } = contexto;
  const apiKeyGroq = process.env.GROQ_API_KEY;

  // Fallback determinista seguro si no hay clave
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
      modelo_ia: "SARA Core Determinista"
    };
  };

  if (!apiKeyGroq) {
    const dictamenFallback = generarDictamenFallback();
    return res.json({ exito: true, origen: "FALLBACK_SIN_KEY", dictamen: dictamenFallback, bitacora: [] });
  }

  const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), la Oficial Meteoróloga de Guardia de Cáritas Tulancingo.
Tu rol es redactar una síntesis sinóptica breve, profesional, sobria y pastoral.
REGLAS:
1. No cambias números ni niveles calculados.
2. Reconoce que el Altiplano (Pachuca, Tizayuca, Apan) está en calma y que el temporal del Frente Frío 1 afecta a la Sierra (Huauchinango, Pahuatlán, Zihuateutla).
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

    if (!respuestaGroq.ok) {
      throw new Error(`Groq API respondió ${respuestaGroq.status}`);
    }

    const resultado = await respuestaGroq.json();
    const contenidoSARA = JSON.parse(resultado.choices[0].message.content);

    const dictamenFinal = {
      ...contenidoSARA,
      timestamp: new Date().toISOString(),
      hora_evaluacion: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      proxima_evaluacion: new Date(ahora + TRES_HORAS_MS).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      modelo_ia: "Groq Llama-3.3-70B LPU"
    };

    const nuevoHash = generarHashSHA256(hashAnterior, dictamenFinal.timestamp, {
      estado: dictamenFinal.estado_situacion,
      nivel4: resumenSeveridad?.totalNivel4
    });

    const entradaBitacora = {
      id: `SARA_LOG_${bitacoraEncadenada.length + 1}`,
      timestamp_local: dictamenFinal.hora_evaluacion,
      timestamp_iso: dictamenFinal.timestamp,
      estado_situacion: dictamenFinal.estado_situacion,
      titulo: dictamenFinal.titulo,
      resumen: dictamenFinal.comentario_oficial,
      prev_hash: hashAnterior.slice(0, 16) + "...",
      hash: nuevoHash.slice(0, 16) + "...",
      hash_completo: nuevoHash
    };

    hashAnterior = nuevoHash;
    bitacoraEncadenada.push(entradaBitacora);

    cacheDictamenSARA = dictamenFinal;
    ultimaEjecucionTimestamp = ahora;

    res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=1800");
    return res.json({
      exito: true,
      origen: "GROQ_LLAMA33_EN_VIVO",
      dictamen: dictamenFinal,
      bitacora: bitacoraEncadenada.slice(-15)
    });

  } catch (error) {
    console.error("Fallo al consultar Groq, activando fallback:", error);
    const dictamenFallback = generarDictamenFallback();
    return res.json({
      exito: true,
      origen: "FALLBACK_POR_ERROR_GROQ",
      dictamen: dictamenFallback,
      bitacora: bitacoraEncadenada.slice(-15)
    });
  }
}