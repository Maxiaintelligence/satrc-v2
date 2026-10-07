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
  let visibilidadMinKm = 10;

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
    if (h.wind_speed_10m && h.wind_speed_10m > vientoSostenidoMax) {
      vientoSostenidoMax = h.wind_speed_10m;
    }
    if (h.rafagas_kmh && h.rafagas_kmh > rafagaMaxima) {
      rafagaMaxima = h.rafagas_kmh;
    }
    if (h.visibility !== undefined) {
      const visKm = h.visibility / 1000;
      if (visKm < visibilidadMinKm) visibilidadMinKm = visKm;
    }
  });

  // Delimitación Geográfica Diocesana
  const esZonaAltiplanoPlano = ['APN', 'TIZ', 'PMS', 'ACT'].includes(localidad.zona_id);
  const esZonaSierraExpuesta = ['HUA', 'SPP', 'ZAC', 'CHG', 'ZAH', 'ATG', 'TUL'].includes(localidad.zona_id);

  // Aviso Federal del Frente Frío (75 a 150 mm) aplica a zonas de Sierra
  const alertaSMN = contexto.alertaSMN;
  const bajoAvisoFederalSierra = alertaSMN && esZonaSierraExpuesta && (
    (localidad.estado.toLowerCase().includes('puebla') && alertaSMN.estados_afectados?.includes('PUE')) ||
    (localidad.estado.toLowerCase().includes('hidalgo') && alertaSMN.estados_afectados?.includes('HGO'))
  );

  const lluviaEfectiva24h = bajoAvisoFederalSierra
    ? Math.max(lluviaEventoActual24h, alertaSMN.rango_lluvia_min_mm || 75)
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
    // Si hay lluvia activa (8 a 30 mm) o bancos de niebla en valles/lomas suaves (10° a 24°), activa legítimamente Nivel 2
    if (nivelAlerta === 1 && (lluviaEfectiva24h >= 8.0 || saturacionTotalSuelo >= 30.0 || visibilidadMinKm <= 2.0)) {
      nivelAlerta = 2; // AMARILLO VIGILANCIA
      diagnostico = {
        titulo: "Vigilancia Preventiva por Lluvia Activa y Niebla",
        causa: `Precipitación continua moderada (${lluviaEfectiva24h.toFixed(1)} mm) en valles y lomas de transición. Pavimento resbaloso y escurrimientos en vados.`,
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
    protocolo: "Consulte al coordinador de Cáritas"
  };
}