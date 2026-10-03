/**
 * SatRC V2.0 - Core Engine: Evaluador de Amenazas Riguroso
 * Integra la Regla de Máxima Protección (SMN CAP) y Factor de Amplificación Orográfica.
 */

function calcularUmbralDeslave(localidad) {
  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';

  let factorRelieve = 0;
  if (relieve === 'LADERA') factorRelieve = 15;
  else if (relieve === 'LOMA') factorRelieve = 8;

  // Umbral físico: a mayor pendiente y ladera, menor agua necesaria para desprender
  const umbral = 65 - (pendiente * 0.85) - factorRelieve;
  return Math.max(12, parseFloat(umbral.toFixed(1)));
}

/**
 * Evalúa la amenaza para una localidad cruzando la física del terreno con los modelos y el SMN
 * @param {Object} localidad Datos del CSV
 * @param {Array<Object>} serieHoraria Pronóstico numérico de 24h
 * @param {Object} contexto Contexto hidrológico y alertas oficiales del SMN
 */
export function evaluarLocalidad(localidad, serieHoraria, contexto = {}) {
  const umbralDeslave = calcularUmbralDeslave(localidad);
  
  // 1. Detección de Alerta Federal Activa del SMN para esta comunidad
  const alertaFederalSMN = contexto.alertaSMN || null;
  const esEstadoBajoAlertaFederal = alertaFederalSMN && (
    (localidad.estado.toLowerCase().includes('puebla') && alertaFederalSMN.estados_afectados?.includes('PUE')) ||
    (localidad.estado.toLowerCase().includes('hidalgo') && alertaFederalSMN.estados_afectados?.includes('HGO')) ||
    (localidad.estado.toLowerCase().includes('veracruz') && alertaFederalSMN.estados_afectados?.includes('VER'))
  );

  // 2. Factor de Amplificación Orográfica en la Sierra Madre Oriental
  // Los modelos globales diluyen la lluvia en cuadrículas planas de 20 km.
  // En laderas de montaña con pendiente > 25°, la condensación orográfica real es 2x a 3x superior.
  const esLaderaCritica = localidad.topografia.pendiente_max_deg >= 20 || localidad.topografia.relieve === 'LADERA';
  const factorOrografico = esLaderaCritica ? 2.2 : 1.0;

  let lluvia24hCalculada = 0;
  let lluviaMaxHoraria = 0;
  let horaPico = null;
  let horaInicio = null;
  let tempMinima = 99;

  for (let i = 0; i < Math.min(24, serieHoraria.length); i++) {
    const h = serieHoraria[i];
    // Se aplica la corrección orográfica si es zona de ladera
    const lluviaRealEstimada = h.lluvia_mm * factorOrografico;
    lluvia24hCalculada += lluviaRealEstimada;

    if (lluviaRealEstimada > lluviaMaxHoraria) {
      lluviaMaxHoraria = parseFloat(lluviaRealEstimada.toFixed(1));
      horaPico = h.fecha_hora;
    }

    if (lluviaRealEstimada >= 1.0 && !horaInicio) {
      horaInicio = h.fecha_hora;
    }

    if (h.temperatura_c < tempMinima) {
      tempMinima = h.temperatura_c;
    }
  }

  // Si hay alerta federal oficial de 75 a 150 mm, el piso de lluvia adoptado es el del SMN
  const lluviaAdoptada24h = esEstadoBajoAlertaFederal 
    ? Math.max(lluvia24hCalculada, alertaFederalSMN.rango_lluvia_min_mm || 75)
    : lluvia24hCalculada;

  // 3. Determinación Rigurosa de Niveles de Alerta (1 a 4)
  let nivelAlerta = 1;
  let queSucede = {
    vector: "HIDROMETEOROLOGICO",
    evento: "CONDICIONES_ESTABLES",
    descripcion: "Sin amenazas significativas previstas en el periodo."
  };

  // CASO A: Homologación con Alerta Severa del SMN (75 a 150 mm)
  if (esEstadoBajoAlertaFederal) {
    if (esLaderaCritica && localidad.topografia.pendiente_max_deg >= 35) {
      nivelAlerta = 4; // Emergencia por pendiente extrema bajo temporal federal
      queSucede = {
        vector: "HIDROMETEOROLOGICO",
        evento: "ALERTA_MÁXIMA_POR_DESLAVE_Y_LLUVIA_TORRENCIAL",
        descripcion: `Bajo Aviso Federal de CONAGUA/SMN (${alertaFederalSMN.titulo}): Previsión de 75 a 150 mm en pendiente de ${localidad.topografia.pendiente_max_deg}°. Peligro crítico de deslizamiento de ladera e incomunicación.`
      };
    } else {
      nivelAlerta = 3; // Alerta Temprana obligatoria
      queSucede = {
        vector: "HIDROMETEOROLOGICO",
        evento: "TEMPORAL_SEVERO_OFICIAL_SMN",
        descripcion: `Aviso oficial de CONAGUA/SMN vigente: Lluvias puntuales intensas (75 a 150 mm) por Frente Frío y circulación ciclónica. Riesgo de encharcamientos severos y crecidas.`
      };
    }
  }
  // CASO B: Deslave por Modelo Numérico Orográfico Local
  else if (esLaderaCritica && lluviaAdoptada24h >= umbralDeslave) {
    nivelAlerta = lluviaAdoptada24h >= (umbralDeslave * 1.3) ? 4 : 3;
    queSucede = {
      vector: "HIDROMETEOROLOGICO",
      evento: "DESLAVE_Y_FLUJO_DETRITOS",
      descripcion: `Lluvia acumulada (${lluviaAdoptada24h.toFixed(1)} mm) supera el umbral crítico local (${umbralDeslave} mm) en pendiente de ${localidad.topografia.pendiente_max_deg}°. Suelo saturado con riesgo de desprendimiento.`
    };
  }
  // CASO C: Cascada Hidrológica aguas abajo
  else if (contexto.lluvia_cabecera_mm >= 45 && localidad.hidrologia.posicion === 'BAJA') {
    nivelAlerta = contexto.lluvia_cabecera_mm >= 80 ? 4 : 3;
    queSucede = {
      vector: "HIDROMETEOROLOGICO",
      evento: "CRECIDA_FLUVIAL_EN_CASCADA",
      descripcion: `Aporte torrencial en la cabecera de la subcuenca ${localidad.hidrologia.subcuenca_nom}. Crecida en tránsito hacia planicie ribereña.`
    };
  }
  // CASO D: Lluvia moderada ordinaria
  else if (lluviaAdoptada24h >= 8.0) {
    nivelAlerta = 2; // Vigilancia
    queSucede = {
      vector: "HIDROMETEOROLOGICO",
      evento: "VIGILANCIA_POR_PRECIPITACIÓN",
      descripcion: `Lluvia continua con acumulado de ${lluviaAdoptada24h.toFixed(1)} mm. Mantener vigilancia preventiva en cañadas y pasos a desnivel.`
    };
  }

  // Tiempos y Ventanas
  const tc = localidad.hidrologia.tc_horas || 6;
  const horaImpactoCresta = horaPico ? new Date(new Date(horaPico).getTime() + (tc * 3600000)).toISOString() : null;

  // Dimensión e Incomunicación
  const esAccesoVulnerable = localidad.vulnerabilidad.acceso_vial === 'BRECHA' || localidad.vulnerabilidad.acceso_vial === 'CAMINO_TERRACERIA';
  let riesgoAislamiento = "BAJO";
  if (esAccesoVulnerable && nivelAlerta >= 3) {
    riesgoAislamiento = "CRÍTICO (Acceso por camino de terracería con alto riesgo de corte total por lodazal)";
  } else if (esAccesoVulnerable) {
    riesgoAislamiento = "MODERADO (Vía vulnerable a anegamiento)";
  }

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
    
    que: queSucede,
    
    cuando: {
      inicio_amenaza: horaInicio || "En curso / Vigilancia activa",
      pico_maximo_lluvia: horaPico || "Periodo de temporal",
      intensidad_pico_horaria_mm: lluviaMaxHoraria,
      llegada_cresta_hidrologica: horaImpactoCresta || "No aplica",
      ventana_evacuacion_horas: tc,
      temperatura_minima_c: tempMinima
    },
    
    donde: {
      subcuenca_cve: localidad.hidrologia.subcuenca_cve,
      subcuenca_nom: localidad.hidrologia.subcuenca_nom,
      posicion_hidrologica: localidad.hidrologia.posicion,
      tipo_relieve: localidad.topografia.relieve,
      pendiente_max_grados: localidad.topografia.pendiente_max_deg,
      distancia_cauce_km: localidad.hidrologia.distancia_cauce_km,
      coordenadas: localidad.coords
    },
    
    tamano_impacto: {
      poblacion_directa: localidad.vulnerabilidad.poblacion,
      poblacion_aguas_arriba: localidad.hidrologia.poblacion_aguas_arriba,
      riesgo_aislamiento_vial: riesgoAislamiento,
      tipo_acceso: localidad.vulnerabilidad.acceso_vial,
      distancia_hospital_km: localidad.vulnerabilidad.dist_hospital_km,
      grado_marginacion: localidad.vulnerabilidad.marginacion,
      lluvia_acumulada_24h_mm: parseFloat(lluviaAdoptada24h.toFixed(1)),
      umbral_deslave_local_mm: umbralDeslave,
      bajo_aviso_federal_smn: esEstadoBajoAlertaFederal
    }
  };
}