import crypto from 'crypto';
import { put, list } from '@vercel/blob';

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_REGISTROS_BITACORA = 500;
const TIMEOUT_GROQ_MS = 30000;

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

function normalizarDatosAtmosfericos(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

  const limpio = {
    nodo_nombre: String(raw.nodo_nombre || 'Nodo de referencia').slice(0, 100),
    ventana_analisis: String(raw.ventana_analisis || 'últimas 24 horas').slice(0, 50),
    lluvia_acumulada_24h_mm: num(raw.lluvia_acumulada_24h_mm),
    lluvia_proyectada_prox_24h_mm: num(raw.lluvia_proyectada_prox_24h_mm),
    temperatura_min_c: num(raw.temperatura_min_c),
    temperatura_max_c: num(raw.temperatura_max_c),
    temperatura_actual_c: num(raw.temperatura_actual_c),
    viento_max_kmh: num(raw.viento_max_kmh),
    rafaga_max_kmh: num(raw.rafaga_max_kmh),
    humedad_min_pct: num(raw.humedad_min_pct),
    humedad_max_pct: num(raw.humedad_max_pct),
    visibilidad_min_km: num(raw.visibilidad_min_km),
    confiabilidad_dominante: String(raw.confiabilidad_dominante || 'DESCONOCIDA').slice(0, 20)
  };

  const tieneAlgunDato = Object.values(limpio).some(v => typeof v === 'number' && v !== null);
  if (!tieneAlgunDato) return null;

  return limpio;
}

function construirBloqueAtmosferico(datos) {
  if (!datos) {
    return 'DATOS METEOROLÓGICOS REALES: no disponibles en esta emisión. Redacta la sección I describiendo únicamente condiciones generales prudentes, SIN inventar sistemas sinópticos (frentes fríos, ciclones, vaguadas) que no puedas verificar.';
  }

  const lineas = [
    `Nodo de referencia: ${datos.nodo_nombre}`,
    `Ventana analizada: ${datos.ventana_analisis}`,
    `Lluvia acumulada últimas 24 h: ${datos.lluvia_acumulada_24h_mm ?? 's/d'} mm`,
    `Lluvia proyectada próximas 24 h: ${datos.lluvia_proyectada_prox_24h_mm ?? 's/d'} mm`,
    `Temperatura: mín ${datos.temperatura_min_c ?? 's/d'} °C, máx ${datos.temperatura_max_c ?? 's/d'} °C, actual ${datos.temperatura_actual_c ?? 's/d'} °C`,
    `Viento sostenido máx: ${datos.viento_max_kmh ?? 's/d'} km/h`,
    `Ráfaga máxima: ${datos.rafaga_max_kmh ?? 's/d'} km/h`,
    `Humedad relativa: ${datos.humedad_min_pct ?? 's/d'}% a ${datos.humedad_max_pct ?? 's/d'}%`,
    `Visibilidad mínima: ${datos.visibilidad_min_km ?? 's/d'} km`,
    `Confiabilidad del consenso multi-modelo: ${datos.confiabilidad_dominante}`
  ];

  return 'DATOS METEOROLÓGICOS REALES MEDIDOS (fuente: Open-Meteo, consenso GFS + ICON + GEM):\n' +
         lineas.map(l => `- ${l}`).join('\n');
}

/**
 * C2 + N5 — Validación del token administrativo con timingSafeEqual.
 * Lee el token esperado desde SARA_ONDEMAND_TOKEN (variable de entorno secreta).
 */
function tokenValido(req) {
  const esperado = process.env.SARA_ONDEMAND_TOKEN;
  const recibido = req.headers['x-admin-token'];
  if (!esperado || typeof recibido !== 'string' || recibido.length === 0) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  // C2 + N5 — Validar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método no permitido. Usar POST." });
  }

  // C2 + N5 — Validar token administrativo
  if (!tokenValido(req)) {
    return res.status(401).json({ error: "No autorizado" });
  }

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

  const {
    alertaSMN: alertaRaw,
    resumenSeveridad,
    focosCriticos,
    datosAtmosfericos: datosAtmosfericosRaw,
    nodoReferencia
  } = req.body || {};

  const alertaSMN = normalizarAlertaSMN(alertaRaw);
  const datosAtmosfericos = normalizarDatosAtmosfericos(datosAtmosfericosRaw);

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

  const bloqueAtmosferico = construirBloqueAtmosferico(datosAtmosfericos);

  const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), Oficial Meteoróloga de Guardia de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo (Hidalgo y Sierra Norte de Puebla).
Tu misión es redactar el "REPORTE DIOCESANO DE SITUACIÓN METEOROLÓGICA ON-DEMAND".
Voz: Meteoróloga profesional de montaña, rigurosa, serena, objetiva y pastoral.

REGLAS OBLIGATORIAS:
1. No inventes albergues ni ubicaciones que no conoces. Las recomendaciones tácticas deben ser de autoprotección comunitaria según el fenómeno activo (lluvia, deslaves, niebla o frío).
2. Reconoce que el Altiplano (Apan, Tizayuca, Pachuca) está en calma por sombra orográfica y que la Sierra (Huauchinango, Pahuatlán, Zihuateutla) concentra la tensión.
3. ANTI-ALUCINACIÓN (crítico): la sección I debe redactarse EXCLUSIVAMENTE con base en el bloque "DATOS METEOROLÓGICOS REALES MEDIDOS" y en el "AVISO OFICIAL" si está activo. PROHIBIDO mencionar sistemas sinópticos específicos (frentes fríos, ciclones, depresiones tropicales, vaguadas, canales de baja presión) si el bloque de datos reales no los describe explícitamente. Si no hay evidencia de un sistema particular, describe las condiciones medidas (temperaturas, lluvia acumulada, vientos, humedad) sin atribuirles una causa sinóptica inventada.
4. Si el bloque AVISO OFICIAL indica un aviso vigente de CONAGUA/SMN, DEBES integrarlo explícitamente en las secciones I y IV, mencionando el nivel del aviso, el rango de lluvia esperado y los estados afectados.
5. VOCABULARIO OBLIGATORIO: usa siempre "localidades" (no "municipios", no "comunidades", no "pueblos") al referirte a los conteos del semáforo diocesano. Los municipios son la unidad administrativa; las localidades son la unidad de monitoreo del sistema.
6. Responde ÚNICAMENTE un objeto JSON con las 6 secciones exactas:
{
  "seccion_I_atmosfera": "Párrafo sobre las condiciones atmosféricas reales medidas en el nodo de referencia, sin inventar sistemas sinópticos",
  "seccion_II_focos_sierra": "Párrafo explicando la física de laderas y cuencas bajo tensión, basado en los conteos del semáforo",
  "seccion_III_altiplano_calma": "Párrafo explicando por qué las planicies están seguras",
  "seccion_IV_evolucion": "Pronóstico de las próximas 12 a 24 horas basado en los datos reales",
  "seccion_V_recomendaciones_pastorales": "Recomendaciones prácticas para párrocos y comunidades ante los fenómenos presentes",
  "seccion_VI_deslinde": "Texto formal de subordinación a Protección Civil y CONAGUA"
}`;

  const userPrompt = `Fecha y hora de emisión: ${fechaDiaMexico} a las ${horaExactaMexico}.
Nodo de referencia: ${nodoReferencia || datosAtmosfericos?.nodo_nombre || 'Huauchinango (Puebla)'}.

${bloqueAvisoSMN}

${bloqueAtmosferico}

SEMÁFORO DIOCESANO ACTUAL (sobre 405 localidades):
- Nivel 4 (Emergencia, laderas ≥ 45°): ${resumenSeveridad?.totalNivel4 ?? 0} localidades
- Nivel 3 (Alerta Temprana, laderas 25°-44°): ${resumenSeveridad?.totalNivel3 ?? 0} localidades
- Nivel 2 (Vigilancia, valles y niebla): ${resumenSeveridad?.totalNivel2 ?? 0} localidades
- Nivel 1 (Estables, Altiplano): ${resumenSeveridad?.totalNivel1 ?? 0} localidades

COMUNIDADES CRÍTICAS BAJO TENSIÓN (N3-N4): ${JSON.stringify(focosCriticos || [])}.

Devuelve la respuesta en formato JSON estricto.`;

  try {
    // A1 — Timeout explícito de 30 segundos sobre el fetch a Groq
    const respuestaGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_GROQ_MS),
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
      consenso_modelos: "GFS (EE.UU.) • ICON (Alemania) • GEM (Canadá)",
      nodo_referencia: nodoReferencia || datosAtmosfericos?.nodo_nombre || null,
      aviso_smn_considerado: alertaSMN ? {
        nivel: alertaSMN.nivel,
        titulo: alertaSMN.titulo,
        rango_lluvia_min_mm: alertaSMN.rango_lluvia_min_mm,
        rango_lluvia_max_mm: alertaSMN.rango_lluvia_max_mm
      } : null,
      datos_atmosfericos_considerados: datosAtmosfericos,
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
      aviso_smn_nivel: alertaSMN?.nivel ?? null,
      datos_atmosfericos_presentes: !!datosAtmosfericos
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
    // A1 — Manejo específico de timeout vs otros errores
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error("Timeout consultando Groq después de", TIMEOUT_GROQ_MS, "ms");
      return res.status(504).json({ error: "Timeout consultando Groq. Intente de nuevo." });
    }
    console.error("Fallo generando reporte On-Demand:", error);
    return res.status(500).json({ error: "No se pudo generar ni guardar el reporte" });
  }
}