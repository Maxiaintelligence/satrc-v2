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