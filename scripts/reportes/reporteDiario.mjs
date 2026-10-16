/**
 * SatRC V2.0 — Módulo de Reporte Diario Automático
 * 
 * Genera el reporte operativo completo una vez al día (a las 6:00 AM hora México).
 * Se ejecuta desde scripts/ejecutar_sara_autonomo.mjs.
 * 
 * DIFERENCIAS CON EL ON-DEMAND:
 * - Corre dentro del runner (GitHub Actions), no en Vercel Functions.
 * - Ventana temporal de 72h (ayer + hoy + mañana).
 * - Sección IV específica: "Evolución del Ciclo Meteorológico (48h)".
 * - Solo se genera si es la primera corrida >= 6:00 AM del día.
 * - Marca es_parcial: true si la cobertura es < 14/14 zonas.
 * 
 * ⚠️ DEUDA TÉCNICA (a resolver en V3.0):
 * Las funciones repararMojibake(), normalizarDatosRegionales() y 
 * construirBloqueRegional() están duplicadas desde api/reporte-ondemand.js.
 * Extraer a un módulo compartido en V3.0.
 * 
 * @module reporteDiario
 */

import { put, list } from '@vercel/blob';
import crypto from 'crypto';

const BLOQUE_GENESIS = "0000000000000000000000000000000000000000000000000000000000000000";
const MAX_REGISTROS_BITACORA = 500;
const TIMEOUT_GROQ_MS = 45000; // 45s (el reporte es más largo que el on-demand)

// ============================================================
// HELPERS (duplicados desde api/reporte-ondemand.js)
// ============================================================

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

function generarHashSHA256(prevHash, timestamp, datos) {
  return crypto.createHash('sha256')
    .update(prevHash + timestamp + JSON.stringify(datos))
    .digest('hex');
}

function normalizarEstadoSituacion(estadoRaw) {
  if (!estadoRaw || typeof estadoRaw !== 'string') return 'SITUACION_NORMAL';
  const limpio = estadoRaw.trim().toUpperCase();
  if (limpio === 'CORRIDA_DEGRADADA') return 'CORRIDA_DEGRADADA';
  if (limpio === 'SITUACION_CRITICA' || limpio === 'CRITICA' || limpio === 'CRÍTICA' || limpio === 'EMERGENCIA') return 'SITUACION_CRITICA';
  if (limpio === 'SITUACION_GRAVE' || limpio === 'GRAVE' || limpio === 'ALERTA') return 'SITUACION_GRAVE';
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
    lluvia_manana_24h_mm: num(r.lluvia_manana_24h_mm),
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
    return 'DATOS REGIONALES: no disponibles en esta emisión.';
  }

  const lineas = datosRegionales.resumenes.map(r => {
    const fmt = (v) => v === null || v === undefined ? 's/d' : v;
    return `${r.zona_nombre} (nodo: ${r.nodo_referencia})
  AYER: Lluvia ${fmt(r.lluvia_ayer_24h_mm)} mm
  HOY: Lluvia ${fmt(r.lluvia_hoy_24h_mm)} mm | Temp ${fmt(r.temperatura_min_c)}/${fmt(r.temperatura_max_c)} °C | Viento máx ${fmt(r.viento_max_kmh)} km/h | Ráfaga máx ${fmt(r.rafaga_max_kmh)} km/h
  MAÑANA: Lluvia ${fmt(r.lluvia_manana_24h_mm)} mm
  Humedad ${fmt(r.humedad_min_pct)}%-${fmt(r.humedad_max_pct)}% | Visibilidad mín ${fmt(r.visibilidad_min_km)} km | Confiabilidad: ${r.confiabilidad_dominante}`;
  });

  const encabezado = `DATOS REGIONALES (${datosRegionales.zonas_ok}/${datosRegionales.zonas_totales} zonas disponibles, ventana 72h, consenso GFS + ICON + GEM):`;

  let bloque = encabezado + '\n\n' + lineas.join('\n\n');

  if (datosRegionales.zonas_fallidas.length > 0) {
    bloque += `\n\nZONAS SIN DATOS EN ESTA EMISIÓN: ${datosRegionales.zonas_fallidas.join(', ')}.`;
  }

  return bloque;
}

// ============================================================
// CONSTRUCCIÓN DE RESÚMENES REGIONALES (ventana 72h)
// ============================================================

/**
 * Construye los 14 resúmenes regionales con ventana de 72 horas.
 * Serie: 240h. Índices:
 *   0-143: días -7 a -2 (no se usan en el resumen, solo para API)
 *   144-167: AYER (24h)
 *   168-191: HOY (24h)
 *   192-215: MAÑANA (24h)
 *   216-239: pasado mañana (no se usa)
 */
function construirResumenesRegionales72h(seriesPorZona, nodos, zonasFallidas) {
  const resumenes = [];
  const zonasOk = [];

  Object.keys(nodos).forEach(zonaId => {
    const nodo = nodos[zonaId];
    const serie = seriesPorZona[zonaId] || [];

    if (zonasFallidas.includes(zonaId) || serie.length < 216) {
      return; // zona fallida o serie insuficiente
    }

    const ayer = serie.slice(144, 168);
    const hoy = serie.slice(168, 192);
    const manana = serie.slice(192, 216);

    const lluviaAyer = ayer.reduce((a, h) => a + (h.lluvia_mm || 0), 0);
    const lluviaHoy = hoy.reduce((a, h) => a + (h.lluvia_mm || 0), 0);
    const lluviaManana = manana.reduce((a, h) => a + (h.lluvia_mm || 0), 0);

    const tempsHoy = hoy.map(h => h.temperatura_c).filter(Number.isFinite);
    const vientosHoy = hoy.map(h => h.viento_kmh).filter(Number.isFinite);
    const rafagasHoy = hoy.map(h => h.rafagas_kmh).filter(Number.isFinite);
    const humedadesHoy = hoy.map(h => h.humedad_relativa_pct).filter(Number.isFinite);
    const visibilidadesHoy = hoy.map(h => h.visibility_km).filter(Number.isFinite);

    const actual = serie[168] || hoy[0] || {};

    const cuentaConfiabilidad = { ALTA: 0, MODERADA: 0, EN_DISPUTA: 0 };
    hoy.forEach(h => {
      if (h.confiabilidad && cuentaConfiabilidad[h.confiabilidad] !== undefined) {
        cuentaConfiabilidad[h.confiabilidad]++;
      }
    });
    const confiabilidadDominante = Object.entries(cuentaConfiabilidad)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'DESCONOCIDA';

    resumenes.push({
      zona_id: zonaId,
      zona_nombre: nodo.zona_nombre,
      nodo_referencia: `${nodo.localidad} (${nodo.municipio})`,
      poblacion: nodo.poblacion,
      lluvia_ayer_24h_mm: parseFloat(lluviaAyer.toFixed(1)),
      lluvia_hoy_24h_mm: parseFloat(lluviaHoy.toFixed(1)),
      lluvia_manana_24h_mm: parseFloat(lluviaManana.toFixed(1)),
      temperatura_min_c: tempsHoy.length ? parseFloat(Math.min(...tempsHoy).toFixed(1)) : null,
      temperatura_max_c: tempsHoy.length ? parseFloat(Math.max(...tempsHoy).toFixed(1)) : null,
      temperatura_actual_c: Number.isFinite(actual.temperatura_c) ? parseFloat(actual.temperatura_c.toFixed(1)) : null,
      viento_max_kmh: vientosHoy.length ? parseFloat(Math.max(...vientosHoy).toFixed(1)) : null,
      rafaga_max_kmh: rafagasHoy.length ? parseFloat(Math.max(...rafagasHoy).toFixed(1)) : null,
      humedad_min_pct: humedadesHoy.length ? Math.round(Math.min(...humedadesHoy)) : null,
      humedad_max_pct: humedadesHoy.length ? Math.round(Math.max(...humedadesHoy)) : null,
      visibilidad_min_km: visibilidadesHoy.length ? parseFloat(Math.min(...visibilidadesHoy).toFixed(1)) : null,
      confiabilidad_dominante: confiabilidadDominante
    });

    zonasOk.push(zonaId);
  });

  return {
    zonas_totales: Object.keys(nodos).length,
    zonas_ok: zonasOk.length,
    zonas_fallidas: zonasFallidas,
    resumenes
  };
}

// ============================================================
// CONSTRUCCIÓN DE PROMPTS
// ============================================================

function construirBloqueSMN(alertaSMN) {
  if (alertaSMN) {
    const estados = alertaSMN.estados_afectados?.length > 0
      ? alertaSMN.estados_afectados.join(', ')
      : 'Sin estados especificados';
    const rangoLluvia = (alertaSMN.rango_lluvia_min_mm !== null && alertaSMN.rango_lluvia_max_mm !== null)
      ? `${alertaSMN.rango_lluvia_min_mm} a ${alertaSMN.rango_lluvia_max_mm} mm`
      : 'rango no especificado';

    return `AVISO OFICIAL VIGENTE (CONAGUA/SMN) — Nivel ${alertaSMN.nivel || 'N/D'} (${alertaSMN.severidad || 'N/D'})
Título: ${alertaSMN.titulo}
Estados afectados: ${estados}
Rango de lluvia esperado: ${rangoLluvia}`;
  }
  return 'AVISO OFICIAL: Sin aviso extraordinario vigente para la región en este momento.';
}

function construirSystemPrompt() {
  return `Eres SARA (Sistema de Alerta y Respuesta Automatizada), Oficial Meteoróloga de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo (Hidalgo, Sierra Norte de Puebla y Veracruz).
Tu misión es redactar el "REPORTE OPERATIVO DIARIO DE SITUACIÓN METEOROLÓGICA" para brigadistas y coordinadores pastorales.
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
3. LA SECCIÓN I DEBE SER SÍNTESIS, NO CATÁLOGO. Menciona SOLO las 2-3 zonas con mayor actividad. Agrupa el resto en una sola frase ("las demás zonas permanecen en condiciones normales"). NO enumeres las 14 zonas. Al inicio de la sección I, destaca las 3 métricas más relevantes del día.
4. LA SECCIÓN II ES "ZONAS QUE REQUIEREN ATENCIÓN". Para las 3 zonas más críticas del día, incluye: (a) zona, (b) dato reportado, (c) qué hacer. Si hay N3/N4, esas van primero. Si NO hay N3/N4, usa las zonas con mayor número de localidades en N2.
5. LA SECCIÓN III ES EVOLUCIÓN, NO COMPARATIVA. Describe qué cambió respecto a AYER. ¿Qué zonas empeoraron? ¿Qué zonas mejoraron? ¿Qué se mantiene igual?
6. LA SECCIÓN IV ES "EVOLUCIÓN DEL CICLO METEOROLÓGICO (48 HORAS)". Debe estar dividida en 3 viñetas:
   - "Ayer:" Qué ocurrió en las últimas 24h.
   - "Hoy:" Estado actual.
   - "Mañana:" Qué se espera en las próximas 24h.
   La sección IV también debe incluir el aviso SMN vigente (o declarar "sin aviso extraordinario").
7. LA SECCIÓN V ES LISTA DE VERIFICACIÓN. Estructura las recomendaciones por MOMENTO, no por zona: (a) Antes de salir, (b) Durante la actividad, (c) Si empeora, (d) Para reanudar. Traduce datos a consecuencias.
8. LA SECCIÓN VI ES AVISO INSTITUCIONAL. Texto formal breve de subordinación a Protección Civil y CONAGUA.
9. TRADUCE NIVELES A DECISIONES OPERATIVAS. N1 = continuar con actividades normales; N2 = reforzar precauciones; N3 = restringir actividades específicas; N4 = suspender actividades expuestas.
10. CLASIFICACIÓN DE VIENTO: No describas como "fuertes" las ráfagas por debajo de 60 km/h. Ráfagas < 40 = suaves; 40-59 = moderadas; ≥ 60 = fuertes. Algunas zonas tienen viento estructuralmente más fuerte por altitud (Atotonilco a 2,700 msnm, Pachuca Norte a 2,400 msnm). Si sus ráfagas están por debajo de 60 km/h, descríbelas como "moderadas para esa zona".
11. ANTI-ALUCINACIÓN: usa EXCLUSIVAMENTE los datos del bloque "DATOS REGIONALES" y del "AVISO OFICIAL". PROHIBIDO mencionar sistemas sinópticos específicos si no están explícitos en los datos.
12. COHERENCIA INTER-SECCIONES. Verifica que ninguna sección contradiga a otra.
13. VOCABULARIO: usa "localidades" (no "municipios", no "comunidades") al referirte a los conteos del semáforo.
14. Si el bloque "DATOS REGIONALES" menciona ZONAS SIN DATOS, decláralo explícitamente en la sección I.
15. FORMATO CON VIÑETAS: usa viñetas en las secciones 0, II, III, IV y V.
16. Responde ÚNICAMENTE un objeto JSON con las 7 secciones exactas:

{
  "seccion_0_decision": "DECISIÓN OPERATIVA del día: fenómeno principal, zonas afectadas, acción inmediata. Máximo 3 líneas.",
  "seccion_I_atmosfera": "Síntesis de 2-3 zonas activas + agrupación del resto. Al inicio, 3 métricas destacadas del día.",
  "seccion_II_focos_sierra": "Zonas que requieren atención: (a) zona, (b) dato, (c) qué hacer. Solo las 3 más críticas.",
  "seccion_III_condiciones_altiplano": "Evolución respecto a ayer: qué empeoró, qué mejoró, qué se mantiene igual.",
  "seccion_IV_evolucion": "Evolución del ciclo meteorológico (48h): Ayer / Hoy / Mañana. Incluye aviso SMN.",
  "seccion_V_recomendaciones_pastorales": "Lista de verificación por momento: Antes / Durante / Si empeora / Para reanudar.",
  "seccion_VI_deslinde": "Texto formal breve de subordinación a Protección Civil y CONAGUA."
}`;
}

function construirUserPrompt({
  fechaDiaMexico,
  horaExactaMexico,
  bloqueSMN,
  bloqueRegional,
  semaforo,
  focosCriticos
}) {
  return `Fecha y hora de emisión: ${fechaDiaMexico} a las ${horaExactaMexico}.
Tipo de reporte: DIARIO AUTOMÁTICO (6:00 AM).
Origen: PROGRAMADO_REPORTE_DIARIO.

${bloqueSMN}

${bloqueRegional}

SEMÁFORO DIOCESANO ACTUAL (sobre 405 localidades):
- Nivel 4 (Emergencia): ${semaforo?.totalNivel4 ?? 0} localidades
- Nivel 3 (Alerta Temprana): ${semaforo?.totalNivel3 ?? 0} localidades
- Nivel 2 (Vigilancia): ${semaforo?.totalNivel2 ?? 0} localidades
- Nivel 1 (Estables): ${semaforo?.totalNivel1 ?? 0} localidades

COMUNIDADES CRÍTICAS BAJO TENSIÓN (N3-N4): ${JSON.stringify(focosCriticos || [])}.

Devuelve la respuesta en formato JSON estricto.`;
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * Genera el reporte diario automático.
 * 
 * @param {Object} opciones
 * @param {Object} opciones.seriesPorZona - Series de consenso por zona
 * @param {Object} opciones.nodos - Nodos regionales (uno por zona)
 * @param {Array} opciones.evaluaciones - Evaluaciones de las 405 localidades
 * @param {Object} opciones.semaforo - { totalNivel4, totalNivel3, totalNivel2, totalNivel1 }
 * @param {Object|null} opciones.alertaSMN - Aviso SMN o null
 * @param {string} opciones.fechaDiaMexico - "16 de octubre de 2026"
 * @param {string} opciones.horaExactaMexico - "06:00:15 a.m."
 * @param {string} opciones.horaMexicoStr - "06:00 a.m."
 * @param {string} opciones.apiKeyGroq - GROQ_API_KEY
 * @param {string} opciones.blobToken - BLOB_READ_WRITE_TOKEN
 * @returns {Promise<Object>} { exito, reporte_guardado, registro_bitacora, es_parcial }
 */
export async function generarReporteDiario({
  seriesPorZona,
  nodos,
  evaluaciones,
  semaforo,
  alertaSMN,
  fechaDiaMexico,
  horaExactaMexico,
  horaMexicoStr,
  apiKeyGroq,
  blobToken
}) {
  console.log('\n📋 [REPORTE DIARIO] Iniciando generación...');

  // 1. Detectar zonas fallidas
  const zonasFallidas = [];
  Object.keys(nodos).forEach(zonaId => {
    const serie = seriesPorZona[zonaId];
    if (!serie || serie.length < 216) {
      zonasFallidas.push(zonaId);
    }
  });

  console.log(`   Zonas OK: ${Object.keys(nodos).length - zonasFallidas.length}/${Object.keys(nodos).length}`);

  // 2. Construir resúmenes regionales (72h)
  const datosRegionales = construirResumenesRegionales72h(seriesPorZona, nodos, zonasFallidas);
  const esParcial = datosRegionales.zonas_ok < datosRegionales.zonas_totales;

  console.log(`   Reporte ${esParcial ? 'PARCIAL' : 'COMPLETO'}: ${datosRegionales.zonas_ok}/${datosRegionales.zonas_totales} zonas`);

  // 3. Construir focos críticos (top 7)
  const focosN3N4 = evaluaciones.filter(e => (e?.nivel_alerta ?? 1) >= 3);
  const focos = (focosN3N4.length > 0
    ? focosN3N4
    : evaluaciones
        .filter(e => e?.nivel_alerta === 2)
        .sort((a, b) => (b?.impactoSistemico?.poblacionDirecta ?? 0) - (a?.impactoSistemico?.poblacionDirecta ?? 0))
  ).slice(0, 7).map(c => ({
    nombre: c.nombre,
    municipio: c.municipio,
    nivel: c.nivel_alerta,
    causa: c.diagnostico?.titulo,
    pendiente: `${c.geografia?.pendienteMax}°`,
    acceso: c.impactoSistemico?.accesoVial
  }));

  // 4. Construir prompt
  const bloqueSMN = construirBloqueSMN(alertaSMN);
  const bloqueRegional = construirBloqueRegional(datosRegionales);
  const systemPrompt = construirSystemPrompt();
  const userPrompt = construirUserPrompt({
    fechaDiaMexico,
    horaExactaMexico,
    bloqueSMN,
    bloqueRegional,
    semaforo,
    focosCriticos: focos
  });

  // 5. Llamar a Groq
  console.log('   Llamando a Groq...');
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

  const dataGroq = await respuestaGroq.json();

  let reporteJSON;
  try {
    reporteJSON = JSON.parse(dataGroq.choices[0].message.content);
  } catch (parseError) {
    console.error("Groq devolvió JSON inválido:", dataGroq.choices[0].message.content.slice(0, 200));
    throw new Error("Groq devolvió formato inválido");
  }

  // 6. Parche N22 (mojibake)
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

  // 7. Construir objeto del reporte
  const ahora = new Date();
  const timestampIsoUtc = ahora.toISOString();

  const reporteCompleto = {
    id_reporte: `REP_DIARIO_${ahora.getTime()}`,
    origen: "PROGRAMADO_REPORTE_DIARIO",
    generado_por: null, // reporte automático, sin operador
    es_parcial: esParcial,
    fecha_dia_mexico: fechaDiaMexico,
    hora_exacta_mexico: horaExactaMexico,
    timestamp_iso_utc: timestampIsoUtc,
    consenso_modelos: "GFS (EE.UU.) • ICON (Alemania) • GEM (Canadá)",
    datos_regionales: datosRegionales,
    aviso_smn_considerado: alertaSMN ? {
      nivel: alertaSMN.nivel || null,
      titulo: alertaSMN.titulo,
      rango_lluvia_min_mm: alertaSMN.rango_lluvia_min_mm || null,
      rango_lluvia_max_mm: alertaSMN.rango_lluvia_max_mm || null
    } : null,
    resumen_severidad: semaforo,
    focos_criticos: focos,
    reporte: reporteJSON
  };

  // 8. Publicar en Blob
  console.log('   Publicando en Blob...');
  await put('reporte_diocesano_vigente.json', JSON.stringify(reporteCompleto, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken
  });

  // 9. Registrar en bitácora
  console.log('   Registrando en bitácora...');
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
    tipo: "PROGRAMADO_REPORTE_DIARIO",
    fecha: fechaDiaMexico,
    hora: horaExactaMexico,
    es_parcial: esParcial,
    zonas_ok: datosRegionales.zonas_ok,
    zonas_fallidas: datosRegionales.zonas_fallidas
  });

  const estadoCalculado = (semaforo?.totalNivel4 || 0) > 0
    ? "SITUACION_CRITICA"
    : ((semaforo?.totalNivel3 || 0) > 0 ? "SITUACION_GRAVE" : "SITUACION_NORMAL");

  const nuevoId = siguienteIdBitacora(bitacoraHistorial);

  const entradaBitacora = {
    id: `SARA_LOG_${nuevoId}`,
    fecha_dia_mexico: fechaDiaMexico,
    hora_exacta_mexico: horaExactaMexico,
    timestamp_iso_utc: timestampIsoUtc,
    timestamp_local: horaMexicoStr,
    origen_evento: "PROGRAMADO_REPORTE_DIARIO",
    generado_por: null,
    estado_situacion: normalizarEstadoSituacion(estadoCalculado),
    titulo: esParcial
      ? `Reporte Diario Automático (PARCIAL ${datosRegionales.zonas_ok}/${datosRegionales.zonas_totales})`
      : `Reporte Diario Automático Completo`,
    resumen: reporteJSON.seccion_0_decision || 'Reporte diario generado sin sección 0.',
    prev_hash: hashUltimo.slice(0, 16) + "...",
    hash: nuevoHash.slice(0, 16) + "...",
    hash_completo: nuevoHash
  };

  bitacoraHistorial.push(entradaBitacora);

  if (bitacoraHistorial.length > MAX_REGISTROS_BITACORA) {
    bitacoraHistorial = bitacoraHistorial.slice(-MAX_REGISTROS_BITACORA);
  }

  const payloadBitacora = { bitacora: bitacoraHistorial };
  if (ultimoDictamenPrevio) payloadBitacora.ultimo_dictamen = ultimoDictamenPrevio;

  await put('bitacora_sara.json', JSON.stringify(payloadBitacora), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken
  });

  console.log(`✅ [REPORTE DIARIO] Generado exitosamente. Parcial: ${esParcial}. Zonas: ${datosRegionales.zonas_ok}/${datosRegionales.zonas_totales}`);

  return {
    exito: true,
    reporte_guardado: reporteCompleto,
    registro_bitacora: entradaBitacora,
    es_parcial: esParcial
  };
}