import crypto from 'crypto';
import { put, list } from '@vercel/blob';

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_REGISTROS_BITACORA = 500;

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
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

function normalizarAlertaSMN(alertaRaw) {
  if (!alertaRaw || typeof alertaRaw !== 'object') return null;
  if (!alertaRaw.activo) return null;
  if (typeof alertaRaw.nivel !== 'number' || alertaRaw.nivel < 2) return null;

  return {
    activo: true,
    nivel: alertaRaw.nivel,
    severidad: String(alertaRaw.severidad || 'Desconocida').slice(0, 50),
    titulo: String(alertaRaw.titulo || 'Aviso Meteorológico Activo').slice(0, 200),
    descripcion: String(alertaRaw.descripcion || '').slice(0, 500),
    estados_afectados: Array.isArray(alertaRaw.estados_afectados)
      ? alertaRaw.estados_afectados.slice(0, 5).map(e => String(e).slice(0, 5))
      : [],
    rango_lluvia_min_mm: typeof alertaRaw.rango_lluvia_min_mm === 'number' ? alertaRaw.rango_lluvia_min_mm : null,
    rango_lluvia_max_mm: typeof alertaRaw.rango_lluvia_max_mm === 'number' ? alertaRaw.rango_lluvia_max_mm : null,
    fecha_sincronizacion: String(alertaRaw.fecha_sincronizacion || '').slice(0, 50)
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  const ahora = new Date();
  const fechaDiaMexico = ahora.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const horaExactaMexico = ahora.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const horaCorta = ahora.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const timestampIsoUtc = ahora.toISOString();

  const { alertaSMN: alertaRaw, resumenSeveridad, focosCriticos } = req.body || {};
  const alertaSMN = normalizarAlertaSMN(alertaRaw);

  const apiKeyGroq = process.env.GROQ_API_KEY;

  if (!apiKeyGroq) {
    return res.status(500).json({ error: "Falta configurar GROQ_API_KEY en Vercel" });
  }

  let bloqueAvisoSMN;
  if (alertaSMN) {
    const estados = alertaSMN.estados_afectados.length > 0
      ? alertaSMN.estados_afectados.join(', ')
      : 'Sin estados especificados';
    const rangoLluvia = (alertaSMN.rango_lluvia_min_mm !== null && alertaSMN.rango_lluvia_max_mm !== null)
      ? `${alertaSMN.rango_lluvia_min_mm} a ${alertaSMN.rango_lluvia_max_mm} mm`
      : 'rango no especificado';

    bloqueAvisoSMN =
      `AVISO OFICIAL VIGENTE (CONAGUA/SMN) — Nivel ${alertaSMN.nivel} (${alertaSMN.severidad})\n` +
      `Título: ${alertaSMN.titulo}\n` +
      `Descripción: ${alertaSMN.descripcion || '(sin descripción)'}\n` +
      `Estados afectados: ${estados}\n` +
      `Rango de lluvia esperado: ${rangoLluvia}\n` +
      `Sincronizado: ${alertaSMN.fecha_sincronizacion || 'sin fecha'}`;
  } else {
    bloqueAvisoSMN = 'AVISO OFICIAL: Sin aviso extraordinario vigente para la región en este momento.';
  }

  const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), Oficial Meteoróloga de Guardia de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo (Hidalgo y Sierra Norte de Puebla).
Tu misión es redactar el "REPORTE DIOCESANO DE SITUACIÓN METEOROLÓGICA ON-DEMAND".
Voz: Meteoróloga profesional de montaña, rigurosa, serena, objetiva y pastoral.
REGLAS OBLIGATORIAS:
1. No inventes albergues ni ubicaciones que no conoces. Las recomendaciones tácticas deben ser de autoprotección comunitaria según el fenómeno activo (lluvia, deslaves, niebla o frío).
2. Reconoce que el Altiplano (Apan, Tizayuca, Pachuca) está en calma por sombra orográfica y que la Sierra (Huauchinango, Pahuatlán, Zihuateutla) concentra la tensión.
3. Si el bloque AVISO OFICIAL indica un aviso vigente de CONAGUA/SMN, DEBES integrarlo explícitamente en la sección I (atmósfera) y en la sección IV (evolución). Menciona el nivel del aviso, el rango de lluvia esperado y los estados afectados.
4. Responde ÚNICAMENTE un objeto JSON con las 6 secciones exactas:
{
  "seccion_I_atmosfera": "Párrafo sobre los sistemas sinópticos y vientos",
  "seccion_II_focos_sierra": "Párrafo explicando la física de laderas y cuencas bajo tensión",
  "seccion_III_altiplano_calma": "Párrafo explicando por qué las planicies están seguras",
  "seccion_IV_evolucion": "Pronóstico de las próximas 12 a 24 horas",
  "seccion_V_recomendaciones_pastorales": "Recomendaciones prácticas para párrocos y comunidades ante los fenómenos presentes",
  "seccion_VI_deslinde": "Texto formal de subordinación a Protección Civil y CONAGUA"
}`;

  const userPrompt = `Fecha y hora de emisión: ${fechaDiaMexico} a las ${horaExactaMexico}.

${bloqueAvisoSMN}

Emergencias Nivel 4 (Laderas >= 45°): ${resumenSeveridad?.totalNivel4 ?? 0}.
Alertas Nivel 3 (Laderas 25°-44°): ${resumenSeveridad?.totalNivel3 ?? 0}.
Estables Nivel 1 (Altiplano): ${resumenSeveridad?.totalNivel1 ?? 0}.
Comunidades prioritarias: ${JSON.stringify(focosCriticos || [])}.

Devuelve la respuesta en formato JSON estricto.`;

  try {
    const respuestaGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKeyGroq.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!respuestaGroq.ok) {
      throw new Error(`Groq API HTTP ${respuestaGroq.status}`);
    }

    const data = await respuestaGroq.json();
    const reporteJSON = JSON.parse(data.choices[0].message.content);

    const reporteCompleto = {
      id_reporte: `REP_ONDEMAND_${ahora.getTime()}`,
      origen_evento: "ON_DEMAND_OPERADOR",
      fecha_dia_mexico: fechaDiaMexico,
      hora_exacta_mexico: horaExactaMexico,
      timestamp_iso_utc: timestampIsoUtc,
      consenso_modelos: "GFS (EE.UU.) • ICON (Alemania)",
      aviso_smn_considerado: alertaSMN ? {
        nivel: alertaSMN.nivel,
        titulo: alertaSMN.titulo,
        rango_lluvia_min_mm: alertaSMN.rango_lluvia_min_mm,
        rango_lluvia_max_mm: alertaSMN.rango_lluvia_max_mm
      } : null,
      resumen_severidad: resumenSeveridad,
      focos_criticos: focosCriticos,
      reporte: reporteJSON
    };

    await put('reporte_diocesano_vigente.json', JSON.stringify(reporteCompleto, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    // Leer bitácora + ultimo_dictamen previo (N13: preservar si existe)
    let bitacoraHistorial = [];
    let hashUltimo = BLOQUE_GENESIS;
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
          if (bitacoraHistorial.length > 0) {
            hashUltimo = bitacoraHistorial[bitacoraHistorial.length - 1].hash_completo || BLOQUE_GENESIS;
          }
        }
      }
    } catch (e) {}

    const nuevoHash = generarHashSHA256(hashUltimo, timestampIsoUtc, {
      tipo: "ON_DEMAND_OPERADOR",
      fecha: fechaDiaMexico,
      hora: horaExactaMexico,
      titulo: reporteJSON.seccion_I_atmosfera?.slice(0, 50),
      aviso_smn_nivel: alertaSMN?.nivel ?? null
    });

    const estadoCalculado = (resumenSeveridad?.totalNivel4 || 0) > 0
      ? "SITUACION_CRITICA"
      : ((resumenSeveridad?.totalNivel3 || 0) > 0 ? "SITUACION_GRAVE" : "SITUACION_NORMAL");

    const nuevoId = siguienteIdBitacora(bitacoraHistorial);

    const entradaBitacora = {
      id: `SARA_LOG_${nuevoId}`,
      fecha_dia_mexico: fechaDiaMexico,
      hora_exacta_mexico: horaExactaMexico,
      timestamp_iso_utc: timestampIsoUtc,
      timestamp_local: horaCorta,
      origen_evento: "ON_DEMAND_OPERADOR",
      estado_situacion: normalizarEstadoSituacion(estadoCalculado),
      titulo: "Reporte Diocesano On-Demand Generado por el Operador",
      resumen: reporteJSON.seccion_I_atmosfera,
      prev_hash: hashUltimo.slice(0, 16) + "...",
      hash: nuevoHash.slice(0, 16) + "...",
      hash_completo: nuevoHash
    };

    bitacoraHistorial.push(entradaBitacora);

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

    return res.json({
      exito: true,
      reporte_guardado: reporteCompleto,
      bitacora_actualizada: bitacoraHistorial,
      registro_bitacora: entradaBitacora
    });

  } catch (error) {
    console.error("Fallo generando reporte On-Demand:", error);
    return res.status(500).json({ error: "No se pudo generar ni guardar el reporte" });
  }
}