/**
 * SatRC V2.0 — Motor de Evaluación de Riesgo: Gemelo del Runner
 *
 * ⚠️ ESTE ES UN GEMELO DEL RUNNER, NO DEL FRONTEND.
 * No unificar con `src/engine/riskEvaluator.js` todavía (V3.0).
 *
 * Extraído de `scripts/ejecutar_sara_autonomo.mjs` (líneas 528-676) en H4.
 * Resuelve H-MOTOR-01 (parcialmente): el runner deja de tener la copia inline.
 * La unificación total (runner + frontend con un solo archivo) va a V3.0.
 *
 * DIVERGENCIAS CONOCIDAS con `src/engine/riskEvaluator.js` (preservadas por diseño):
 *  1. `api7DiasPrevios`: runner retorna 0 si serie < 168h; frontend retorna 15.0.
 *  2. `eventoActual`: runner retorna [] si serie < 192h; frontend retorna serie.slice(0, 24).
 *  3. `calcularUmbralDeslave`: frontend lo calcula dinámicamente; runner NO lo calcula.
 *  4. Regla 4 (inundación fluvial): frontend y runner gradúan N3/N4 según `poblacionAguasArriba`.
 *     Alineado el 29/10/2026 (commit `e442efb`).
 *  5. `tiempos`: runner hardcodea `{ inicio: "En curso", picoMaximo: "Periodo activo" }`;
 *     frontend calcula `{ inicio, picoMaximo, crestaImpacto }` desde `horaPico`/`horaInicio`.
 *  6. Shape de retorno: runner expone `vector_dominante`, `sin_datos_regionales`,
 *     `impactoSistemico.tempMinimaC`; frontend expone `diagnostico.tipoAmenaza`,
 *     `geografia.posicionHidro`, `impactoSistemico.umbralFisicoDeslaveMm`.
 *  7. `zonaSinDatos`: el runner lo recibe como flag explícito (viene de `series[zonaId].ok === false`);
 *     NO es equivalente a `serieZona.length === 0`.
 *
 * REGLAS FÍSICAS: idénticas a `docs/03_MOTOR_RIESGO.md` (§2 las 6 reglas, §3 prioridad).
 * Ver `03_MOTOR_RIESGO.md` §3.2: Regla 4 sobreescribe el diagnóstico de Regla 2 cuando
 * ambas dan N4 (por el `>=` en la comparación de severidad). El runner preserva ese
 * comportamiento porque el runner inline actual ya lo tiene (validado en H7a.4).
 *
 * Este módulo es 100% PURO (sin imports de Node ni de `@vercel/blob`).
 * Lo testea `scripts/engine/__tests__/riskEvaluatorRunner.test.js` con Vitest.
 *
 * @module riskEvaluatorRunner
 * @see docs/03_MOTOR_RIESGO.md
 * @see docs/09_HALLAZGOS_ETAPA3.md (H-MOTOR-01)
 */

/**
 * Calcula el contexto de niebla (informativo, NO dispara nivel).
 * PEND-06 (29/10/2026): paridad con el motor canónico `riskEvaluator.js`.
 *
 * @param {Array} serieZona - Serie de consenso de la zona (192+ horas).
 * @returns {Object} { activa, visibilidadMinKm, persistenciaHoras, periodo, ventana }
 */
function calcularContextoNiebla(serieZona) {
  const vacio = {
    activa: false,
    visibilidadMinKm: null,
    persistenciaHoras: 0,
    periodo: null,
    ventana: { inicio: null, fin: null, duracionHoras: 0 }
  };

  if (!Array.isArray(serieZona) || serieZona.length < 192) {
    return vacio;
  }

  const ventana = serieZona.slice(168, 192);

  const horasNiebla = [];
  for (let i = 0; i < ventana.length; i++) {
    const h = ventana[i];
    if (h.visibility_km !== undefined && h.visibility_km !== null && h.visibility_km <= 2.0) {
      horasNiebla.push({ i, vis: h.visibility_km, horaAbsoluta: 168 + i });
    }
  }

  if (horasNiebla.length === 0) return vacio;

  const visMin = Math.min(...horasNiebla.map(x => x.vis));
  const horaInicio = horasNiebla[0].horaAbsoluta % 24;
  const horaFin = horasNiebla[horasNiebla.length - 1].horaAbsoluta % 24;

  let maxConsecutivas = 1;
  let actual = 1;
  for (let i = 1; i < horasNiebla.length; i++) {
    if (horasNiebla[i].i === horasNiebla[i - 1].i + 1) {
      actual++;
      if (actual > maxConsecutivas) maxConsecutivas = actual;
    } else {
      actual = 1;
    }
  }

  function clasificarPeriodo(hora) {
    if (hora < 6) return 'MADRUGADA';
    if (hora < 12) return 'MAÑANA';
    if (hora < 18) return 'TARDE';
    return 'NOCHE';
  }

  const periodoInicio = clasificarPeriodo(horaInicio);
  const periodoFin = clasificarPeriodo(horaFin);
  const periodo = periodoInicio === periodoFin ? periodoInicio : 'MIXTO';

  return {
    activa: true,
    visibilidadMinKm: parseFloat(visMin.toFixed(2)),
    persistenciaHoras: maxConsecutivas,
    periodo,
    ventana: {
      inicio: `${String(horaInicio).padStart(2, '0')}:00`,
      fin: `${String(horaFin).padStart(2, '0')}:00`,
      duracionHoras: maxConsecutivas
    }
  };
}


export function evaluarLocalidadRunner(localidad, serieZona, contexto = {}) {
  const { alertaSMN = null, zonaSinDatos = false } = contexto;
  const zonaId = localidad.zona_id;

  const esAltiplano = ['ACT', 'APN', 'PMN', 'PMS', 'TIZ'].includes(zonaId);
  const esSierra = ['ATG', 'CHG', 'HUA', 'HYC', 'SPP', 'TUL', 'XIC', 'ZAC', 'ZAH'].includes(zonaId);

  // Cálculos previos sobre la serie consenso de la zona
  let api7DiasPrevios = 0;
  if (serieZona.length >= 168) {
    for (let d = 1; d <= 7; d++) {
      const idxInicio = (d - 1) * 24;
      const idxFin = d * 24;
      const lluviaDia = serieZona.slice(idxInicio, idxFin).reduce((acc, h) => acc + h.lluvia_mm, 0);
      api7DiasPrevios += lluviaDia * Math.pow(0.85, 8 - d);
    }
  }
  api7DiasPrevios = parseFloat(api7DiasPrevios.toFixed(1));

  const eventoActual = serieZona.length >= 192 ? serieZona.slice(168, 192) : [];
  const lluviaEventoHoy = parseFloat(eventoActual.reduce((acc, h) => acc + h.lluvia_mm, 0).toFixed(1));
  const tempMinHoy = eventoActual.length ? Math.min(...eventoActual.map(h => h.temperatura_c), 20) : 20;
  const vientoMaxHoy = eventoActual.length ? Math.max(...eventoActual.map(h => h.viento_kmh), 10) : 10;
  const rafagaMaxHoy = eventoActual.length ? Math.max(...eventoActual.map(h => h.rafagas_kmh), 15) : 15;
  const visMinHoy = eventoActual.length ? Math.min(...eventoActual.map(h => h.visibility_km)) : 999;

  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';
  const esLadera = relieve === 'LADERA' || pendiente >= 25;
  const distRio = localidad.hidrologia.distancia_cauce_km || 99;
  const twi = localidad.topografia.twi || 0;
  const esTerraceria = localidad.vulnerabilidad.acceso_vial === 'CAMINO_TERRACERIA' || localidad.vulnerabilidad.acceso_vial === 'BRECHA';

  // H-MOTOR-06 — Solo aplicar el piso del aviso SMN si la localidad está en un estado afectado.
  // El parser SMN detecta 3 estados (HGO, PUE, VER). Antes se aplicaba el piso a TODAS las zonas de Sierra, sobre-alertando.
  const estadoAfectado = !!(alertaSMN?.estados_afectados?.some(e =>
    (e === 'HGO' && localidad.estado?.toLowerCase().includes('hidalgo')) ||
    (e === 'PUE' && localidad.estado?.toLowerCase().includes('puebla')) ||
    (e === 'VER' && localidad.estado?.toLowerCase().includes('veracruz'))
  ));
  const lluviaEfectiva24h = (esSierra && alertaSMN && estadoAfectado)
    ? Math.max(lluviaEventoHoy, alertaSMN.rango_lluvia_min_mm || 0)
    : lluviaEventoHoy;
  const saturacionSuelo = parseFloat((api7DiasPrevios + lluviaEfectiva24h).toFixed(1));

  let nivel = 1;
  let vectorDominante = zonaSinDatos ? "SIN_DATOS_REGIONALES" : "ATMOSFERA_ESTABLE";
  let tituloDiagnostico = zonaSinDatos ? "Sin datos meteorológicos regionales" : "Condiciones de Estabilidad y Calma";
  let causa = zonaSinDatos
    ? `La zona ${zonaId} no reportó datos meteorológicos en esta corrida.`
    : "Sin perturbaciones climáticas significativas previstas.";

  if (!zonaSinDatos) {
    if (esAltiplano && pendiente < 15 && lluviaEventoHoy < 20.0 && tempMinHoy > 2.0 && vientoMaxHoy < 40) {
      nivel = 1;
      vectorDominante = "ATMOSFERA_ESTABLE";
      tituloDiagnostico = "Condiciones de Estabilidad y Calma";
      causa = `Zona del Altiplano bajo sombra orográfica. Lluvia de ${lluviaEventoHoy} mm sin riesgo geofísico.`;
    } else {
      if (esSierra && esLadera && saturacionSuelo >= 65.0) {
        if (pendiente >= 45.0) {
          nivel = 4;
          vectorDominante = "DESLAVE_CRITICO";
          tituloDiagnostico = "Peligro Crítico de Deslave en Ladera Escarpada";
          causa = `Suelo saturado (${saturacionSuelo} mm) sobre talud crítico de ${pendiente}°. Falla inminente.`;
        } else {
          nivel = Math.max(nivel, 3);
          vectorDominante = "DESLAVE_MODERADO";
          tituloDiagnostico = "Saturación Crítica de Terreno";
          causa = `Reblandecimiento de estratos en ladera de ${pendiente}° con desprendimientos menores.`;
        }
      }

      if (distRio <= 0.8 && twi >= 12.0 && lluviaEfectiva24h >= 35.0 && !esAltiplano) {
        const poblacionAguasArriba = localidad.hidrologia.poblacion_aguas_arriba || 0;
        const severidadFluvial = (lluviaEfectiva24h >= 65.0 || poblacionAguasArriba >= 50000) ? 4 : 3;
        if (severidadFluvial >= nivel) {
          nivel = severidadFluvial;
          vectorDominante = "INUNDACION_FLUVIAL";
          tituloDiagnostico = "Desbordamiento e Inundación Ribereña";
          causa = `Comunidad ribereña a ${distRio} km del cauce en punto de convergencia de flujo.`;
        }
      }

      if (esTerraceria && (lluviaEfectiva24h >= 20.0 || saturacionSuelo >= 50.0) && nivel < 3) {
        nivel = 3;
        vectorDominante = "CORTE_VIAL";
        tituloDiagnostico = "Amenaza de Incomunicación y Corte de Acceso";
        causa = `Vía única de terracería/brecha vulnerable a corte total por lodo.`;
      }

      // PEND-06 (29/10/2026): la niebla NO dispara nivel. Queda como contexto.
      // Paridad con el motor canónico `riskEvaluator.js`.
      if (nivel === 1 && (lluviaEfectiva24h >= 8.0 || saturacionSuelo >= 30.0)) {
        nivel = 2;
        vectorDominante = "VIGILANCIA_NORMAL";

        // N20: identificar el disparador real de la vigilancia
        if (lluviaEfectiva24h >= 8.0) {
          tituloDiagnostico = "Vigilancia por Precipitación Activa";
          causa = `Precipitación activa en las últimas 24h (${lluviaEfectiva24h} mm). Suelo húmedo en valles y lomas de transición.`;
        } else {
          tituloDiagnostico = "Vigilancia por Suelo Saturado";
          causa = `Suelo con humedad acumulada (${saturacionSuelo} mm de saturación). Sin lluvia activa, pero terreno sensible a nuevos eventos.`;
        }
      }
    }
  }

  return {
    localidad_id: localidad.id,
    nombre: localidad.nombre,
    municipio: localidad.municipio,
    estado: localidad.estado,
    zona_id: zonaId,
    zona_nombre: localidad.zona_nombre,
    nivel_alerta: nivel,
    color_alerta: ['#10B981', '#F59E0B', '#F97316', '#EF4444'][nivel - 1],
    estado_alerta: ['NORMAL', 'VIGILANCIA', 'ALERTA_TEMPRANA', 'EMERGENCIA'][nivel - 1],
    vector_dominante: vectorDominante,
    sin_datos_regionales: zonaSinDatos,
    diagnostico: { titulo: tituloDiagnostico, causa: causa },
    donde: {
      subcuenca_cve: localidad.hidrologia.subcuenca_cve,
      subcuenca_nom: localidad.hidrologia.subcuenca_nom,
      posicion_hidrologica: localidad.hidrologia.posicion,
      tipo_relieve: relieve,
      pendiente_max_grados: pendiente,
      distancia_cauce_km: distRio,
      coordenadas: localidad.coords
    },
    geografia: { relieve, pendienteMax: pendiente, distanciaRioKm: distRio, twi, cuenca: localidad.hidrologia.subcuenca_nom, coordenadas: localidad.coords },
    tiempos: { inicio: "En curso", picoMaximo: "Periodo activo", ventanaAccionHoras: localidad.hidrologia.tc_horas || 6 },
    impactoSistemico: {
      poblacionDirecta: localidad.vulnerabilidad.poblacion,
      accesoVial: localidad.vulnerabilidad.acceso_vial,
      distanciaHospitalKm: localidad.vulnerabilidad.dist_hospital_km,
      marginacion: localidad.vulnerabilidad.marginacion,
      apiPrevio7DiasMm: api7DiasPrevios,
      saturacionTotalSueloMm: saturacionSuelo,
      lluviaEvento24hMm: parseFloat(lluviaEfectiva24h.toFixed(1)),
      tempMinimaC: tempMinHoy,
      rafagaMaximaKmh: rafagaMaxHoy,
      visibilidadMinKm: visMinHoy
    },
    protocolo: "Consulte al coordinador de Cáritas",
    contexto: {
      niebla: calcularContextoNiebla(serieZona)
    }
  };
}