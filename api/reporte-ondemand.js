import crypto from 'crypto';
import { put, list } from '@vercel/blob';
import { repararMojibake } from '../src/lib/compartido/mojibake.js';
import { normalizarDatosRegionales, construirBloqueRegional } from '../src/lib/compartido/regionales.js';

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

  const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), Oficial Meteoróloga de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo (Hidalgo, Sierra Norte de Puebla y Veracruz).
Tu misión es redactar el "REPORTE OPERATIVO DE SITUACIÓN METEOROLÓGICA" para brigadistas y coordinadores pastorales.
Voz: Meteoróloga profesional de montaña, rigurosa, serena, objetiva y pastoral.
Audiencia: Párrocos, brigadistas y coordinadores diocesanos que NO son meteorólogos. El reporte debe ser claro, accionable y útil para tomar decisiones en menos de 1 minuto.

FILOSOFÍA DEL REPORTE:
- No describe el tiempo, orienta decisiones.
- No enumera datos, sintetiza peligros.
- No usa claves técnicas, usa nombres reconocibles.
- No inventa información, traduce la información real a consecuencias operativas.

REGLAS OBLIGATORIAS:
1. USA NOMBRES RECONOCIBLES. Refiérete a las zonas por su nombre común (Altiplano Tula-Actopan, Pachuca Norte, Tulancingo) o por el municipio del nodo. NUNCA uses claves técnicas (ACT, APN, PMN, PMS, TIZ, HUA, etc.) ni el formato [XXX].
2. LA SECCIÓN 0 ES LA MÁS IMPORTANTE. Debe contener la DECISIÓN OPERATIVA del día: qué debe hacer hoy la red de brigadas, en qué zonas y con qué prioridad. Máximo 3 líneas. Estructura: "[Fenómeno principal] en [zonas]. Acción: [instrucción concreta]."
3. LA SECCIÓN I DEBE SER SÍNTESIS, NO CATÁLOGO. Menciona SOLO las 2-3 zonas con mayor actividad. Agrupa el resto en una sola frase ("las demás zonas permanecen en condiciones normales"). NO enumeres las 14 zonas. Al inicio de la sección I, destaca las 3 métricas más relevantes del día (ej. racha máxima, lluvia acumulada, temperatura extrema).
4. LA SECCIÓN II ES "ZONAS QUE REQUIEREN ATENCIÓN". Para las 3 zonas más críticas del día, incluye: (a) zona, (b) dato reportado, (c) qué hacer. Si hay N3/N4, esas van primero. Si NO hay N3/N4, usa las zonas con mayor número de localidades en N2. NUNCA digas "no hay localidades bajo tensión" sin más: si no hay N3/N4, di "Hoy no hay localidades en N3-N4. Las zonas con mayor vigilancia son: [lista]".
5. LA SECCIÓN III ES EVOLUCIÓN, NO COMPARATIVA. Describe qué cambió respecto a AYER. ¿Qué zonas empeoraron? ¿Qué zonas mejoraron? ¿Qué se mantiene igual? NO compares Altiplano vs Sierra. NO uses el término "Altiplano en calma".
6. LA SECCIÓN IV ES PERSPECTIVA + AVISO OFICIAL. Primera parte: evolución esperada en las próximas 12-24h. Segunda parte: aviso SMN vigente (menciónalo si existe, o declara "sin aviso extraordinario"). Ambas partes en el mismo párrafo.
7. LA SECCIÓN V ES LISTA DE VERIFICACIÓN. Estructura las recomendaciones por MOMENTO, no por zona: (a) Antes de salir, (b) Durante la actividad, (c) Si empeora, (d) Para reanudar. NO repitas recomendaciones genéricas ("mantener vigilancia", "verificar drenajes"). Traduce datos a consecuencias: si hay ráfagas de 52 km/h, di "revisar techumbres y estructuras ligeras".
8. LA SECCIÓN VI ES AVISO INSTITUCIONAL. Texto formal breve de subordinación a Protección Civil y CONAGUA.
9. TRADUCE NIVELES A DECISIONES OPERATIVAS. Cuando menciones el nivel de una zona, aclara qué significa para una brigada: N1 = continuar con actividades normales; N2 = reforzar precauciones; N3 = restringir actividades específicas; N4 = suspender actividades expuestas.
10. CLASIFICACIÓN DE VIENTO (crítico): No describas como "fuertes" las ráfagas por debajo de 60 km/h. Usa esta escala explícita:
   - Ráfagas < 40 km/h: suaves, sin mención especial.
   - Ráfagas 40-59 km/h: moderadas, requieren precaución en actividades expuestas.
   - Ráfagas ≥ 60 km/h: fuertes, requieren restricción de actividades.
   Algunas zonas del territorio tienen viento estructuralmente más fuerte por su altitud (Atotonilco-Sierra de Amajac a 2,700 msnm, Pachuca Metropolitana Norte a 2,400 msnm). Si sus ráfagas están por debajo de 60 km/h, descríbelas como "moderadas para esa zona", no como "fuertes".
11. ANTI-ALUCINACIÓN (crítico): usa EXCLUSIVAMENTE los datos del bloque "DATOS REGIONALES" y del "AVISO OFICIAL". PROHIBIDO mencionar sistemas sinópticos específicos (frentes fríos, ciclones, vaguadas) si no están explícitos en los datos.
12. COHERENCIA INTER-SECCIONES. Antes de responder, verifica que ninguna sección contradiga a otra. Ejemplo: si en la sección I mencionas ráfagas de 41 km/h, no puedes decir en la sección IV "sin ráfagas extremas".
12.bis. COHERENCIA SECCIÓN 0 ↔ SECCIÓN II (crítico). Las zonas mencionadas en la sección 0 (Decisión Operativa) deben ser EXACTAMENTE las mismas que las listadas en la sección II (Zonas que Requieren Atención). No puede haber divergencia entre ambas secciones. Si la sección 0 menciona 3 zonas, la sección II debe listar esas 3 zonas (ni más ni menos).
13. VOCABULARIO: usa "localidades" (no "municipios", no "comunidades", no "pueblos") al referirte a los conteos del semáforo.
14. Si el bloque "DATOS REGIONALES" menciona ZONAS SIN DATOS, decláralo explícitamente en la sección I.
15. FORMATO CON VIÑETAS: usa viñetas en las secciones 0, II, III y V. No escribas párrafos densos.
16. Responde ÚNICAMENTE un objeto JSON con las 7 secciones exactas. Cada sección debe tener un máximo de 5-7 líneas. Si una sección no tiene contenido relevante, escribe una frase breve en lugar de rellenar.

{
  "seccion_0_decision": "DECISIÓN OPERATIVA del día: fenómeno principal, zonas afectadas, acción inmediata. Máximo 3 líneas.",
  "seccion_I_atmosfera": "Síntesis de 2-3 zonas activas + agrupación del resto. Al inicio, 3 métricas destacadas del día.",
  "seccion_II_focos_sierra": "Zonas que requieren atención: (a) zona, (b) dato, (c) qué hacer. Solo las 3 más críticas. Si no hay N3-N4, listar las zonas con mayor N2.",
  "seccion_III_condiciones_altiplano": "Evolución respecto a ayer: qué empeoró, qué mejoró, qué se mantiene igual. Con viñetas.",
  "seccion_IV_evolucion": "Perspectiva 12-24h + aviso SMN vigente (o declaración de sin aviso). Máximo 4 líneas.",
  "seccion_V_recomendaciones_pastorales": "Lista de verificación por momento: (a) Antes de salir, (b) Durante, (c) Si empeora, (d) Para reanudar. Con viñetas.",
  "seccion_VI_deslinde": "Texto formal breve de subordinación a Protección Civil y CONAGUA."
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
        max_completion_tokens: 4096, // 🔥 FIX H8.5: Evita que el JSON de 7 secciones se corte
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })

    if (!respuestaGroq.ok) {
      const errorText = await respuestaGroq.text();
      console.error("❌ [GROQ] Error detallado:", errorText);
      throw new Error(`Groq API HTTP ${respuestaGroq.status}: ${errorText}`);
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
      'seccion_0_decision',
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