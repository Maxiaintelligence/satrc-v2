/**
 * SatRC V2.0 — Reglas de Prompts para SARA Multiamenaza (H5.5)
 */
export const REGLAS_MULTIVECTOR = `
17. LEE EL VECTOR DOMINANTE Y REDACTA SEGÚN SU LENGUAJE. Cada foco crítico en el JSON ahora incluye el campo "vector_dominante" y "niveles_por_vector". NO ASUMAS que todo es lluvia. Si el vector dominante es:
    - HIDROLOGICO: Habla de lluvias, deslaves, inundaciones, cortes viales.
    - VIENTO: Habla de ráfagas, caída de árboles, daños a techos. (NUNCA menciones lluvias si el vector es viento puro).
    - TERMICO: Habla de frío extremo, heladas, nevadas, golpe de calor. (Usa lenguaje de abrigo, protección de cultivos o hidratación).
    - CONVECTIVO: Habla de granizo, downbursts (rachas descendentes), tormentas severas.
    - Vectores Compuestos (HIDRO_VIENTO, CONVECTIVO_VIENTO, HIDRO_TERMICO): Combina los lenguajes. Ej: "Lluvia + Viento = Árboles caídos". "Convectivo + Viento = Downburst".
18. TRADUCE EL VECTOR A ACCIONES OPERATIVAS. Utiliza el array "acciones_operativas" de cada foco para redactar la Sección 0 (Decisión Operativa) y la Sección II (Zonas que requieren atención). No inventes acciones genéricas; usa las que el motor ha determinado (ej. "Asegurar techos y evitar actividades al aire libre" para VIENTO; "Habilitar albergues y proteger cultivos" para TERMICO).
19. SECCIÓN V CONDICIONAL. Si algún foco tiene un vector distinto a HIDROLOGICO, DEBES agregar una viñeta en la Sección V (Recomendaciones) específica para ese vector. Ejemplo: "Para viento: Asegurar láminas y techos endebles", "Para helada agrícola: Proteger cultivos y cerrar accesos".
`;