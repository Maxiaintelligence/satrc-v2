import crypto from 'crypto';
import { leerJSONBlob, escribirJSONBlob } from '../src/lib/compartido/googleDrive.js';
import { repararObjeto } from '../src/lib/compartido/mojibake.js';
import { EstadoDiocesanoResponseSchema } from '../src/schemas/estadoDiocesanoSchema.js';
import { generarTituloDictamen } from '../src/lib/compartido/dictamen.js';

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_REGISTROS_BITACORA = 500;

const PATH_REPORTE = 'reporte_diocesano_vigente.json';
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

function obtenerFechaHoraMexico(fecha = new Date()) {
  const fechaDia = fecha.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const horaExacta = fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const horaCorta = fecha.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return { fechaDia, horaExacta, horaCorta };
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

function tokenValido(req) {
  const esperado = process.env.SARA_ADMIN_TOKEN;
  const recibido = req.headers['x-admin-token'];
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const forzar = req.query?.forzar === 'true';

  if (forzar && !tokenValido(req)) {
    return res.status(401).json({ exito: false, error: "No autorizado" });
  }

  const ahora = new Date();
  const { fechaDia: fechaDiaMexico, horaExacta: horaExactaMexico, horaCorta: horaMexicoStr } = obtenerFechaHoraMexico(ahora);
  const proximaCorridaStr = obtenerFechaHoraMexico(new Date(ahora.getTime() + 3 * 3600000)).horaCorta;

  let estadoMaestro = null;
  let historialBitacora = [];
  let ultimoDictamen = null;
  let ultimoReporteGuardado = null;

  try {
    const [rep, est, bit] = await Promise.all([
      leerJSONBlob(PATH_REPORTE),
      leerJSONBlob('estado_ligero.json'),
      leerJSONBlob(PATH_BITACORA)
    ]);

    ultimoReporteGuardado = rep;
    estadoMaestro = est;
    
    if (bit) {
      historialBitacora = Array.isArray(bit.bitacora) ? bit.bitacora : [];
      ultimoDictamen = bit.ultimo_dictamen || null;
    }
  } catch (errBlob) {
    console.warn("Aviso leyendo Google Drive:", errBlob.message);
  }

  // --- BLOQUE PRINCIPAL: LEER DE DRIVE ---
  if (estadoMaestro && estadoMaestro.semaforo && !forzar) {
    const respuestaBlob = {
      ultimo_reporte_ondemand: repararObjeto(ultimoReporteGuardado),
      exito: true,
      origen: "GOOGLE_DRIVE_ACTUALIZADO",
      hora_servidor_mexico: estadoMaestro.hora_local_mexico || horaMexicoStr,
      dictamen: repararObjeto(estadoMaestro.dictamen || ultimoDictamen),
      semaforo: estadoMaestro.semaforo,
      evaluaciones: repararObjeto(estadoMaestro.evaluaciones),
      bitacora: repararObjeto(historialBitacora)
    };

    const validacion = EstadoDiocesanoResponseSchema.safeParse(respuestaBlob);

    if (validacion.success) {
      return res.json(validacion.data);
    } else {
      // Zod falló: devolvemos el error 503, pero SIN contaminar la bitácora
      console.error("❌ [ZOD] El estado de Drive no cumple el schema:", validacion.error.issues);
      return res.status(503).json({
        exito: false,
        origen: "ERROR_DRIVE",
        error: "El estado diocesano no es válido. Intente de nuevo en unos minutos.",
        hora_servidor_mexico: horaMexicoStr,
        dictamen: {
          estado_situacion: "SISTEMA_NO_DISPONIBLE",
          color: "#6B7280",
          titulo: "Sistema en mantenimiento",
          comentario_oficial: "El estado diocesano no es válido. Por favor, consulte el semáforo más tarde.",
          hora_evaluacion: horaMexicoStr,
          proxima_evaluacion: proximaCorridaStr,
          timestamp: ahora.toISOString()
        },
        semaforo: null,
        evaluaciones: [],
        bitacora: [],
        bitacora_guardada: false
      });
    }
  }

  // --- FALLBACK DE ERROR HONESTO (H-SARA-01/03/04) ---
  // Si llegamos aquí, Drive falló o no hay datos válidos.
  // NO escribimos bitácora. NO llamamos a Groq. NO mentimos con "Calma".
  console.error("❌ [SARA] Drive no disponible o estado vacío. Devolviendo 503.");

  return res.status(503).json({
    exito: false,
    origen: "ERROR_DRIVE",
    error: "El estado diocesano no está disponible en este momento. Intente de nuevo en unos minutos.",
    hora_servidor_mexico: horaMexicoStr,
    dictamen: {
      estado_situacion: "SISTEMA_NO_DISPONIBLE",
      color: "#6B7280",
      titulo: "Sistema en mantenimiento",
      comentario_oficial: "No se pudo cargar el estado diocesano publicado. Por favor, consulte el semáforo más tarde.",
      hora_evaluacion: horaMexicoStr,
      proxima_evaluacion: proximaCorridaStr,
      timestamp: ahora.toISOString()
    },
    semaforo: null,
    evaluaciones: [],
    bitacora: [],
    bitacora_guardada: false
  });
}