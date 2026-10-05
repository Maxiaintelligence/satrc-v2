/**
 * SatRC V2.0 - Core Engine: Evaluador de Riesgo Sistémico Comunitario
 * Implementa Principio Precautorio Asimétrico, Validación de Vigencia SMN
 * y Cero Degeneración Silenciosa.
 */

function calcularUmbralDeslave(localidad) {
  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';
  let factorRelieve = 0;
  if (relieve === 'LADERA') factorRelieve = 15;
  else if (relieve === 'LOMA') factorRelieve = 8;
  return Math.max(12, parseFloat((65 - (pendiente * 0.85) - factorRelieve).toFixed(1)));
}

function calcularAPI7DiasPrevios(serieHoraria) {
  if (!serieHoraria || serieHoraria.length < 168) return 15.0;
  const horasPrevias = serieHoraria.slice(0, 168);
  let api = 0;
  for (let d = 1; d <= 7; d++) {
    const inicio = (d - 1) * 24;
    const lluviaDiaria = horasPrevias.slice(inicio, d * 24).reduce((acc, h) => acc + (h.lluvia_mm || 0), 0);
    api += (lluviaDiaria * Math.pow(0.85, 8 - d));
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
  let vientoMax = 0;
  let rafagaMax = 0;
  let visMinKm = 10;

  eventoActual.forEach(h => {
    const ll = h.lluvia_mm || 0;
    lluviaEventoActual24h += ll;
    if (ll > lluviaMaxHoraria) { lluviaMaxHoraria = ll; horaPico = h.fecha_hora; }
    if (ll >= 1.0 && !horaInicio) horaInicio = h.fecha_hora;
    if (h.temperatura_c !== undefined && h.temperatura_c < tempMinima) tempMinima = h.temperatura_c;
    if (h.wind_speed_10m && h.wind_speed_10m > vientoMax) vientoMax = h.wind_speed_10m;
    if (h.rafagas_kmh && h.rafagas_kmh > rafagaMax) rafagaMax = h.rafagas_kmh;
    if (h.visibility !== undefined && (h.visibility / 1000) < visMinKm) visMinKm = h.visibility / 1000;
  });

  const esAltiplano = ['APN', 'TIZ', 'PMS', 'ACT'].includes(localidad.zona_id);
  const esSierra = ['HUA', 'SPP', 'ZAC', 'CHG', 'ZAH', 'ATG', 'TUL'].includes(localidad.zona_id);
  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';
  const esLadera = relieve === 'LADERA' || pendiente >= 25;
  const distRio = localidad.hidrologia.distancia_cauce_km || 99;
  const twi = localidad.topografia.twi || 0;
  const accesoVial = localidad.vulnerabilidad.acceso_vial || 'CARRETERA_ESTATAL';
  const esTerraceria = accesoVial === 'CAMINO_TERRACERIA' || accesoVial === 'BRECHA';
  const esMarginacionAlta = localidad.vulnerabilidad.marginacion === 'ALTO' || localidad.vulnerabilidad.marginacion === 'MUY ALTO';
  const distHospital = localidad.vulnerabilidad.dist_hospital_km || 0;
  const altitud = localidad.topografia.altitud_msnm || 0;

  // CONTROL DE VIGENCIA DEL AVISO SMN
  const alertaSMN = contexto.alertaSMN;
  let avisoSMNVigente = false;

  if (alertaSMN) {
    // Si viene fecha de vigencia fin, validarla; de lo contrario asumir activa
    if (alertaSMN.vigencia_fin_iso) {
      avisoSMNVigente = Date.now() <= Date.parse(alertaSMN.vigencia_fin_iso);
    } else {
      avisoSMNVigente = alertaSMN.activo !== false;
    }
  }

  // PRINCIPIO PRECAUTORIO ASIMÉTRICO:
  // Si la firma viene rota o nula pero hay temporal declarado, NO degradar silenciosamente a calma
  const estadosAfectados = alertaSMN?.estados_afectados || [];
  const estadoLoc = (localidad.estado || '').toUpperCase();
  const estadoBajoAviso = estadosAfectados.some(e => estadoLoc.includes(e) || e.includes(estadoLoc.slice(0, 3)));

  const bajoAvisoFederalSierra = avisoSMNVigente && esSierra && (estadoBajoAviso || estadosAfectados.length === 0);

  // Piso de lluvia oficial adoptado
  const lluviaEfectiva24h = bajoAvisoFederalSierra
    ? Math.max(lluviaEventoActual24h, alertaSMN?.rango_lluvia_min_mm || 75)
    : lluviaEventoActual24h;

  const saturacionTotalSuelo = parseFloat((apiPrevio + lluviaEfectiva24h).toFixed(1));

  let nivelAlerta = 1;
  let diagnostico = {
    titulo: "Condiciones de Estabilidad Atmosférica y Geofísica",
    causa: "Suelo con capacidad de absorción y cauces en nivel base.",
    tipoAmenaza: "ESTABLE"
  };

  // REGLA DE PROTECCIÓN AL ALTIPLANO: Sin riesgo de ladera y lluvia real baja = Nivel 1
  if (esAltiplano && !esLadera && lluviaEventoActual24h < 20.0) {
    nivelAlerta = 1;
    diagnostico = {
      titulo: "Condiciones de Estabilidad y Calma",
      causa: `Zona de Altiplano protegida por sombra orográfica. Lluvia real de ${lluviaEventoActual24h.toFixed(1)} mm sin amenaza geofísica.`,
      tipoAmenaza: "ESTABLE"
    };
  } else {
    // REGLA OBLIGATORIA DEL PRINCIPIO PRECAUTORIO:
    // Si la localidad serrana está bajo aviso federal activo del SMN, TECHO MÍNIMO = NIVEL 3
    if (bajoAvisoFederalSierra) {
      if (esLadera && pendiente >= 32) {
        nivelAlerta = 4; // Emergencia por pendiente extrema bajo temporal oficial
        diagnostico = {
          titulo: "Peligro Crítico de Deslave en Ladera Habitada",
          causa: `Bajo Aviso Oficial CONAGUA/SMN (${alertaSMN?.titulo || 'Temporal Activo'}): Previsión de 75 a 150 mm sobre ladera de ${pendiente}°. Falla inminente de talud.`,
          tipoAmenaza: "DESLAVE_CRITICO"
        };
      } else {
        nivelAlerta = 3; // Alerta Temprana obligatoria
        diagnostico = {
          titulo: "Alerta Temprana por Temporal Severo Oficial",
          causa: `Bajo Aviso Oficial CONAGUA/SMN (${alertaSMN?.titulo || 'Temporal Activo'}): Lluvias intensas con riesgo de reblandecimiento y cortes viales.`,
          tipoAmenaza: "TEMPORAL_SEVERO"
        };
      }
    }
    // Evaluación por Modelo Local
    else if (esLadera && saturacionTotalSuelo >= 65.0) {
      nivelAlerta = (pendiente >= 35 || (saturacionTotalSuelo >= 100.0 && esMarginacionAlta)) ? 4 : 3;
      diagnostico = {
        titulo: nivelAlerta === 4 ? "Peligro Crítico de Deslave en Ladera" : "Saturación Crítica de Terreno",
        causa: `Saturación de suelo (${saturacionTotalSuelo} mm) sobre ladera de ${pendiente}°.`,
        tipoAmenaza: "DESLAVE_LOCAL"
      };
    }

    // Riesgo Fluvial
    if (distRio <= 0.8 && twi >= 12.0 && lluviaEfectiva24h >= 35.0 && !esAltiplano) {
      nivelAlerta = Math.max(nivelAlerta, 4);
      diagnostico = {
        titulo: "Desbordamiento e Inundación Ribereña",
        causa: `Comunidad en ribera activa (${distRio} km del cauce) en zona de convergencia de flujo.`,
        tipoAmenaza: "INUNDACION_FLUVIAL"
      };
    }

    // Aislamiento Vial
    if (esTerraceria && (lluviaEfectiva24h >= 20.0 || saturacionTotalSuelo >= 50.0) && nivelAlerta < 3) {
      nivelAlerta = 3;
      diagnostico = {
        titulo: "Amenaza de Incomunicación y Corte de Acceso",
        causa: `Vía única de terracería/brecha vulnerable a corte total por lodo.`,
        tipoAmenaza: "CORTE_VIAL"
      };
    }

    // Vigilancia Ordinaria
    if (nivelAlerta === 1 && (lluviaEfectiva24h >= 8.0 || saturacionTotalSuelo >= 35.0)) {
      nivelAlerta = 2;
      diagnostico = {
        titulo: "Vigilancia Meteorológica Preventiva",
        causa: `Precipitación activa con acumulado moderado (${saturacionTotalSuelo} mm).`,
        tipoAmenaza: "VIGILANCIA_NORMAL"
      };
    }
  }

  const tc = localidad.hidrologia.tc_horas || 6.0;
  const horaImpactoCresta = horaPico ? new Date(new Date(horaPico).getTime() + (tc * 3600000)).toISOString() : null;

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
      posicion_hidrologica: localidad.hidrologia.posicion || 'BAJA',
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
      posicionHidro: localidad.hidrologia.posicion || 'BAJA',
      coordenadas: localidad.coords,
      cuenca: localidad.hidrologia.subcuenca_nom
    },
    impactoSistemico: {
      poblacionDirecta: localidad.vulnerabilidad.poblacion,
      poblacionAguasArriba: localidad.hidrologia.poblacion_aguas_arriba || 0,
      accesoVial: accesoVial,
      distanciaHospitalKm: distHospital,
      marginacion: localidad.vulnerabilidad.marginacion,
      apiPrevio7DiasMm: apiPrevio,
      lluviaEvento24hMm: parseFloat(lluviaEfectiva24h.toFixed(1)),
      saturacionTotalSueloMm: saturacionTotalSuelo,
      umbralFisicoDeslaveMm: umbralDeslave,
      vientoSostenidoKmh: vientoMax,
      rafagaMaximaKmh: rafagaMax,
      visibilidadMinKm: visMinKm
    },
    protocolo: "Consulte al coordinador de Cáritas"
  };
}