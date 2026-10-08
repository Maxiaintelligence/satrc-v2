import crypto from 'crypto';
import { put, list } from '@vercel/blob';
 
const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_REGISTROS_BITACORA = 500; // rotación: se conservan los últimos N registros
const TIMEOUT_GROQ_MS = 10000;
 
const PATH_REPORTE = 'reporte_diocesano_vigente.json';
const PATH_ESTADO = 'estado_diocesano.json';
const PATH_BITACORA = 'bitacora_sara.json';
 
const ESTADOS = {
  SITUACION_CRITICA: { color: "#EF4444", titulo: "Emergencia por Temporal en Sierra" },
  SITUACION_GRAVE: { color: "#F97316", titulo: "Situación Diocesana de Alerta" },
  SITUACION_NORMAL: { color: "#10B981", titulo: "Situación Diocesana de Calma" }
};
 
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
 
function tokenValido(req) {
  const esperado = process.env.SARA_ADMIN_TOKEN;
  const recibido = req.headers['x-admin-token'];
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
 
async function leerJSONBlob(blob, ahora) {
  const res = await fetch(`${blob.url}?t=${ahora.getTime()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Lectura de ${blob.pathname} falló: HTTP ${res.status}`);
  return res.json();
}
 
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
 
  const forzar = req.query?.forzar === 'true';
 
  // Forzar una evaluación consume cuota de Groq y escribe en Blob: requiere token
  if (forzar && !tokenValido(req)) {
    return res.status(401).json({ exito: false, error: "No autorizado" });
  }
 
  const ahora = new Date();
  const horaMexicoStr = obtenerHoraMexico(ahora);
 
  let estadoMaestro = null;
  let historialBitacora = [];
  let ultimoDictamen = null;
  let ultimoReporteGuardado = null;
  let bitacoraLeida = false; // true solo si la lectura fue exitosa o la bitácora legítimamente no existe
 
  try {
    const listadoBlobs = await list();
    const blobs = listadoBlobs?.blobs || [];
    const buscar = (nombre) => blobs.find(b => b.pathname === nombre);
 
    // Cada lectura es independiente: un fallo en una no afecta a las demás
    const blobRep = buscar(PATH_REPORTE);
    if (blobRep) {
      try {
        ultimoReporteGuardado = await leerJSONBlob(blobRep, ahora);
      } catch (e) {
        console.warn("Aviso reporte on-demand:", e.message);
      }
    }
 
    const blobEstado = buscar(PATH_ESTADO);
    if (blobEstado) {
      try {
        estadoMaestro = await leerJSONBlob(blobEstado, ahora);
      } catch (e) {
        console.warn("Aviso estado maestro:", e.message);
      }
    }
 
    const blobBitacora = buscar(PATH_BITACORA);
    if (blobBitacora) {
      try {
        const dBit = await leerJSONBlob(blobBitacora, ahora);
        historialBitacora = Array.isArray(dBit.bitacora) ? dBit.bitacora : [];
        ultimoDictamen = dBit.ultimo_dictamen || null;
        bitacoraLeida = true;
      } catch (e) {
        console.warn("Aviso bitácora:", e.message);
      }
    } else {
      // No existe todavía: cadena nueva legítima
      bitacoraLeida = true;
    }
  } catch (errBlob) {
    console.warn("Aviso Vercel Blob:", errBlob.message);
  }
 
  // Si tenemos el estado maestro guardado en Blob y no es forzado, servirlo
  if (estadoMaestro && estadoMaestro.evaluaciones && estadoMaestro.evaluaciones.length > 0 && !forzar) {
    return res.json({
      ultimo_reporte_ondemand: ultimoReporteGuardado,
      exito: true,
      origen: "VERCEL_BLOB_ACTUALIZADO",
      hora_servidor_mexico: estadoMaestro.hora_local_mexico || horaMexicoStr,
      dictamen: estadoMaestro.dictamen || ultimoDictamen,
      semaforo: estadoMaestro.semaforo,
      evaluaciones: estadoMaestro.evaluaciones,
      bitacora: historialBitacora
    });
  }
 
  // Evaluación en vivo con Groq si se forzó o si el Blob está vacío
  const contexto = req.body || {};
  const { alertaSMN, resumenSeveridad } = contexto;
  const apiKeyGroq = process.env.GROQ_API_KEY;
  const killSwitchActivo = process.env.SARA_LLM_KILL_SWITCH === 'DISABLED';
  const proximaCorridaStr = obtenerHoraMexico(new Date(ahora.getTime() + 3 * 3600000));
 
  // El estado y el color los calcula el código a partir de la severidad real;
  // el LLM solo puede redactar título y comentario.
  const nivel4 = resumenSeveridad?.totalNivel4 || 0;
  const nivel3 = resumenSeveridad?.totalNivel3 || 0;
  const estadoSituacion = nivel4 > 0 ? "SITUACION_CRITICA" : (nivel3 > 0 ? "SITUACION_GRAVE" : "SITUACION_NORMAL");
  const { color, titulo: tituloBase } = ESTADOS[estadoSituacion];
 
  let dictamenFinal = {
    estado_situacion: estadoSituacion,
    color,
    titulo: tituloBase,
    comentario_oficial: `Monitoreo en vivo (${horaMexicoStr}): Sincronización oficial con CONAGUA/SMN. Vigilancia prioritaria en comunidades de ladera de la Sierra. Altiplano central en calma.`,
    hora_evaluacion: horaMexicoStr,
    proxima_evaluacion: proximaCorridaStr,
    timestamp: ahora.toISOString(),
    modelo_ia: "SARA Core en Vivo"
  };
 
  // Solo si Groq está activo y el KILL_SWITCH no está forzado a DISABLED
  if (apiKeyGroq && !killSwitchActivo) {
    try {
      const resG = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_GROQ_MS),
        headers: { "Authorization": `Bearer ${apiKeyGroq.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Eres SARA, Oficial Meteoróloga de Guardia de Cáritas Tulancingo. Hora oficial de México: ${horaMexicoStr}.
El estado de la situación ya fue determinado: ${estadoSituacion}. No lo cambies.
Genera el informe diocesano en JSON con claves: titulo, comentario_oficial.`
            },
            {
              role: "user",
              content: `Alerta SMN: ${alertaSMN ? alertaSMN.titulo : 'Normal'}.
Nivel 4: ${nivel4}, Nivel 3: ${nivel3}.
Comunidades críticas: ${JSON.stringify(resumenSeveridad?.criticasNombres || [])}.`
            }
          ]
        })
      });
 
      if (resG.ok) {
        const dataG = await resG.json();
        const contenido = JSON.parse(dataG.choices[0].message.content);
 
        if (typeof contenido.titulo !== 'string' || typeof contenido.comentario_oficial !== 'string'
            || !contenido.titulo.trim() || !contenido.comentario_oficial.trim()) {
          throw new Error("Respuesta del LLM con formato inválido");
        }
 
        dictamenFinal = {
          estado_situacion: estadoSituacion,
          color,
          titulo: contenido.titulo.trim().slice(0, 120),
          comentario_oficial: contenido.comentario_oficial.trim().slice(0, 1000),
          hora_evaluacion: horaMexicoStr,
          proxima_evaluacion: proximaCorridaStr,
          timestamp: ahora.toISOString(),
          modelo_ia: "openai/gpt-oss-120b"
        };
      }
    } catch (e) {
      console.warn("Fallo Groq en vivo, recurriendo a plantilla segura:", e.message);
    }
  }
 
  // Bitácora SHA-256 (solo se escribe si la lectura previa fue confiable,
  // para no sobrescribir la cadena existente con una nueva desde el génesis)
  let bitacoraGuardada = false;
 
  if (bitacoraLeida) {
    const prevHash = historialBitacora.length > 0
      ? historialBitacora[historialBitacora.length - 1].hash_completo
      : BLOQUE_GENESIS;
    const nuevoHash = generarHashSHA256(prevHash, dictamenFinal.timestamp, {
      estado: dictamenFinal.estado_situacion,
      hora: horaMexicoStr
    });
 
    // El id usa un contador que no se reinicia al rotar la bitácora
    const ultimoId = historialBitacora.length > 0
      ? parseInt(String(historialBitacora[historialBitacora.length - 1].id).replace('SARA_LOG_', ''), 10) || historialBitacora.length
      : 0;
 
    historialBitacora.push({
      id: `SARA_LOG_${ultimoId + 1}`,
      timestamp_local: horaMexicoStr,
      timestamp_iso: dictamenFinal.timestamp,
      estado_situacion: dictamenFinal.estado_situacion,
      titulo: dictamenFinal.titulo,
      resumen: dictamenFinal.comentario_oficial,
      prev_hash: prevHash.slice(0, 16) + "...",
      hash: nuevoHash.slice(0, 16) + "...",
      hash_completo: nuevoHash
    });
 
    // Rotación: el primer registro conservado mantiene su prev_hash como ancla
    if (historialBitacora.length > MAX_REGISTROS_BITACORA) {
      historialBitacora = historialBitacora.slice(-MAX_REGISTROS_BITACORA);
    }
 
    try {
      // Nota: dos peticiones simultáneas pueden pisarse. Lo ideal es que solo
      // el cron escriba la bitácora.
      await put(PATH_BITACORA, JSON.stringify({ bitacora: historialBitacora, ultimo_dictamen: dictamenFinal }), {
        access: 'public', // la bitácora es accesible por URL; cambiar si debe ser privada
        addRandomSuffix: false,
        allowOverwrite: true
      });
      bitacoraGuardada = true;
    } catch (e) {
      console.error("Error al actualizar bitacora Blob:", e);
    }
  } else {
    console.error("Bitácora no escrita: la lectura previa falló y se evitó sobrescribir la cadena.");
  }
 
  return res.json({
    ultimo_reporte_ondemand: ultimoReporteGuardado,
    exito: true,
    origen: "RESPUESTA_EN_VIVO",
    hora_servidor_mexico: horaMexicoStr,
    dictamen: dictamenFinal,
    bitacora: historialBitacora,
    bitacora_guardada: bitacoraGuardada,
    evaluaciones: estadoMaestro?.evaluaciones || null
  });
}