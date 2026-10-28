import crypto from 'crypto';
import { leerJSONBlob, escribirJSONBlob } from '../src/lib/compartido/googleDrive.js';
import { repararMojibake } from '../src/lib/compartido/mojibake.js';
import { normalizarDatosRegionales, construirBloqueRegional } from '../src/lib/compartido/regionales.js';
import { REGLAS_MULTIVECTOR } from '../src/lib/compartido/promptsMultivector.js';

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_REGISTROS_BITACORA = 500;
const TIMEOUT_GROQ_MS = 8000; // Bajado a 8s para evitar Timeout de Vercel (10s)
const REINTENTO_VENTANA_MS = 30 * 60 * 1000;

let USUARIOS_AUTORIZADOS = {};
try {
  if (process.env.SATRC_OPERADORES_JSON) {
    USUARIOS_AUTORIZADOS = JSON.parse(process.env.SATRC_OPERADORES_JSON);
  } else {
    console.error("[R-01] Falta configurar SATRC_OPERADORES_JSON en Vercel.");
  }
} catch (e) {
  console.error("[R-01] Error parseando SATRC_OPERADORES_JSON:", e.message);
}

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

function tokenConsolaValido(req) {
  const esperado = process.env.SARA_ONDEMAND_TOKEN;
  if (!esperado) return true; 
  
  const recibido = req.headers['x-admin-token'];
  if (typeof recibido !== 'string' || recibido.length === 0) return false;
  
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método no permitido. Usar POST." });
  }

  if (!tokenConsolaValido(req)) {
    return res.status(401).json({ error: "No autorizado (token de consola)" });
  }

  const nombreOperador = validarClaveOperador(req);
  if (!nombreOperador) {
    return res.status(401).json({ error: "Clave de operador inválida" });
  }

  const ahora = new Date();
  const fechaDiaMexico = ahora.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'long', year: 'numeric' });
  const horaExactaMexico = ahora.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const horaCorta = ahora.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true });
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

  try {
    // Lectura de Google Drive
    let reporteVigente = null;
    let payloadBitacora = null;

    try {
      const [rep, bit] = await Promise.all([
        leerJSONBlob('reporte_diocesano_vigente.json'),
        leerJSONBlob('bitacora_sara.json')
      ]);
      reporteVigente = rep;
      payloadBitacora = bit;
    } catch (e) {
      console.warn("Aviso: no se pudo leer de Google Drive:", e.message);
    }

    const esParcialReal = datosRegionales && datosRegionales.zonas_ok < datosRegionales.zonas_totales;

    let origenEvento = 'ON_DEMAND_OPERADOR';
    if (esParcialReal) {
      origenEvento = 'ON_DEMAND_OPERADOR_PARCIAL';
    } else if (reporteVigente && reporteVigente.generado_por === nombreOperador) {
      const tsAnterior = new Date(reporteVigente.timestamp_iso_utc).getTime();
      if ((ahora.getTime() - tsAnterior) < REINTENTO_VENTANA_MS) {
        origenEvento = 'ON_DEMAND_OPERADOR_REINTENTO';
      }
    }

    let bloqueAvisoSMN;
    if (alertaSMN) {
      const estados = alertaSMN.estados_afectados.length > 0 ? alertaSMN.estados_afectados.join(', ') : 'Sin estados especificados';
      const rangoLluvia = (alertaSMN.rango_lluvia_min_mm !== null && alertaSMN.rango_lluvia_max_mm !== null) ? `${alertaSMN.rango_lluvia_min_mm} a ${alertaSMN.rango_lluvia_max_mm} mm` : 'rango no especificado';

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

    const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), Oficial Meteoróloga de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo.
FILOSOFÍA: No describe el tiempo, orienta decisiones. No usa claves técnicas, usa nombres reconocibles.
REGLAS:
1. SECCIÓN 0: Decisión operativa. Máximo 3 líneas.
2. SECCIÓN I: Síntesis de 2-3 zonas activas.
3. SECCIÓN II: Zonas que requieren atención. (a) zona, (b) dato, (c) qué hacer.
4. SECCIÓN III: Evolución respecto a ayer.
5. SECCIÓN IV: Perspectiva 12-24h + aviso SMN.
6. SECCIÓN V: Lista de verificación por momento.
7. SECCIÓN VI: Aviso institucional.
9. NIVELES: N1 = continuar; N2 = reforzar precauciones; N3 = restringir actividades específicas; N4 = suspender actividades expuestas.
10. VIENTO: < 40 km/h suaves; 40-59 moderadas; ≥ 60 fuertes.
11. ANTI-ALUCINACIÓN: usa EXCLUSIVAMENTE los datos reales.
17. CONTROL ESTRICTO DE EMERGENCIAS: Si Nivel 4 = 0 y Nivel 3 = 0, BAJO NINGUNA CIRCUNSTANCIA uses "suspender actividades", "evacuar" o "emergencia". Usa lenguaje de precaución y vigilancia.

${REGLAS_MULTIVECTOR}

Responde ÚNICAMENTE un objeto JSON con las 7 secciones exactas.`;

    const userPrompt = `Fecha y hora de emisión: ${fechaDiaMexico} a las ${horaExactaMexico}.
Operador: ${nombreOperador}.
Origen del reporte: ${origenEvento}.

${bloqueAvisoSMN}

${bloqueRegional}

SEMÁFORO DIOCESANO ACTUAL (sobre 405 localidades):
- Nivel 4 (Emergencia): ${resumenSeveridad?.totalNivel4 ?? 0} localidades
- Nivel 3 (Alerta Temprana): ${resumenSeveridad?.totalNivel3 ?? 0} localidades
- Nivel 2 (Vigilancia): ${resumenSeveridad?.totalNivel2 ?? 0} localidades
- Nivel 1 (Estables): ${resumenSeveridad?.totalNivel1 ?? 0} localidades

COMUNIDADES CRÍTICAS BAJO TENSIÓN (N3-N4): ${JSON.stringify(focosCriticos || [])}.

Devuelve la respuesta en formato JSON estricto.`;

    let reporteJSON;
    try {
      const respuestaGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_GROQ_MS),
        headers: {
          "Authorization": `Bearer ${apiKeyGroq.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.1,
          max_completion_tokens: 2500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!respuestaGroq.ok) {
        const errorText = await respuestaGroq.text();
        throw new Error(`Groq API HTTP ${respuestaGroq.status}: ${errorText}`);
      }

      const data = await respuestaGroq.json();
      reporteJSON = JSON.parse(data.choices[0].message.content);
      
      const secciones = ['seccion_0_decision', 'seccion_I_atmosfera', 'seccion_II_focos_sierra', 'seccion_III_condiciones_altiplano', 'seccion_IV_evolucion', 'seccion_V_recomendaciones_pastorales', 'seccion_VI_deslinde'];
      for (const clave of secciones) {
        if (typeof reporteJSON[clave] === 'string') {
          reporteJSON[clave] = repararMojibake(reporteJSON[clave]);
        }
      }
      
    } catch (error) {
      console.error("❌ [GROQ] Falló la generación. Activando plantilla de respaldo:", error.message);
      
      reporteJSON = {
        seccion_0_decision: "El sistema de redacción IA está temporalmente saturado. Revise el semáforo principal para tomar decisiones.",
        seccion_I_atmosfera: "No se pudo generar el texto dinámico por límite de la IA. El Semáforo Diocesano sigue siendo la fuente de verdad.",
        seccion_II_focos_sierra: "Consulte las localidades en Nivel 3 y Nivel 4 en la pantalla de la consola.",
        seccion_III_condiciones_altiplano: "Sin datos de evolución por fallo de IA.",
        seccion_IV_evolucion: "Sin datos de perspectiva por fallo de IA.",
        seccion_V_recomendaciones_pastorales: "Mantenga las precauciones habituales y consulte los avisos oficiales.",
        seccion_VI_deslinde: "Las determinaciones de Protección Civil y CONAGUA prevalecen."
      };
    }

    const reporteCompleto = {
      id_reporte: `REP_ONDEMAND_${ahora.getTime()}`,
      origen: origenEvento,
      generado_por: nombreOperador,
      es_parcial: esParcialReal,
      fecha_dia_mexico: fechaDiaMexico,
      hora_exacta_mexico: horaExactaMexico,
      timestamp_iso_utc: timestampIsoUtc,
      consenso_modelos: "GFS • ICON • GEM",
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

    let guardadoEnBlob = false;
    if (!esParcialReal) {
      await escribirJSONBlob('reporte_diocesano_vigente.json', JSON.stringify(reporteCompleto, null, 2));
      guardadoEnBlob = true;
    }

    let bitacoraHistorial = [];
    let hashUltimo = BLOQUE_GENESIS;
    let ultimoDictamenPrevio = null;

    if (payloadBitacora) {
      bitacoraHistorial = payloadBitacora.bitacora || [];
      ultimoDictamenPrevio = payloadBitacora.ultimo_dictamen || null;
      if (bitacoraHistorial.length > 0) {
        hashUltimo = bitacoraHistorial[bitacoraHistorial.length - 1].hash_completo || BLOQUE_GENESIS;
      }
    }

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

    const payloadBitacoraFinal = { bitacora: bitacoraHistorial };
    if (ultimoDictamenPrevio) {
      payloadBitacoraFinal.ultimo_dictamen = ultimoDictamenPrevio;
    }

    await escribirJSONBlob('bitacora_sara.json', JSON.stringify(payloadBitacoraFinal));

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