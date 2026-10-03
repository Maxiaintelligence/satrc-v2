/**
 * SatRC V2.0 - Core Engine: Evaluador de Amenazas Riguroso
 * Responde obligatoriamente a: QUÉ, CUÁNDO, DÓNDE y TAMAÑO DEL IMPACTO.
 * Incluye detección de Lluvia Torrencial Súbita (Flash Flood) e Intensidad Instantánea.
 */

function calcularUmbralDeslave(localidad) {
  const pendiente = localidad.topografia.pendiente_max_deg || 0;
  const relieve = localidad.topografia.relieve || 'MESETA';

  let factorRelieve = 0;
  if (relieve === 'LADERA') factorRelieve = 15;
  else if (relieve === 'LOMA') factorRelieve = 8;

  // Umbral acumulado de 24h ajustado
  const umbral = 70 - (pendiente * 0.9) - factorRelieve;
  return Math.max(12, parseFloat(umbral.toFixed(1)));
}

export function evaluarLocalidad(localidad, serieHoraria, contextoCuenca = {}) {
  const umbralDeslave24h = calcularUmbralDeslave(localidad);
  
  let lluvia24h = 0;
  let lluviaMaxHoraria = 0;
  let horaPico = null;
  let horaInicio = null;
  let tempMinima = 99;
  let rafagaMaxima = 0;

  for (let i = 0; i < Math.min(24, serieHoraria.length); i++) {
    const h = serieHoraria[i];
    lluvia24h += h.lluvia_mm;

    if (h.lluvia_mm > lluviaMaxHoraria) {
      lluviaMaxHoraria = h.lluvia_mm;
      horaPico = h.fecha_hora;
    }

    if (h.lluvia_mm >= 1.0 && !horaInicio) {
      horaInicio = h.fecha_hora;
    }

    if (h.temperatura_c < tempMinima) {
      tempMinima = h.temperatura_c;
    }

    if (h.rafagas_kmh > rafagaMaxima) {
      rafagaMaxima = h.rafagas_kmh;
    }
  }

  let nivelAlerta = 1; // 1: Normal, 2: Vigilancia, 3: Alerta Temprana, 4: Emergencia
  let queSucede = {
    vector: "HIDROMETEOROLOGICO",
    evento: "CONDICIONES_ESTABLES",
    descripcion: "Sin amenazas meteorológicas significativas."
  };

  const esLaderaCritica = localidad.topografia.pendiente_max_deg >= 20 || localidad.topografia.relieve === 'LADERA';

  // --- REGLAS RIGUROSAS DE DETECCIÓN ---

  // 1. Tormenta Severa Instantánea (Flash Flood / Lluvia Convectiva Violenta)
  if (lluviaMaxHoraria >= 15.0) {
    nivelAlerta = 4; // Emergencia inmediata
    queSucede = {
      vector: "HIDROMETEOROLOGICO",
      evento: "TORMENTA_TORRENCIAL_SÚBITA",
      descripcion: `Intensidad extrema de ${lluviaMaxHoraria} mm en una sola hora. Peligro crítico de inundación repentina, arrastre de vehículos y desprendimientos inmediatos.`
    };
  }
  else if (lluviaMaxHoraria >= 8.0) {
    nivelAlerta = Math.max(nivelAlerta, 3);
    queSucede = {
      vector: "HIDROMETEOROLOGICO",
      evento: "TORMENTA_SEVERA_ACTIVA",
      descripcion: `Aguacero fuerte de ${lluviaMaxHoraria} mm/h con potencial de encharcamientos severos y saturación violenta de drenajes y cañadas.`
    };
  }

  // 2. Vector Deslave por Acumulado en Ladera
  if (esLaderaCritica && lluvia24h >= umbralDeslave24h) {
    const severidadDeslave = lluvia24h >= (umbralDeslave24h * 1.3) ? 4 : 3;
    if (severidadDeslave > nivelAlerta) {
      nivelAlerta = severidadDeslave;
      queSucede = {
        vector: "HIDROMETEOROLOGICO",
        evento: "DESLAVE_Y_FLUJO_DETRITOS",
        descripcion: `Lluvia acumulada (${lluvia24h.toFixed(1)} mm) supera el umbral crítico (${umbralDeslave24h} mm) en pendiente de ${localidad.topografia.pendiente_max_deg}°. Riesgo inminente de remoción en masa.`
      };
    }
  }

  // 3. Vector Cascada Hidrológica (Inundación Fluvial aguas abajo)
  if (contextoCuenca.lluvia_cabecera_mm >= 45 && localidad.hidrologia.posicion === 'BAJA') {
    const severidadCascada = contextoCuenca.lluvia_cabecera_mm >= 80 ? 4 : 3;
    if (severidadCascada > nivelAlerta) {
      nivelAlerta = severidadCascada;
      queSucede = {
        vector: "HIDROMETEOROLOGICO",
        evento: "CRECIDA_FLUVIAL_EN_CASCADA",
        descripcion: `Aporte torrencial (${contextoCuenca.lluvia_cabecera_mm.toFixed(1)} mm) en la cabecera de la subcuenca ${localidad.hidrologia.subcuenca_nom}. Crecida en tránsito hacia planicie ribereña.`
      };
    }
  }

  // 4. Vector Frío Extremo y Heladas
  if (tempMinima <= 2.0 && localidad.topografia.altitud_msnm >= 2100) {
    const severidadFrio = tempMinima <= -1.0 ? 4 : (tempMinima <= 1.0 ? 3 : 2);
    if (severidadFrio > nivelAlerta) {
      nivelAlerta = severidadFrio;
      queSucede = {
        vector: "FRIO_Y_HELADAS",
        evento: tempMinima <= 0 ? "HELADA_NEGRA_DESTRUCTIVA" : "DESCENSO_TERMICO_CRITICO",
        descripcion: `Mínima prevista de ${tempMinima}°C a ${localidad.topografia.altitud_msnm} msnm. Alto impacto agropecuario e hipotermia en viviendas vulnerables.`
      };
    }
  }

  // Si hay lluvia moderada acumulada (entre 10 y 25 mm) y no entró en otra categoría
  if (nivelAlerta === 1 && lluvia24h >= 10.0) {
    nivelAlerta = 2; // Vigilancia
    queSucede = {
      vector: "HIDROMETEOROLOGICO",
      evento: "PRECIPITACIÓN_MODERADA",
      descripcion: `Lluvia constante con acumulado de ${lluvia24h.toFixed(1)} mm en 24h. Mantener vigilancia preventiva en zonas de escurrimiento.`
    };
  }

  // Tiempos y Ventanas (¿CUÁNDO?)
  const tc = localidad.hidrologia.tc_horas || 6;
  const horaImpactoCresta = horaPico ? new Date(new Date(horaPico).getTime() + (tc * 3600000)).toISOString() : null;

  // Dimensión e Incomunicación (¿DE QUÉ TAMAÑO?)
  const esAccesoVulnerable = localidad.vulnerabilidad.acceso_vial === 'BRECHA' || localidad.vulnerabilidad.acceso_vial === 'CAMINO_TERRACERIA';
  let riesgoAislamiento = "BAJO";
  if (esAccesoVulnerable && nivelAlerta >= 3) {
    riesgoAislamiento = "CRÍTICO (Acceso por brecha/terracería con corte inminente de paso vehicular)";
  } else if (esAccesoVulnerable) {
    riesgoAislamiento = "MODERADO (Vía propensa a lodazal)";
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
      inicio_amenaza: horaInicio || "En curso o no prevista",
      pico_maximo_lluvia: horaPico || "No previsto",
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
      lluvia_acumulada_24h_mm: parseFloat(lluvia24h.toFixed(1)),
      umbral_deslave_local_mm: umbralDeslave24h
    }
  };
}