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
 * ALMACENAMIENTO (H-REPORTE-02, fix del 29/10/2026):
 * - Escribe en Google Drive vía `escribirJSONBlob` de `src/lib/compartido/googleDrive.js`.
 * - Lee bitácora vía `leerJSONBlob` si `bitacoraBase` no se pasa (fallback).
 * - Ya NO usa @vercel/blob.
 * 
 * ⚠️ DEUDA TÉCNICA RESIDUAL:
 * - normalizarDatosRegionales y construirBloqueRegional: todavía duplicadas
 *   en este archivo y en api/reporte-ondemand.js. Extraer en H6.5.
 * 
 * @module reporteDiario
 */

import { leerJSONBlob, escribirJSONBlob } from '../../src/lib/compartido/googleDrive.js';
import { repararMojibake } from '../../src/lib/compartido/mojibake.js';
import { construirBloqueRegional } from '../../src/lib/compartido/regionales.js';
import { REGLAS_MULTIVECTOR, REGLAS_CONTEXTO_NIEBLA } from '../../src/lib/compartido/promptsMultivector.js';
import { calcularNuevaEntradaBitacora } from '../../src/lib/compartido/bitacora.js';

const TIMEOUT_GROQ_MS = 45000; // 45s (el reporte es más largo que el on-demand)

// ============================================================
// HELPERS
// ============================================================

function normalizarEstadoSituacion(estadoRaw) {
  if (!estadoRaw || typeof estadoRaw !== 'string') return 'SITUACION_NORMAL';
  const limpio = estadoRaw.trim().toUpperCase();
  if (limpio === 'CORRIDA_DEGRADADA') return 'CORRIDA_DEGRADADA';
  if (limpio === 'SITUACION_CRITICA' || limpio === 'CRITICA' || limpio === 'CRÍTICA' || limpio === 'EMERGENCIA') return 'SITUACION_CRITICA';
  if (limpio === 'SITUACION_GRAVE' || limpio === 'GRAVE' || limpio === 'ALERTA') return 'SITUACION_GRAVE';
  return 'SITUACION_NORMAL';
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
12.bis. COHERENCIA SECCIÓN 0 ↔ SECCIÓN II (crítico). Las zonas mencionadas en la sección 0 (Decisión Operativa) deben ser EXACTAMENTE las mismas que las listadas en la sección II (Zonas que Requieren Atención). No puede haber divergencia entre ambas secciones. Si la sección 0 menciona 3 zonas, la sección II debe listar esas 3 zonas (ni más ni menos).
13. VOCABULARIO: usa "localidades" (no "municipios", no "comunidades") al referirte a los conteos del semáforo.
14. Si el bloque "DATOS REGIONALES" menciona ZONAS SIN DATOS, decláralo explícitamente en la sección I.
15. FORMATO CON VIÑETAS: usa viñetas en las secciones 0, II, III, IV y V.
${REGLAS_MULTIVECTOR}
17. CONTROL ESTRICTO DE EMERGENCIAS: Si Nivel 4 = 0 y Nivel 3 = 0, BAJO NINGUNA CIRCUNSTANCIA uses "suspender actividades", "evacuar" o "emergencia". Usa lenguaje de precaución y vigilancia.
${REGLAS_CONTEXTO_NIEBLA}
18. Responde ÚNICAMENTE un objeto JSON con las 7 secciones exactas:

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

CONTEXTO DE NIEBLA (informativo, no dispara alerta): ${JSON.stringify(
  (focosCriticos || []).map(f => ({
    localidad: f.nombre,
    municipio: f.municipio,
    niebla: f.contexto?.niebla || null
  })).filter(x => x.niebla?.activa === true)
)}.

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
 * @param {string} opciones.blobToken - DEPRECATED: ya no se usa. Se mantiene por compatibilidad con el runner. Eliminar en H-DRIVE-01. 
 * @param {Array|null} opciones.bitacoraBase - Bitácora actual en memoria (para evitar colisiones)
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
  blobToken,
  bitacoraBase = null
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
    acceso: c.impactoSistemico?.accesoVial,
    // H5.4 — Inyección multivectorial para SARA
    vector_dominante: c.vector_dominante,
    tipo_amenaza: c.tipo_amenaza,
    niveles_por_vector: c.niveles_por_vector,
    diagnosticos_por_vector: c.diagnosticos_por_vector,
    acciones_operativas: c.acciones_operativas,
    acoplamiento: c.diagnostico?.acoplamiento
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

  // 5. Llamar a Groq (con retry para 429 y límite de tokens ajustado)
  console.log('   Llamando a Groq...');
  const MAX_REINTENTOS_DIARIO = 1;
  const DELAY_REINTENTO_MS = 30000; // 30 segundos
  let respuestaGroq = null;
  let ultimoErrorDiario = null;

  for (let intento = 1; intento <= MAX_REINTENTOS_DIARIO + 1; intento++) {
    try {
      respuestaGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_GROQ_MS),
        headers: {
          "Authorization": `Bearer ${apiKeyGroq.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          max_completion_tokens: 3000, // N-REPORTE-06: Reducido de 4096 a 3000 para evitar 413
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (respuestaGroq.status === 429) {
        if (intento <= MAX_REINTENTOS_DIARIO) {
          console.warn(`   [N28] Groq 429 (intento ${intento}/${MAX_REINTENTOS_DIARIO + 1}). Reintentando en ${DELAY_REINTENTO_MS / 1000}s...`);
          await new Promise(r => setTimeout(r, DELAY_REINTENTO_MS));
          continue;
        }
        throw new Error(`Groq API HTTP 429 (agotados ${MAX_REINTENTOS_DIARIO} reintentos)`);
      }

      if (!respuestaGroq.ok) {
        throw new Error(`Groq API HTTP ${respuestaGroq.status}`);
      }

      break; // Éxito, salir del bucle
    } catch (e) {
      ultimoErrorDiario = e;
      if (intento > MAX_REINTENTOS_DIARIO || respuestaGroq?.status !== 429) {
        throw e;
      }
    }
  }

  if (!respuestaGroq || !respuestaGroq.ok) {
    throw ultimoErrorDiario || new Error("Fallo desconocido en Groq");
  }

  const dataGroq = await respuestaGroq.json();

  let reporteJSON;
  try {
    reporteJSON = JSON.parse(dataGroq.choices[0].message.content);
  } catch (parseError) {
    console.error("Groq devolvió JSON inválido:", dataGroq.choices[0].message.content.slice(0, 200));
    throw new Error("Groq devolvió formato inválido");
  }

  // FIX N-PROMPT-JSON-01 (29/10/2026): Groq a veces devuelve las claves en español
  const mapeoClaves = {
    'Sección 0': 'seccion_0_decision', 'Seccion 0': 'seccion_0_decision',
    'Sección I': 'seccion_I_atmosfera', 'Seccion I': 'seccion_I_atmosfera',
    'Sección II': 'seccion_II_focos_sierra', 'Seccion II': 'seccion_II_focos_sierra',
    'Sección III': 'seccion_III_condiciones_altiplano', 'Seccion III': 'seccion_III_condiciones_altiplano',
    'Sección IV': 'seccion_IV_evolucion', 'Seccion IV': 'seccion_IV_evolucion',
    'Sección V': 'seccion_V_recomendaciones_pastorales', 'Seccion V': 'seccion_V_recomendaciones_pastorales',
    'Sección VI': 'seccion_VI_deslinde', 'Seccion VI': 'seccion_VI_deslinde'
  };
  for (const [claveOriginal, claveEstandar] of Object.entries(mapeoClaves)) {
    if (reporteJSON[claveOriginal] !== undefined && reporteJSON[claveEstandar] === undefined) {
      reporteJSON[claveEstandar] = reporteJSON[claveOriginal];
      delete reporteJSON[claveOriginal];
    }
  }

  // 6. Parche N22 (mojibake)
  const secciones = [
    'seccion_0_decision', 'seccion_I_atmosfera', 'seccion_II_focos_sierra',
    'seccion_III_condiciones_altiplano', 'seccion_IV_evolucion',
    'seccion_V_recomendaciones_pastorales', 'seccion_VI_deslinde'
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

  // 8. Publicar en Google Drive (H-REPORTE-02 fix del 29/10/2026, H-REPORTE-01: solo si NO es parcial)
  if (!esParcial) {
    console.log('   Publicando en Google Drive...');
    await escribirJSONBlob('reporte_diocesano_vigente.json', JSON.stringify(reporteCompleto, null, 2));
  } else {
    console.log('   Reporte PARCIAL: NO se publica en Drive (protege el vigente).');
  }

  // 9. Preparar registro en bitácora (H-BITACORA-01: devolver, no escribir)
  // H-REPORTE-02 (29/10/2026): el fallback de lectura se migra a leerJSONBlob de googleDrive.js.
  // En producción, el runner siempre pasa bitacoraBase, así que este fallback no se ejecuta.
  // Se conserva por robustez: si algún día se invoca sin bitacoraBase, lee la bitácora de Drive.
  console.log('   Preparando registro de bitácora...');
  let bitacoraHistorial = [];

  if (bitacoraBase) {
    bitacoraHistorial = [...bitacoraBase];
  } else {
    try {
      const dB = await leerJSONBlob('bitacora_sara.json');
      if (dB) {
        bitacoraHistorial = dB.bitacora || [];
      }
    } catch (e) {}
  }

  const estadoCalculado = (semaforo?.totalNivel4 || 0) > 0
    ? "SITUACION_CRITICA"
    : ((semaforo?.totalNivel3 || 0) > 0 ? "SITUACION_GRAVE" : "SITUACION_NORMAL");

  const datosHash = {
    tipo: "PROGRAMADO_REPORTE_DIARIO",
    fecha: fechaDiaMexico,
    hora: horaExactaMexico,
    es_parcial: esParcial,
    zonas_ok: datosRegionales.zonas_ok,
    zonas_fallidas: datosRegionales.zonas_fallidas
  };

  const hashEntry = calcularNuevaEntradaBitacora(bitacoraHistorial, timestampIsoUtc, datosHash);

  const entradaBitacora = {
    id: hashEntry.id,
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
    prev_hash: hashEntry.prev_hash,
    hash: hashEntry.hash,
    hash_completo: hashEntry.hash_completo
  };

  console.log(`✅ [REPORTE DIARIO] Generado exitosamente. Parcial: ${esParcial}. Zonas: ${datosRegionales.zonas_ok}/${datosRegionales.zonas_totales}`);

  return {
    exito: true,
    reporte_guardado: reporteCompleto,
    registro_bitacora: entradaBitacora,
    es_parcial: esParcial
  };
}