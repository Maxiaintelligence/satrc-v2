/**
 * SatRC V2.0 - Core Engine: Evaluador de Riesgo Sistémico Comunitario
 * Discrimina con bisturí entre las zonas serranas de impacto y el Altiplano protegido.
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

  // DISCRIMINACIÓN GEOGRÁFICA CLAVE:
  // Zonas del Altiplano Central protegidas tras la sierra (sombra orográfica)
  const esZonaAltiplanoPlano = ['APN', 'TIZ', 'PMS', 'ACT'].includes(localidad.zona_id);
  
  // Zonas de Sierra expuestas al barlovento del Frente Frío
  const esZonaSierraExpuesta = ['HUA', 'SPP', 'ZAC', 'CHG', 'ZAH', 'ATG', 'TUL'].includes(localidad.zona_id);

  // El aviso federal del Frente Frío 1 (75 a 150 mm) SOLO aplica si la comunidad está en la SIERRA
  const alertaSMN = contexto.alertaSMN;
  const bajoAvisoFederalSierra = alertaSMN && esZonaSierraExpuesta && (
    (localidad.estado.toLowerCase().includes('puebla') && alertaSMN.estados_afectados?.includes('PUE')) ||
    (localidad.estado.toLowerCase().includes('hidalgo') && alertaSMN.estados_afectados?.includes('HGO'))
  );

  // En el Altiplano (Apan, Tizayuca, Pachuca) NUNCA se inyectan 75 mm ficticios; se toma su lluvia real
  const lluviaEfectiva24h = bajoAvisoFederalSierra
    ? Math.max(lluviaEventoActual24h, alertaSMN.rango_lluvia_min_mm || 75)
    : lluviaEventoActual24h;

  const saturacionTotalSuelo = parseFloat((apiPrevio + lluviaEfectiva24h).toFixed(1));

  // Parámetros Físicos del CSV
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
    causa: "Suelo con capacidad de absorción y cauces en nivel base.",
    tipoAmenaza: "ESTABLE"
  };

  // REGLA DE SEGURIDAD ABSOLUTA PARA EL ALTIPLANO:
  // Si está en el Altiplano, tiene relieve plano/meseta y lluvia real < 25 mm: FORZAR NIVEL 1 NORMAL
  if (esZonaAltiplanoPlano && !esLadera && lluviaEventoActual24h < 25.0) {
    nivelAlerta = 1;
    diagnostico = {
      titulo: "Condiciones de Estabilidad y Normalidad",
      causa: `Zona de Altiplano protegida por sombra orográfica. Lluvia real de ${lluviaEventoActual24h.toFixed(1)} mm sin riesgo geofísico.`,
      tipoAmenaza: "ESTABLE"
    };
  } else {
    // --- EVALUACIÓN EXCLUSIVA PARA ZONAS EN RIESGO ---

    // 1. Deslave por memoria de suelo saturado en Ladera
    if (esLadera && saturacionTotalSuelo >= 65.0) {
      if (pendiente >= 35 || (saturacionTotalSuelo >= 100.0 && esMarginacionAlta)) {
        nivelAlerta = 4;
        diagnostico = {
          titulo: "Peligro Crítico de Deslave y Remoción en Masa",
          causa: `Suelo saturado (${saturacionTotalSuelo} mm acumulados) sobre ladera de ${pendiente}°. Alto riesgo de deslizamiento sobre viviendas y cortes de paso.`,
          tipoAmenaza: "DESLAVE_CRITICO"
        };
      } else {
        nivelAlerta = 3;
        diagnostico = {
          titulo: "Saturación Crítica de Terreno en Pendiente",
          causa: `Acumulado hídrico de ${saturacionTotalSuelo} mm en ladera de ${pendiente}°. Desprendimientos menores y reblandecimiento.`,
          tipoAmenaza: "DESLAVE_MODERADO"
        };
      }
    }

    // 2. Desbordamiento Fluvial en Cañadas (Solo si la cuenca específica tiene lluvia fuerte)
    const lluviaCuenca = contexto.lluviasPorCuenca?.[localidad.hidrologia.subcuenca_cve] || lluviaEfectiva24h;
    const riesgoFluvialReal = (distRio <= 0.8) && (twi >= 12.0) && (lluviaCuenca >= 35.0);

    if (riesgoFluvialReal && !esZonaAltiplanoPlano) {
      const severidadFluvial = (lluviaCuenca >= 65.0 || poblacionAguasArriba >= 50000) ? 4 : 3;
      if (severidadFluvial >= nivelAlerta) {
        nivelAlerta = severidadFluvial;
        diagnostico = {
          titulo: "Riesgo de Desbordamiento e Inundación Ribereña",
          causa: `Población en ribera encajonada (${distRio} km del río) con aporte torrencial de ${poblacionAguasArriba.toLocaleString()} hab. aguas arriba.`,
          tipoAmenaza: "INUNDACION_FLUVIAL"
        };
      }
    }

    // 3. Aislamiento por terracería en temporal
    const riesgoCorteVial = esTerraceriaOBrecha && (lluviaEfectiva24h >= 20.0 || saturacionTotalSuelo >= 50.0);
    if (riesgoCorteVial && nivelAlerta < 3) {
      nivelAlerta = 3;
      diagnostico = {
        titulo: "Amenaza de Incomunicación y Corte de Acceso",
        causa: `Vía única de terracería/brecha vulnerable a corte total por lodo. Hospital a ${distHospital} km sin paso garantizado.`,
        tipoAmenaza: "CORTE_VIAL"
      };
    }

    // 4. Vigilancia preventiva normal
    if (nivelAlerta === 1 && (lluviaEfectiva24h >= 8.0 || saturacionTotalSuelo >= 35.0)) {
      nivelAlerta = 2;
      diagnostico = {
        titulo: "Vigilancia Meteorológica Preventiva",
        causa: `Precipitación activa con acumulado moderado (${saturacionTotalSuelo} mm). Vigilancia rutinaria de vados.`,
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