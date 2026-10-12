import crypto from 'crypto';
import { put, list } from '@vercel/blob';

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_REGISTROS_BITACORA = 500;
const TIMEOUT_GROQ_MS = 30000;
const REINTENTO_VENTANA_MS = 30 * 60 * 1000; // 30 minutos

// ============================================================
// MAPA DE USUARIOS AUTORIZADOS
// Añadir/eliminar usuarios: editar este objeto.
// Formato: 'clave': 'Nombre completo para bitácora'
// ============================================================
const USUARIOS_AUTORIZADOS = {
  'Antonio2026': 'Ing. Antonio G. Madrigal',
  'Roberto2026': 'Padre Roberto López Medina',
  'Omar2026':    'Padre Omar Martínez Vázquez',
  'Obispo2026':  'Mons. "Oscar Roberto Domínguez C."'
};

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

/**
 * N22 — Reparación de doble encoding UTF-8 (mojibake).
 * 
 * Groq devuelve ocasionalmente texto con doble encoding: "ó" se convierte
 * en "Ã³". Este parche revierte esa corrupción antes de guardar en el Blob.
 * 
 * Causa raíz pendiente de diagnóstico profundo (V3.0). Este parche es 
 * defensivo y no rompe nada si el texto ya está correcto.
 */
function repararMojibake(texto) {
  if (typeof texto !== 'string' || !texto) return texto;
  const tieneMojibake = /[ÃÂ][\u0080-\u00BF]/.test(texto);
  if (!tieneMojibake) return texto;
  try {
    const bytes = Buffer.from(texto, 'latin1');
    const reparado = bytes.toString('utf8');
    if (reparado.length < texto.length && !/[ÃÂ][\u0080-\u00BF]/.test(reparado)) {
      return reparado;
    }
    return texto;
  } catch (e) {
    return texto;
  }
}

function normalizarDatosRegionales(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.resumenes)) return null;

  const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

  const resumenes = raw.resumenes.map(r => ({
    zona_id: String(r.zona_id || '').slice(0, 5),
    zona_nombre: String(r.zona_nombre || '').slice(0, 100),
    nodo_referencia: String(r.nodo_referencia || '').slice(0, 150),
    poblacion: num(r.poblacion) || 0,
    lluvia_ayer_24h_mm: num(r.lluvia_ayer_24h_mm),
    lluvia_hoy_24h_mm: num(r.lluvia_hoy_24h_mm),
    temperatura_min_c: num(r.temperatura_min_c),
    temperatura_max_c: num(r.temperatura_max_c),
    temperatura_actual_c: num(r.temperatura_actual_c),
    viento_max_kmh: num(r.viento_max_kmh),
    rafaga_max_kmh: num(r.rafaga_max_kmh),
    humedad_min_pct: num(r.humedad_min_pct),
    humedad_max_pct: num(r.humedad_max_pct),
    visibilidad_min_km: num(r.visibilidad_min_km),
    confiabilidad_dominante: String(r.confiabilidad_dominante || 'DESCONOCIDA').slice(0, 20)
  }));

  return {
    zonas_totales: parseInt(raw.zonas_totales) || 14,
    zonas_ok: parseInt(raw.zonas_ok) || 0,
    zonas_fallidas: Array.isArray(raw.zonas_fallidas) ? raw.zonas_fallidas.slice(0, 14).map(z => String(z).slice(0, 5)) : [],
    resumenes
  };
}

function construirBloqueRegional(datosRegionales) {
  if (!datosRegionales || datosRegionales.resumenes.length === 0) {
    return 'DATOS REGIONALES POR ZONA: no disponibles en esta emisión.';
  }

  const lineas = datosRegionales.resumenes.map(r => {
    const fmt = (v) => v === null || v === undefined ? 's/d' : v;
    return `[${r.zona_id}] ${r.zona_nombre} | Nodo: ${r.nodo_referencia}
  - AYER (24h): Lluvia ${fmt(r.lluvia_ayer_24h_mm)} mm
  - HOY (24h): Lluvia ${fmt(r.lluvia_hoy_24h_mm)} mm | Temp ${fmt(r.temperatura_min_c)}/${fmt(r.temperatura_max_c)} °C | Viento máx ${fmt(r.viento_max_kmh)} km/h | Ráfaga máx ${fmt(r.rafaga_max_kmh)} km/h
  - Humedad ${fmt(r.humedad_min_pct)}%-${fmt(r.humedad_max_pct)}% | Visibilidad mín ${fmt(r.visibilidad_min_km)} km | Confiabilidad: ${r.confiabilidad_dominante}`;
  });

  const encabezado = `DATOS REGIONALES POR ZONA (${datosRegionales.zonas_ok}/${datosRegionales.zonas_totales} zonas disponibles, consenso GFS + ICON + GEM):`;

  let bloque = encabezado + '\n\n' + lineas.join('\n\n');

  if (datosRegionales.zonas_fallidas.length > 0) {
    bloque += `\n\nZONAS SIN DATOS EN ESTA EMISIÓN: ${datosRegionales.zonas_fallidas.join(', ')}.`;
  }

  return bloque;
}

function tokenConsolaValido(req) {
  const esperado = process.env.SARA_ONDEMAND_TOKEN;
  const recibido = req.headers['x-admin-token'];
  if (!esperado || typeof recibido !== 'string' || recibido.length === 0) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function validarClaveOperador(req) {
  const recibida = req.headers['x-user-key'];
  if (!recibida || typeof recibida !== 'string') return null;
  return USUARIOS_AUTORIZADOS[recibida] || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  // Validar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método no permitido. Usar POST." });
  }

  // Validar token de consola
  if (!tokenConsolaValido(req)) {
    return res.status(401).json({ error: "No autorizado (token de consola)" });
  }

  // Validar clave de operador
  const nombreOperador = validarClaveOperador(req);
  if (!nombreOperador) {
    return res.status(401).json({ error: "Clave de operador inválida" });
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
    datosRegionales: datosRegionalesRaw,
    esModoEmergencia
  } = req.body || {};

  const alertaSMN = normalizarAlertaSMN(alertaRaw);
  const datosRegionales = normalizarDatosRegionales(datosRegionalesRaw);

  const apiKeyGroq = process.env.GROQ_API_KEY;
  if (!apiKeyGroq) {
    return res.status(500).json({ error: "Falta configurar GROQ_API_KEY en Vercel" });
  }

  // Leer reporte vigente del Blob (para detección de reintento)
  let reporteVigente = null;
  try {
    const listado = await list();
    const blobRep = listado?.blobs?.find(b => b.pathname.includes('reporte_diocesano_vigente.json'));
    if (blobRep) {
      const rR = await fetch(blobRep.url, { cache: 'no-store' });
      if (rR.ok) reporteVigente = await rR.json();
    }
  } catch (e) {
    console.warn("Aviso: no se pudo leer el reporte vigente:", e.message);
  }

  // El backend determina SIEMPRE si hay zonas faltantes, sin confiar en el cliente.
  const esParcialReal = datosRegionales && datosRegionales.zonas_ok < datosRegionales.zonas_totales;

  // Determinar origen_evento
  // Regla de prioridad: fallo de zona domina sobre el tiempo
  let origenEvento = 'ON_DEMAND_OPERADOR';
  if (esParcialReal) {
    origenEvento = 'ON_DEMAND_OPERADOR_PARCIAL';
  } else if (reporteVigente && reporteVigente.generado_por === nombreOperador) {
    const tsAnterior = new Date(reporteVigente.timestamp_iso_utc).getTime();
    if ((ahora.getTime() - tsAnterior) < REINTENTO_VENTANA_MS) {
      origenEvento = 'ON_DEMAND_OPERADOR_REINTENTO';
    }
  }

  // Construir bloque SMN
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

  const bloqueRegional = construirBloqueRegional(datosRegionales);

  const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), Oficial Meteoróloga de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo (Hidalgo y Sierra Norte de Puebla).
Tu misión es redactar el "REPORTE DIOCESANO DE SITUACIÓN METEOROLÓGICA ON-DEMAND".
Voz: Meteoróloga profesional de montaña, rigurosa, serena, objetiva y pastoral.

REGLAS OBLIGATORIAS:
1. No inventes albergues ni ubicaciones que no conoces. Las recomendaciones tácticas deben ser de autoprotección comunitaria según el fenómeno activo (lluvia, deslaves, niebla o frío).
2. Reconoce que el Altiplano (Apan, Tizayuca, Pachuca) está en calma por sombra orográfica y que la Sierra (Huauchinango, Pahuatlán, Zihuateutla) concentra la tensión.
3. ANTI-ALUCINACIÓN (crítico): la sección I debe redactarse EXCLUSIVAMENTE con base en el bloque "DATOS REGIONALES POR ZONA" y en el "AVISO OFICIAL" si está activo. PROHIBIDO mencionar sistemas sinópticos específicos (frentes fríos, ciclones, depresiones tropicales, vaguadas, canales de baja presión) si el bloque de datos regionales no los describe explícitamente. Si no hay evidencia de un sistema particular, describe las condiciones medidas (temperaturas, lluvia acumulada, vientos, humedad) sin atribuirles una causa sinóptica inventada.
4. Si el bloque AVISO OFICIAL indica un aviso vigente de CONAGUA/SMN, DEBES integrarlo explícitamente en las secciones I y IV, mencionando el nivel del aviso, el rango de lluvia esperado y los estados afectados.
5. VOCABULARIO OBLIGATORIO: usa siempre "localidades" (no "municipios", no "comunidades", no "pueblos") al referirte a los conteos del semáforo diocesano. Los municipios son la unidad administrativa; las localidades son la unidad de monitoreo del sistema.
6. Si el bloque "DATOS REGIONALES POR ZONA" menciona ZONAS SIN DATOS, debes declararlo explícitamente en la sección I. No inventes datos para esas zonas.
7. Responde ÚNICAMENTE un objeto JSON con las 6 secciones exactas:
{
  "seccion_I_atmosfera": "Párrafo sobre las condiciones atmosféricas reales medidas en las 14 zonas, sin inventar sistemas sinópticos. Si hay zonas sin datos, mencionarlas.",
  "seccion_II_focos_sierra": "Párrafo explicando la física de laderas y cuencas bajo tensión, basado en los conteos del semáforo y los datos regionales.",
  "seccion_III_condiciones_altiplano": "Párrafo describiendo las condiciones meteorológicas reales de las 5 zonas del Altiplano y valles (ACT, APN, PMN, PMS, TIZ). Describe el estado medido (temperaturas, lluvia, viento, humedad) sin asumir estabilidad ni calma. Si hay heladas, tormentas eléctricas o riesgo de encharcamiento, menciónalo explícitamente. NO declares el Altiplano como zona de seguridad.",
  "seccion_IV_evolucion": "Párrafo sobre la evolución del ciclo meteorológico (48 horas): qué ocurrió ayer, cuál es el estado actual y qué se espera mañana, basado en los datos regionales.",
  "seccion_V_recomendaciones_pastorales": "Recomendaciones prácticas para párrocos y comunidades ante los fenómenos presentes.",
  "seccion_VI_deslinde": "Texto formal de subordinación a Protección Civil y CONAGUA"
}`;

  const userPrompt = `Fecha y hora de emisión: ${fechaDiaMexico} a las ${horaExactaMexico}.
Operador: ${nombreOperador}.
Origen del reporte: ${origenEvento}.

${bloqueAvisoSMN}

${bloqueRegional}

SEMÁFORO DIOCESANO ACTUAL (sobre 405 localidades):
- Nivel 4 (Emergencia, laderas ≥ 45°): ${resumenSeveridad?.totalNivel4 ?? 0} localidades
- Nivel 3 (Alerta Temprana, laderas 25°-44°): ${resumenSeveridad?.totalNivel3 ?? 0} localidades
- Nivel 2 (Vigilancia, valles y niebla): ${resumenSeveridad?.totalNivel2 ?? 0} localidades
- Nivel 1 (Estables, Altiplano): ${resumenSeveridad?.totalNivel1 ?? 0} localidades

COMUNIDADES CRÍTICAS BAJO TENSIÓN (N3-N4): ${JSON.stringify(focosCriticos || [])}.

Devuelve la respuesta en formato JSON estricto.`;

  try {
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

    let reporteJSON;
    try {
      reporteJSON = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error("Groq devolvió JSON inválido:", data.choices[0].message.content.slice(0, 200));
      throw new Error("Groq devolvió formato inválido");
    }

    // N22 — Reparar doble encoding UTF-8 en las 6 secciones
    const secciones = [
      'seccion_I_atmosfera',
      'seccion_II_focos_sierra',
      'seccion_III_condiciones_altiplano',
      'seccion_IV_evolucion',
      'seccion_V_recomendaciones_pastorales',
      'seccion_VI_deslinde'
    ];
    for (const clave of secciones) {
      if (typeof reporteJSON[clave] === 'string') {
        reporteJSON[clave] = repararMojibake(reporteJSON[clave]);
      }
    }

    const reporteCompleto = {
      id_reporte: `REP_ONDEMAND_${ahora.getTime()}`,
      origen: origenEvento,
      generado_por: nombreOperador,
      es_parcial: esParcialReal,
      fecha_dia_mexico: fechaDiaMexico,
      hora_exacta_mexico: horaExactaMexico,
      timestamp_iso_utc: timestampIsoUtc,
      consenso_modelos: "GFS (EE.UU.) • ICON (Alemania) • GEM (Canadá)",
      datos_regionales: datosRegionales,
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

    // El backend determina SIEMPRE si el reporte es parcial.
    // Un reporte parcial NUNCA se guarda en el Blob.
    let guardadoEnBlob = false;
    if (!esParcialReal) {
      await put('reporte_diocesano_vigente.json', JSON.stringify(reporteCompleto, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });
      guardadoEnBlob = true;
    } else {
      console.log("[C2c] Reporte parcial. No se guarda en Blob.");
    }

    // Bitácora
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
      tipo: origenEvento,
      fecha: fechaDiaMexico,
      hora: horaExactaMexico,
      operador: nombreOperador,
      zonas_ok: datosRegionales?.zonas_ok || 0,
      zonas_fallidas: datosRegionales?.zonas_fallidas || []
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
      origen_evento: origenEvento,
      generado_por: nombreOperador,
      estado_situacion: normalizarEstadoSituacion(estadoCalculado),
      titulo: esParcialReal
        ? `Reporte Diocesano Parcial (Modo Emergencia) generado por ${nombreOperador}`
        : `Reporte Diocesano On-Demand generado por ${nombreOperador}`,
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
      reporte_guardado: guardadoEnBlob ? reporteCompleto : null,
      reporte_generado: reporteCompleto,
      guardado_en_blob: guardadoEnBlob,
      es_parcial: esParcialReal,
      bitacora_actualizada: bitacoraHistorial,
      registro_bitacora: entradaBitacora
    });

  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error("Timeout consultando Groq después de", TIMEOUT_GROQ_MS, "ms");
      return res.status(504).json({ error: "Timeout consultando Groq. Intente de nuevo." });
    }
    console.error("Fallo generando reporte On-Demand:", error);
    return res.status(500).json({ error: "No se pudo generar ni guardar el reporte" });
  }
}