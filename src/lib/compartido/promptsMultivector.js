/**
 * SatRC V2.0 — Reglas de Prompts para SARA Multiamenaza (H5.5)
 */
export const REGLAS_MULTIVECTOR = `
17. LEE EL VECTOR DOMINANTE Y REDACTA SEGÚN SU LENGUAJE. Cada foco crítico en el JSON ahora incluye el campo "vector_dominante", "tipo_amenaza" y "niveles_por_vector". NO ASUMAS que todo es lluvia. Si el vector dominante es:
    - HIDROLOGICO: Habla de lluvias, deslaves, inundaciones, cortes viales. (Usa el campo "tipo_amenaza" para ser específico: DESLAVE_CRITICO, INUNDACION_FLUVIAL, CORTE_VIAL).
    - VIENTO: Habla de ráfagas, caída de árboles, daños a techos. (NUNCA menciones lluvias si el vector es viento puro).
    - TERMICO: Habla de frío extremo, heladas, nevadas, golpe de calor. (Usa el campo "tipo_amenaza" para distinguir entre NEVADA, HELADA_AGRICOLA, FRIO_EXTREMO, CALOR_EXTREMO).
    - CONVECTIVO: Habla de granizo, downbursts (rachas descendentes), tormentas severas. (Usa el campo "tipo_amenaza" para distinguir entre GRANIZO, DOWNBURST, SUPER_CELULA).
    - Vectores Compuestos (HIDRO_VIENTO, CONVECTIVO_VIENTO, HIDRO_TERMICO): Combina los lenguajes. Ej: "Lluvia + Viento = Árboles caídos". "Convectivo + Viento = Downburst". (El campo "tipo_amenaza" ya te da la combinación exacta).
`;

/**
 * PEND-06 (29/10/2026): la niebla NO dispara nivel de alerta.
 * Bajo DEC-011 (precisión sobre cobertura), la niebla es información contextual
 * que se menciona en el texto descriptivo de la localidad, NUNCA como amenaza
 * que justifique una alerta o acción de emergencia.
 *
 * Los focos críticos incluyen el campo `contexto.niebla` con:
 *   - activa: bool
 *   - visibilidadMinKm: número (ej. 0.2, 0.5)
 *   - persistenciaHoras: horas consecutivas
 *   - periodo: MADRUGADA | MAÑANA | TARDE | NOCHE | MIXTO
 *   - ventana: { inicio: 'HH:00', fin: 'HH:00', duracionHoras }
 */
export const REGLAS_CONTEXTO_NIEBLA = `
18. CONTEXTO DE NIEBLA (INFORMATIVO, NO DISPARA ALERTA). Los focos críticos pueden incluir el campo "contexto.niebla". Este campo es INFORMATIVO. La niebla por sí sola NO es una amenaza de nivel N3/N4 y NO justifica acciones de emergencia (evacuación, suspensión, restricción). Su tratamiento depende de "contexto.niebla.activa":
    - SI contexto.niebla.activa === true:
        * Menciona la niebla en el bloque descriptivo de la localidad (no en la Sección 0 de Decisión Operativa, no en la Sección II de Zonas que Requieren Atención, salvo que el nivel de la localidad sea >= 3 por OTRO vector).
        * Usa el campo "periodo" para orientar el lenguaje:
            - MADRUGADA: "niebla de madrugada" — mencionar como dato, sin recomendación específica.
            - MAÑANA: "niebla matinal" — mencionar con precaución para traslados escolares y hacia centros de trabajo.
            - TARDE: "niebla diurna inusual" — mencionar con lenguaje de precaución reforzada (puede indicar evento no habitual).
            - NOCHE: "niebla nocturna" — mencionar con precaución para traslados nocturnos en carreteras de montaña.
            - MIXTO: "niebla persistente" — mencionar con precaución reforzada (cubre múltiples períodos del día).
        * Menciona la visibilidad mínima y la duración:
            "Se prevé niebla [matinal/nocturna/persistente] con visibilidad mínima de [X] km durante [Y] horas."
        * NUNCA uses "emergencia", "evacuar", "suspender actividades" por niebla sola.
        * NUNCA eleves el nivel de la localidad por niebla sola.
    - SI contexto.niebla.activa === false o el campo no existe: NO menciones niebla.
    - Regla de coherencia: la niebla SOLO se eleva a amenaza si aparece ACOMPAÑADA de otro vector con nivel >= 3 (por ejemplo, lluvia fuerte + niebla persistente). En ese caso, la niebla se menciona como factor agravante del vector principal, no como amenaza independiente.
`;