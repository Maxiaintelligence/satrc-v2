/**
 * SatRC V2.0 - Core Engine: Sistema Experto de Interpretación y Asesoría Geofísica (SEIAG)
 * Implementa API corregido (k=0.85), S_suelo sin doble conteo, Wind Chill desacoplado,
 * visibilidad por niebla, viento sostenido y riesgo fluvial de cañada (Caso Huehuetla).
 */

function calcularUmbralDeslave(localidad) {
  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';

  let factorRelieve = 0;
  if (relieve === 'LADERA') factorRelieve = 15;
  else if (relieve === 'LOMA') factorRelieve = 8;

  // Umbral geomecánico calibrado: a mayor pendiente y ladera, menor agua detonante
  const umbral = 65 - (pendiente * 0.85) - factorRelieve;
  return Math.max(12, parseFloat(umbral.toFixed(1)));
}

/**
 * P1 & P2: Calcula el API de los 7 días previos estrictos (d = 1 a 7)
 * con decaimiento diario k = 0.85 sobre precipitación diaria acumulada.
 */
function calcularAPI7DiasPrevios(serieHoraria) {
  if (!serieHoraria || serieHoraria.length < 168) return 25.0; // Valor base si no hay historial

  // Las primeras 168 horas representan estrictamente los 7 días previos al evento actual
  const horasPrevias = serieHoraria.slice(0, 168);
  let api = 0;

  for (let d = 1; d <= 7; d++) {
    const inicioDia = (d - 1) * 24;
    const finDia = d * 24;
    // Precipitación diaria en mm/día
    const lluviaDiaria = horasPrevias.slice(inicioDia, finDia).reduce((acc, h) => acc + (h.lluvia_mm || 0), 0);
    // Factor (0.85)^d donde ayer (d=1) retiene 85% y hace 7 días retiene (0.85)^7
    const pesoDecaimiento = Math.pow(0.85, 8 - d);
    api += (lluviaDiaria * pesoDecaimiento);
  }

  return parseFloat(api.toFixed(1));
}

/**
 * Evaluación Geofísica Individual Rigurosa
 */
export function evaluarLocalidad(localidad, serieHoraria, contexto = {}) {
  const umbralDeslave = calcularUmbralDeslave(localidad);

  // 1. Memoria hídrica sin doble conteo: API de días 1 a 7 previos
  const apiPrevio = calcularAPI7DiasPrevios(serieHoraria);

  // 2. Evento actual en curso (Día actual t=0 / próximas 24h)
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

  // Homologación ascendente con Aviso Federal del SMN
  const alertaSMN = contexto.alertaSMN;
  const bajoAvisoFederal = alertaSMN && (
    (localidad.estado.toLowerCase().includes('puebla') && alertaSMN.estados_afectados?.includes('PUE')) ||
    (localidad.estado.toLowerCase().includes('hidalgo') && alertaSMN.estados_afectados?.includes('HGO'))
  );

  const lluviaEfectiva24h = bajoAvisoFederal
    ? Math.max(lluviaEventoActual24h, alertaSMN.rango_lluvia_min_mm || 75)
    : lluviaEventoActual24h;

  // Saturación total del suelo: Memoria días previos (t-1 a t-7) + Evento actual (t=0)
  const saturacionTotalSuelo = parseFloat((apiPrevio + lluviaEfectiva24h).toFixed(1));

  // Parámetros Físicos y Sociales del CSV
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

  // Nivel y Diagnóstico Geofísico
  let nivelAlerta = 1;
  let diagnostico = {
    titulo: "Condiciones de Estabilidad Atmosférica y Geofísica",
    causa: "Suelo con capacidad de absorción y cauces en nivel base.",
    tipoAmenaza: "ESTABLE"
  };

  // --- REGLAS DE VIENTO Y VISIBILIDAD (O4 & P4) ---
  if (vientoSostenidoMax >= 60 || rafagaMaxima >= 75) {
    nivelAlerta = Math.max(nivelAlerta, 4);
    diagnostico = {
      titulo: "Vientos Severos y Ráfagas Destructivas",
      causa: `Ráfagas de ${rafagaMaxima} km/h (sostenido ${vientoSostenidoMax} km/h). Peligro de desprendimiento de techumbres y caída de cableado eléctrico.`,
      tipoAmenaza: "VIENTO_SEVERO"
    };
  } else if (vientoSostenidoMax >= 40 || rafagaMaxima >= 55) {
    nivelAlerta = Math.max(nivelAlerta, 3);
    diagnostico = {
      titulo: "Viento Fuerte con Riesgo de Afectación Ligera",
      causa: `Ráfagas de ${rafagaMaxima} km/h con oleaje en embalses y riesgo de caída de ramas en caminos serranos.`,
      tipoAmenaza: "VIENTO_FUERTE"
    };
  }

  // Niebla densa orográfica (P4)
  if (visibilidadMinKm < 0.5 && nivelAlerta < 3) {
    nivelAlerta = 3;
    diagnostico = {
      titulo: "Niebla Densa con Visibilidad Nula en Carreteras",
      causa: `Bancos de niebla espesa (< 500 m). Ceguera de tránsito en puertos y curvas de montaña.`,
      tipoAmenaza: "NIEBLA_CRITICA"
    };
  }

  // --- REGLAS DE FRÍO Y WIND CHILL DESACOPLADAS (O1 & P3) ---
  if (altitud >= 2100) {
    // Regla C: Combinada extrema
    if (tempMinima <= 0.0 && rafagaMaxima >= 50) {
      nivelAlerta = 4;
      diagnostico = {
        titulo: "Emergencia por Helada Severa con Viento Helado (Wind Chill)",
        causa: `Temperatura de ${tempMinima}°C con ráfagas de ${rafagaMaxima} km/h. Hipotermia crítica inmediata y congelamiento de superficies.`,
        tipoAmenaza: "WIND_CHILL_EXTREMO"
      };
    }
    // Regla A: Frío puro / Helada estática
    else if (tempMinima <= -3.0) {
      nivelAlerta = Math.max(nivelAlerta, 4);
      diagnostico = {
        titulo: "Helada Severa y Congelamiento",
        causa: `Descenso térmico a ${tempMinima}°C a ${altitud} msnm. Alto impacto en salud de niños/adultos mayores y mortandad agropecuaria.`,
        tipoAmenaza: "HELADA_NEGRA"
      };
    } else if (tempMinima <= 0.0) {
      nivelAlerta = Math.max(nivelAlerta, 3);
      diagnostico = {
        titulo: "Helada y Descenso Térmico Crítico",
        causa: `Mínima de ${tempMinima}°C a ${altitud} msnm con riesgo de escarcha y afectación respiratoria.`,
        tipoAmenaza: "HELADA"
      };
    }
    // Regla B: Wind Chill moderado
    else if (tempMinima <= 4.0 && rafagaMaxima >= 50) {
      nivelAlerta = Math.max(nivelAlerta, 3);
      diagnostico = {
        titulo: "Estrés Térmico Severo por Viento",
        causa: `Sensación térmica bajo cero debido a ráfagas de ${rafagaMaxima} km/h con temperatura de ${tempMinima}°C.`,
        tipoAmenaza: "STRESS_TERMICO"
      };
    }
  }

  // --- ESCENARIO 1: DESLAVE POR SATURACIÓN DE SUELO Y PENDIENTE ---
  if (esLadera && saturacionTotalSuelo >= 65.0) {
    if (pendiente >= 35 || (saturacionTotalSuelo >= 100.0 && esMarginacionAlta)) {
      nivelAlerta = 4;
      diagnostico = {
        titulo: "Peligro Crítico de Deslave y Remoción en Masa",
        causa: `Suelo saturado al límite geomecánico (${saturacionTotalSuelo} mm acumulados: ${apiPrevio} mm previos + ${lluviaEfectiva24h} mm hoy) sobre ladera de ${pendiente}°. Falla inminente de talud habitado.`,
        tipoAmenaza: "DESLAVE_CRITICO"
      };
    } else {
      nivelAlerta = Math.max(nivelAlerta, 3);
      diagnostico = {
        titulo: "Saturación Crítica de Terreno en Pendiente",
        causa: `Acumulado hídrico de ${saturacionTotalSuelo} mm debilita la cohesión en ladera de ${pendiente}°. Probabilidad de caída de rocas y deslaves menores.`,
        tipoAmenaza: "DESLAVE_MODERADO"
      };
    }
  }

  // --- ESCENARIO 2: DESBORDAMIENTO FLUVIAL EN CAÑADA (Caso Huehuetla) ---
  const riesgoFluvial = (distRio <= 0.8) && (twi >= 12.0) && (lluviaEfectiva24h >= 25.0 || contexto.lluvia_cabecera_mm >= 45.0);
  if (riesgoFluvial) {
    const severidadFluvial = (lluviaEfectiva24h >= 60.0 || poblacionAguasArriba >= 40000) ? 4 : 3;
    if (severidadFluvial >= nivelAlerta) {
      nivelAlerta = severidadFluvial;
      diagnostico = {
        titulo: "Riesgo de Desbordamiento e Inundación Ribereña",
        causa: `Comunidad en ribera activa a ${distRio} km del cauce en zona de convergencia de flujo (TWI ${twi}). Crecida en tránsito con aporte de ${poblacionAguasArriba.toLocaleString()} hab. aguas arriba.`,
        tipoAmenaza: "INUNDACION_FLUVIAL"
      };
    }
  }

  // --- ESCENARIO 3: AISLAMIENTO VIAL POR TEMPORAL PROLONGADO ---
  const riesgoCorteVial = esTerraceriaOBrecha && (lluviaEfectiva24h >= 20.0 || saturacionTotalSuelo >= 50.0);
  if (riesgoCorteVial && nivelAlerta < 3) {
    nivelAlerta = 3;
    diagnostico = {
      titulo: "Amenaza de Incomunicación y Corte de Acceso",
      causa: `Vía única de terracería/brecha vulnerable a corte total por zanjas de lodo. Distancia a hospital de ${distHospital} km sin paso garantizado.`,
      tipoAmenaza: "CORTE_VIAL"
    };
  }

  // Vigilancia preventiva ordinaria
  if (nivelAlerta === 1 && (lluviaEfectiva24h >= 8.0 || saturacionTotalSuelo >= 35.0)) {
    nivelAlerta = 2;
    diagnostico = {
      titulo: "Vigilancia Meteorológica Preventiva",
      causa: `Precipitación continua con acumulación hídrica moderada (${saturacionTotalSuelo} mm). Mantener vigilancia de vados y alcantarillas.`,
      tipoAmenaza: "VIGILANCIA_NORMAL"
    };
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
    
    // Diagnóstico Ejecutivo Implícito
    diagnostico: diagnostico,
    
    // Compatibilidad Total (Mapa y Tablas)
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