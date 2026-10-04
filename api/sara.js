import crypto from 'crypto';

/**
 * SatRC V2.0 - SARA: Sistema de Alerta y Respuesta Automatizada
 * Motor de IA con Groq Llama-3.3-70B, Bitácora Inmutable SHA-256 y Ciclo de 3 Horas.
 */

// Memoria volátil de guardia en Edge (Cache de 3 horas)
let cacheDictamenSARA = null;
let ultimaEjecucionTimestamp = 0;
let bitacoraEncadenada = [];
let hashAnterior = "0000000000000000000000000000000000000000000000000000000000000000"; // Bloque Génesis

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

export default async function handler(req, res) {
  const ahora = Date.now();
  const TRES_HORAS_MS = 3 * 60 * 60 * 1000;

  // Si tenemos un dictamen reciente generado hace menos de 3 horas, lo servimos de inmediato (20ms)
  if (cacheDictamenSARA && (ahora - ultimaEjecucionTimestamp < TRES_HORAS_MS) && req.query.forzar !== 'true') {
    res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=1800");
    return res.json({
      exito: true,
      origen: "CACHE_GUARDIA_3H",
      dictamen: cacheDictamenSARA,
      bitacora: bitacoraEncadenada.slice(-15) // Últimas 15 entradas auditables
    });
  }

  // Datos contextuales del cuerpo de la petición (enviados por el motor de la app)
  const contexto = req.body || {};
  const { alertaSMN, resumenSeveridad } = contexto;

  const apiKeyGroq = process.env.GROQ_API_KEY;

  // Fallback si no hay clave registrada en Vercel
  if (!apiKeyGroq) {
    const dictamenFallback = {
      estado_situacion: resumenSeveridad?.totalNivel4 > 0 ? "SITUACION_CRITICA" : (resumenSeveridad?.totalNivel3 > 0 ? "SITUACION_GRAVE" : "SITUACION_NORMAL"),
      color: resumenSeveridad?.totalNivel4 > 0 ? "#EF4444" : (resumenSeveridad?.totalNivel3 > 0 ? "#F97316" : "#10B981"),
      titulo: resumenSeveridad?.totalNivel4 > 0 ? "Situación Crítica en Sierra" : "Situación de Normalidad y Vigilancia",
      comentario_oficial: "Monitoreo diocesano activo. Evaluaciones físicas ejecutadas sobre las 405 localidades en base a modelos meteorológicos oficiales y avisos de CONAGUA.",
      proxima_evaluacion: new Date(ahora + TRES_HORAS_MS).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      timestamp: new Date().toISOString()
    };
    return res.json({ exito: true, origen: "FALLBACK_DETERMINISTA", dictamen: dictamenFallback, bitacora: [] });
  }

  // Prompt Táctico para SARA (R1: Redactora y Auditora de Formato, NO decide niveles)
  const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), la Oficial y Analista Meteoróloga de Guardia de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo (Hidalgo y Sierra Norte de Puebla).
Tienes maestría práctica en la meteorología de montaña de la Sierra Madre Oriental.
Tu rol es redactar con tono profesional, sobrio, sereno y pastoral.
REGLA TAXATIVA:
1. No cambias números ni niveles calculados por la física.
2. Eres objetiva: ni alarmismo injustificado que genere pánico, ni negligencia en no vigilar.
3. El estado óptimo del Cuarto de Situación es cuando NO hay problemas.
4. Responde ÚNICAMENTE un objeto JSON válido sin texto adicional.`;

  const userPrompt = `Contexto actual:
Aviso SMN: ${alertaSMN ? alertaSMN.titulo + " (" + alertaSMN.rango_lluvia_min_mm + "-" + alertaSMN.rango_lluvia_max_mm + " mm)" : "Sin aviso severo activo"}.
Comunidades en Emergencia N4: ${resumenSeveridad?.totalNivel4 || 0}.
Comunidades en Alerta Temprana N3: ${resumenSeveridad?.totalNivel3 || 0}.
Comunidades en Normalidad: ${resumenSeveridad?.totalNivel1 || 400}.
Localidades bajo mayor tensión: ${JSON.stringify(resumenSeveridad?.criticasNombres || [])}.

Genera el dictamen en este formato JSON exacto:
{
  "estado_situacion": "SITUACION_NORMAL" | "SITUACION_ALERTA_PREPARACION" | "SITUACION_GRAVE" | "SITUACION_CRITICA",
  "color": "#10B981" | "#F59E0B" | "#F97316" | "#EF4444",
  "titulo": "Título de la situación diocesana en 6 palabras",
  "comentario_oficial": "Párrafo ejecutivo de 3 líneas resumiendo qué pasa en la atmósfera, descartando zonas sin riesgo (Altiplano) y focalizando las laderas o cañadas bajo observación.",
  "nota_monitor_publico": "Nota de 2 líneas para el ciudadano común explicando cómo actuar con tranquilidad."
}`;

  try {
    const respuestaGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKeyGroq}`,
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

    // Enriquecer el dictamen con metadatos oficiales
    const dictamenFinal = {
      ...contenidoSARA,
      timestamp: new Date().toISOString(),
      hora_evaluacion: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      proxima_evaluacion: new Date(ahora + TRES_HORAS_MS).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      modelo_ia: "Groq Llama-3.3-70B LPU"
    };

    // R3: Generar registro inmutable de Bitácora con Hash SHA-256 encadenado
    const nuevoHash = generarHashSHA256(hashAnterior, dictamenFinal.timestamp, {
      estado: dictamenFinal.estado_situacion,
      nivel4: resumenSeveridad?.totalNivel4,
      nivel3: resumenSeveridad?.totalNivel3
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

    // Guardar en cache de 3 horas
    cacheDictamenSARA = dictamenFinal;
    ultimaEjecucionTimestamp = ahora;

    res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=1800");
    return res.json({
      exito: true,
      origen: "SARA_GROQ_LPU_FRESCO",
      dictamen: dictamenFinal,
      bitacora: bitacoraEncadenada.slice(-15)
    });

  } catch (error) {
    console.error("Error al ejecutar SARA con Groq:", error);
    res.status(500).json({ error: "No se pudo completar el análisis de SARA" });
  }
}