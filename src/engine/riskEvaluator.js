/**
 * SatRC V2.0 - Core Engine: Sistema Experto de Interpretación y Asesoría Geofísica (SEIAG)
 * Umbral de Emergencia en Ladera calibrado en >= 45° (paridad tangencial de talud),
 * graduación de Nivel 2 (Amarillos en valles de transición) y memoria hídrica disjunta.
 */

function calcularUmbralDeslave(localidad) {
  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';

  let factorRelieve = 0;
  if (relieve === 'LADERA') factorRelieve = 15;
  else if (relieve === 'LOMA') factorRelieve = 8;

  const umbral = 65 - (pendiente * 0.85) - factorRelieve;
  return Math.max(12, parseFloat(umbral.toFixed(1)));
}

function calcularAPI7DiasPrevios(serieHoraria) {
  if (!serieHoraria || serieHoraria.length < 168) return 15.0;

  const horasPrevias = serieHoraria.slice(0, 168);
  let api = 0;

  for (let d = 1; d <= 7; d++) {
    const inicioDia = (d - 1) * 24;
    const finDia = d * 24;
    const lluviaDiaria = horasPrevias.slice(inicioDia, finDia).reduce((acc, h) => acc + (h.lluvia_mm || 0), 0);
    const pesoDecaimiento = Math.pow(0.85, 8 - d);
    api += (lluviaDiaria * pesoDecaimiento);
  }

  return parseFloat(api.toFixed(1));
}

/**
 * Calcula el contexto de niebla (informativo, NO dispara nivel).
 * Desde PEND-06 (29/10/2026): bajo DEC-011, la niebla es información contextual
 * que SARA expone en el reporte, no un disparador de alerta.
 *
 * @param {Array} serieHoraria - Serie completa de consenso (192+ horas).
 * @returns {Object} { activa, visibilidadMinKm, persistenciaHoras, periodo, ventana }
 *   - periodo: 'MADRUGADA' (00-05) | 'MAÑANA' (06-11) | 'TARDE' (12-17) | 'NOCHE' (18-23) | 'MIXTO' | null
 *   - ventana: { inicio: 'HH:00', fin: 'HH:00', duracionHoras: number }
 */
function calcularContextoNiebla(serieHoraria) {
  const vacio = {
    activa: false,
    visibilidadMinKm: null,
    persistenciaHoras: 0,
    periodo: null,
    ventana: { inicio: null, fin: null, duracionHoras: 0 }
  };

  if (!Array.isArray(serieHoraria) || serieHoraria.length < 192) {
    return vacio;
  }

  // Ventana de 24 h: índices 168-191 (próximas 24 h desde "ahora")
  const ventana = serieHoraria.slice(168, 192);

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

  // Persistencia: contar horas consecutivas máximas
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

export function evaluarLocalidad(localidad, serieHoraria, contexto = {}) {
  const umbralDeslave = calcularUmbralDeslave(localidad);
  const apiPrevio = calcularAPI7DiasPrevios(serieHoraria);
  const eventoActual = (serieHoraria && serieHoraria.length > 168) 
    ? serieHoraria.slice(168, 192) 
    : (serieHoraria?.slice(0, 24) || []);

  let lluviaEventoActual24h = 0;
  let lluviaMaxHoraria = 0;
  let horaPico = null;
  let horaInicio = null;
  let tempMinima = 99;
  let vientoSostenidoMax = 0;
  let rafagaMaxima = 0;
  let visibilidadMinKm = 999;

  eventoActual.forEach(h => {
    const ll = h.lluvia_mm || 0;
    lluviaEventoActual24h += ll;
    if (ll > lluviaMaxHoraria) {
      lluviaMaxHoraria = ll;
      horaPico = h.fecha_hora;
    }
    if (ll >= 1.0 && !horaInicio) {
      horaInicio = h.fecha_hora;
    }
    if (h.temperatura_c !== undefined && h.temperatura_c < tempMinima) {
      tempMinima = h.temperatura_c;
    }
    if (h.viento_kmh && h.viento_kmh > vientoSostenidoMax) {
      vientoSostenidoMax = h.viento_kmh;
    }
    if (h.rafagas_kmh && h.rafagas_kmh > rafagaMaxima) {
      rafagaMaxima = h.rafagas_kmh;
    }
    if (h.visibility_km !== undefined) {
      if (h.visibility_km < visibilidadMinKm) visibilidadMinKm = h.visibility_km;
    }
  });

  // Delimitación Geográfica Diocesana
  const esZonaAltiplanoPlano = ['ACT', 'APN', 'PMN', 'PMS', 'TIZ'].includes(localidad.zona_id);
  const esZonaSierraExpuesta = ['ATG', 'CHG', 'HUA', 'HYC', 'SPP', 'TUL', 'XIC', 'ZAC', 'ZAH'].includes(localidad.zona_id);

  // Aviso Federal del Frente Frío (75 a 150 mm) aplica a zonas de Sierra
  const alertaSMN = contexto.alertaSMN;
  const bajoAvisoFederalSierra = alertaSMN && esZonaSierraExpuesta && (
    (localidad.estado.toLowerCase().includes('puebla') && alertaSMN.estados_afectados?.includes('PUE')) ||
    (localidad.estado.toLowerCase().includes('hidalgo') && alertaSMN.estados_afectados?.includes('HGO')) ||
    (localidad.estado.toLowerCase().includes('veracruz') && alertaSMN.estados_afectados?.includes('VER'))
  );

  const lluviaEfectiva24h = bajoAvisoFederalSierra
    ? Math.max(lluviaEventoActual24h, alertaSMN.rango_lluvia_min_mm || 0)
    : lluviaEventoActual24h;

  const saturacionTotalSuelo = parseFloat((apiPrevio + lluviaEfectiva24h).toFixed(1));

  // Parámetros Físicos del Terreno
  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';
  const esLadera = relieve === 'LADERA' || pendiente >= 25;
  const distRio = localidad.hidrologia.distancia_cauce_km || 99;
  const twi = localidad.topografia.twi || 0;
  const posHidro = localidad.hidrologia.posicion || 'BAJA';
  const poblacionAguasArriba = localidad.hidrologia.poblacion_aguas_arriba || 0;
  const accesoVial = localidad.vulnerabilidad.acceso_vial || 'CARRETERA_ESTATAL';
  const esTerraceriaOBrecha = accesoVial === 'CAMINO_TERRACERIA' || accesoVial === 'BRECHA';
  const esMarginacionAlta = localidad.vulnerabilidad.marginacion === 'ALTO' || localidad.vulnerabilidad.marginacion === 'MUY ALTO';
  const distHospital = localidad.vulnerabilidad.dist_hospital_km || 0;
  const altitud = localidad.topografia.altitud_msnm || 0;

  let nivelAlerta = 1;
  let diagnostico = {
    titulo: "Condiciones de Estabilidad Atmosférica y Geofísica",
    causa: "Suelo con drenaje normal y sin perturbaciones severas previstas.",
    tipoAmenaza: "ESTABLE"
  };

  // 1. REGLA DE PROTECCIÓN AL ALTIPLANO SECO (PLANICIES < 15° Y LLUVIA < 20 MM) ──► NIVEL 1 VERDE
  if (esZonaAltiplanoPlano && pendiente < 15 && lluviaEventoActual24h < 20.0 && tempMinima > 2.0 && vientoSostenidoMax < 40) {
    nivelAlerta = 1;
    diagnostico = {
      titulo: "Condiciones de Estabilidad y Calma",
      causa: `Zona de Altiplano protegida por sombra orográfica. Lluvia real de ${lluviaEventoActual24h.toFixed(1)} mm sin amenaza geofísica.`,
      tipoAmenaza: "ESTABLE"
    };
  } else {
    // 2. DISCRIMINACIÓN DE SIERRA Y VALLES DE TRANSICIÓN

    // --- UMBRAL CALIBRADO DE LADERA CRÍTICA EN >= 45° (JUSTIFICADO EN RUPTURA GEOMECÁNICA) ---
    if (esLadera && saturacionTotalSuelo >= 65.0) {
      if (pendiente >= 45.0) {
        // Nivel 4 Emergencia reservado para desfiladeros >= 45°
        nivelAlerta = 4;
        diagnostico = {
          titulo: "Peligro Crítico de Deslave en Ladera Escarpada",
          causa: `Suelo saturado al límite geomecánico (${saturacionTotalSuelo} mm acumulados) sobre talud crítico de ${pendiente}°. Falla inminente por pérdida total de cohesión.`,
          tipoAmenaza: "DESLAVE_CRITICO"
        };
      } else {
        // Laderas habitables de 25° a 44° se mantienen en Nivel 3 Alerta Temprana
        nivelAlerta = Math.max(nivelAlerta, 3);
        diagnostico = {
          titulo: "Saturación Crítica de Terreno en Pendiente",
          causa: `Acumulado hídrico de ${saturacionTotalSuelo} mm en ladera habitable de ${pendiente}°. Reblandecimiento de talud y desprendimientos menores.`,
          tipoAmenaza: "DESLAVE_MODERADO"
        };
      }
    }

    // Desbordamiento fluvial ribereño en cañadas
    const riesgoFluvialReal = (distRio <= 0.8) && (twi >= 12.0) && (lluviaEfectiva24h >= 35.0) && !esZonaAltiplanoPlano;
    if (riesgoFluvialReal) {
      const severidadFluvial = (lluviaEfectiva24h >= 65.0 || poblacionAguasArriba >= 50000) ? 4 : 3;
      if (severidadFluvial >= nivelAlerta) {
        nivelAlerta = severidadFluvial;
        diagnostico = {
          titulo: "Riesgo de Desbordamiento e Inundación Ribereña",
          causa: `Comunidad en ribera encajonada (${distRio} km del cauce) con crecida en tránsito de ${poblacionAguasArriba.toLocaleString()} hab. aguas arriba.`,
          tipoAmenaza: "INUNDACION_FLUVIAL"
        };
      }
    }

    // Aislamiento vial por terracería en temporal
    const riesgoCorteVial = esTerraceriaOBrecha && (lluviaEfectiva24h >= 20.0 || saturacionTotalSuelo >= 50.0);
    if (riesgoCorteVial && nivelAlerta < 3) {
      nivelAlerta = 3;
      diagnostico = {
        titulo: "Amenaza de Incomunicación y Corte de Acceso",
        causa: `Vía única de terracería/brecha vulnerable a corte total por lodo. Hospital a ${distHospital} km sin paso vehicular garantizado.`,
        tipoAmenaza: "CORTE_VIAL"
      };
    }

    // --- REGLA DE VIGILANCIA PREVENTIVA EN VALLES DE TRANSICIÓN ──► NIVEL 2 AMARILLO ---
    // PEND-06 (29/10/2026): la niebla YA NO dispara nivel.
    // Bajo DEC-011 (precisión sobre cobertura), la niebla es información contextual
    // que SARA expone en el reporte, no un disparador de alerta. Se calcula en
    // contexto.niebla al final de esta función.
    // Disparadores vigentes de N2: lluvia efectiva >= 8 mm, o saturación >= 30 mm.
    if (nivelAlerta === 1 && (lluviaEfectiva24h >= 8.0 || saturacionTotalSuelo >= 30.0)) {
      nivelAlerta = 2; // AMARILLO VIGILANCIA

      // N20: identificar el disparador real de la vigilancia
      let tituloN2, causaN2;
      if (lluviaEfectiva24h >= 8.0) {
        tituloN2 = "Vigilancia por Precipitación Activa";
        causaN2 = `Precipitación activa en las últimas 24h (${lluviaEfectiva24h.toFixed(1)} mm). Suelo húmedo en valles y lomas de transición.`;
      } else {
        tituloN2 = "Vigilancia por Suelo Saturado";
        causaN2 = `Suelo con humedad acumulada (${saturacionTotalSuelo} mm de saturación). Sin lluvia activa, pero terreno sensible a nuevos eventos.`;
      }

      diagnostico = {
        titulo: tituloN2,
        causa: causaN2,
        tipoAmenaza: "VIGILANCIA_NORMAL"
      };
    }
  }

  const tc = localidad.hidrologia.tc_horas || 6.0;
  const horaImpactoCresta = horaPico 
    ? new Date(new Date(horaPico).getTime() + (tc * 3600000)).toISOString() 
    : null;

  return {
    localidad_id: localidad.id,
    nombre: localidad.nombre,
    municipio: localidad.municipio,
    estado: localidad.estado,
    zona_id: localidad.zona_id,
    zona_nombre: localidad.zona_nombre,
    nivel_alerta: nivelAlerta,
    color_alerta: ['#10B981', '#F59E0B', '#F97316', '#EF4444'][nivelAlerta - 1],
    estado_alerta: ['NORMAL', 'VIGILANCIA', 'ALERTA_TEMPRANA', 'EMERGENCIA'][nivelAlerta - 1],
    diagnostico: diagnostico,
    donde: {
      subcuenca_cve: localidad.hidrologia.subcuenca_cve,
      subcuenca_nom: localidad.hidrologia.subcuenca_nom,
      posicion_hidrologica: posHidro,
      tipo_relieve: relieve,
      pendiente_max_grados: pendiente,
      distancia_cauce_km: distRio,
      coordenadas: localidad.coords
    },
    tiempos: {
      inicio: horaInicio ? horaInicio.split('T')[1] + ' hrs' : 'En curso',
      picoMaximo: horaPico ? horaPico.split('T')[1] + ' hrs' : 'Periodo activo',
      crestaImpacto: horaImpactoCresta ? horaImpactoCresta.split('T')[1] + ' hrs' : 'No prevista',
      ventanaAccionHoras: tc
    },
    geografia: {
      relieve: relieve,
      pendienteMax: pendiente,
      distanciaRioKm: distRio,
      twi: twi,
      posicionHidro: posHidro,
      coordenadas: localidad.coords,
      cuenca: localidad.hidrologia.subcuenca_nom
    },
    impactoSistemico: {
      poblacionDirecta: localidad.vulnerabilidad.poblacion,
      poblacionAguasArriba: poblacionAguasArriba,
      accesoVial: accesoVial,
      distanciaHospitalKm: distHospital,
      marginacion: localidad.vulnerabilidad.marginacion,
      apiPrevio7DiasMm: apiPrevio,
      lluviaEvento24hMm: parseFloat(lluviaEfectiva24h.toFixed(1)),
      saturacionTotalSueloMm: saturacionTotalSuelo,
      umbralFisicoDeslaveMm: umbralDeslave,
      vientoSostenidoKmh: vientoSostenidoMax,
      rafagaMaximaKmh: rafagaMaxima,
      visibilidadMinKm: visibilidadMinKm,
      esLaderaHabitada: esLadera,
      esRiberaVulnerable: distRio <= 0.8
    },
    protocolo: "Consulte al coordinador de Cáritas",
    contexto: {
      niebla: calcularContextoNiebla(serieHoraria)
    }
  };
}