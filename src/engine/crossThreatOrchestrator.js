/**
 * SatRC V2.0 — Orquestador Multiamenaza
 * Basado en el acoplamiento no lineal de Richardson.
 * Recibe los 4 módulos especialistas y calcula el riesgo compuesto.
 */

import { evaluarHidrologico } from './hydroAdapter.js';
import { evaluarViento } from './windEvaluator.js';
import { evaluarTermico } from './thermalEvaluator.js';
import { evaluarConvectivo } from './convectiveEvaluator.js';

// Matriz de coeficientes de acoplamiento (gamma)
// Representa la sinergia entre amenazas (0 = no interactúan, 1 = máxima interacción)
const GAMMAS = {
  HIDRO_VIENTO: 0.20,    // Suelo saturado + viento = Árboles caídos (N3)
  HIDRO_TERMICO: 0.15,   // Lluvia + frío = Vías congeladas (N3)
  CONVECTIVO_VIENTO: 0.30, // Tormenta + viento = Downburst (N4)
  TERMICO_HIDRO: 0.10,   // Calor + sequía = Estrés hídrico
  VIENTO_TERMICO: 0.05   // Viento frío = Sensación térmica extrema
};

/**
 * Calcula el acoplamiento entre dos riesgos continuos.
 * Fórmula: gamma * (r1 - 1) * (r2 - 1)
 */
function calcularAcoplamiento(r1, r2, gamma) {
  return gamma * (r1 - 1) * (r2 - 1);
}

/**
 * H6.4a — Mapeo alineado con el diseño de los 4 módulos.
 * Cada módulo emite nivelContinuo entre [nivel, nivel+0.99]:
 *   - N1 → 1.0-1.99
 *   - N2 → 2.0-2.99
 *   - N3 → 3.0-3.99
 *   - N4 → 4.0
 * El mapeo anterior (1.5/2.5/3.5) causaba que N1 con vEqFinal alto
 * (nivelContinuo=1.5-1.99) se tradujera a N2 global.
 */
function mapearANivel(riesgoContinuo) {
  if (riesgoContinuo >= 4.0) return 4;
  if (riesgoContinuo >= 3.0) return 3;
  if (riesgoContinuo >= 2.0) return 2;
  return 1;
}

/**
 * Determina el vector dominante basado en los niveles continuos.
 * En caso de empate, el orden de prioridad es:
 * Hidrología > Viento > Térmico > Convectivo.
 */
function determinarVectorDominante(niveles) {
  const prioridad = [
    { nombre: 'HIDROLOGICO', valor: niveles.hidrologico },
    { nombre: 'VIENTO', valor: niveles.viento },
    { nombre: 'TERMICO', valor: niveles.termico },
    { nombre: 'CONVECTIVO', valor: niveles.convectivo }
  ];

  // Ordenar por valor descendente. Si empatan, mantener el orden de prioridad.
  prioridad.sort((a, b) => {
    if (b.valor !== a.valor) return b.valor - a.valor;
    return prioridad.indexOf(a) - prioridad.indexOf(b);
  });

  return prioridad[0].nombre;
}

/**
 * Genera las acciones operativas según el vector dominante y el nivel.
 */
function generarAcciones(vector, nivel) {
  const acciones = [];

  if (vector === 'HIDROLOGICO') {
    if (nivel >= 3) acciones.push('Restringir circulación en caminos de terracería.');
    if (nivel >= 4) acciones.push('Evacuar comunidades ribereñas y activar albergues.');
  } else if (vector === 'VIENTO') {
    if (nivel >= 3) acciones.push('Asegurar techos y evitar actividades al aire libre.');
    if (nivel >= 4) acciones.push('Evacuar estructuras ligeras y buscar refugio.');
  } else if (vector === 'TERMICO') {
    if (nivel >= 3) acciones.push('Habilitar albergues y proteger cultivos.');
    if (nivel >= 4) acciones.push('Activar protocolos de emergencia por frío extremo.');
  } else if (vector === 'CONVECTIVO') {
    if (nivel >= 3) acciones.push('Resguardar vehículos y cultivos del granizo.');
    if (nivel >= 4) acciones.push('Evacuación preventiva por riesgo de downburst.');
  }

  return acciones;
}

/**
 * Evalúa la multiamenaza de una localidad.
 * 
 * @param {Object} localidad - Datos de la localidad.
 * @param {Object} serieHoraria - Serie de consenso.
 * @param {Object} contexto - Contexto (ej. alertaSMN).
 * @returns {Object} Resultado multiamenaza con niveles por vector y nivel global.
 */

export function evaluarMultiamenaza(localidad, serieHoraria, contexto = {}) {
  // 1. Convertir el array de objetos a objeto de`` arrays (para los nuevos módulos)
  let serieParaNuevosModulos = serieHoraria;
  
  if (Array.isArray(serieHoraria) && serieHoraria.length > 0) {
    serieParaNuevosModulos = {
      time: serieHoraria.map(h => h.fecha_hora),
      lluvia_mm: serieHoraria.map(h => h.lluvia_mm || 0),
      temperatura_c: serieHoraria.map(h => h.temperatura_c || 15),
      sensacion_termica_c: serieHoraria.map(h => h.sensacion_termica_c || h.temperatura_c || 15),
      rafagas_kmh: serieHoraria.map(h => h.rafagas_kmh || 0),
      viento_kmh: serieHoraria.map(h => h.viento_kmh || 0),
      cobertura_nubosa_pct: serieHoraria.map(h => h.cobertura_nubosa_pct || 50),
      bulbo_humedo_c: serieHoraria.map(h => h.bulbo_humedo_c || 10),
      cape_jkg: serieHoraria.map(h => h.cape_jkg || 0),
      humedad_700hpa: serieHoraria.map(h => h.humedad_700hpa || 50),
      nivel_congelacion_m: serieHoraria.map(h => h.nivel_congelacion_m || 4000),
      presion_hpa: serieHoraria.map(h => h.presion_hpa || 1013),
      viento_700hpa: serieHoraria.map(h => h.viento_700hpa || 20)
    };
  }

  // 2. Ejecutar los 4 módulos
  const resHidro = evaluarHidrologico(localidad, serieHoraria, contexto);
  const resViento = evaluarViento(localidad, serieParaNuevosModulos);
  const resTermico = evaluarTermico(localidad, serieParaNuevosModulos);
  const resConvectivo = evaluarConvectivo(localidad, serieParaNuevosModulos);

  // 3. Extraer niveles continuos (con fallback a 1.0 si no existen)
  const rH = resHidro.nivel_alerta_continuo || resHidro.nivel_alerta || 1.0;
  const rV = resViento.nivel_alerta_continuo || resViento.nivel_alerta || 1.0;
  const rT = resTermico.nivel_alerta_continuo || resTermico.nivel_alerta || 1.0;
  const rC = resConvectivo.nivel_alerta_continuo || resConvectivo.nivel_alerta || 1.0;

  // 4. Nivel base (Máximo individual)
  let nivelBase = Math.max(rH, rV, rT, rC);

  // 5. Términos de Acoplamiento No Lineal
  let acoplamiento = 0;
  acoplamiento += calcularAcoplamiento(rH, rV, GAMMAS.HIDRO_VIENTO);
  acoplamiento += calcularAcoplamiento(rH, rT, GAMMAS.HIDRO_TERMICO);
  acoplamiento += calcularAcoplamiento(rC, rV, GAMMAS.CONVECTIVO_VIENTO);
  acoplamiento += calcularAcoplamiento(rT, rH, GAMMAS.TERMICO_HIDRO);
  acoplamiento += calcularAcoplamiento(rV, rT, GAMMAS.VIENTO_TERMICO);

  // 6. Riesgo Total
  const riesgoContinuo = Math.min(4.0, nivelBase + acoplamiento);

  // 7. Nivel discreto para el semáforo
  const nivelGlobal = mapearANivel(riesgoContinuo);

  // 8. Determinar vector dominante y acciones
  const niveles = { hidrologico: rH, viento: rV, termico: rT, convectivo: rC };
  let vectorDominante = determinarVectorDominante(niveles);

  // Si hubo acoplamiento significativo, marcar como vector compuesto.
  // ORDEN DE PRIORIDAD: Convectivo+Viento (Downburst N4) > Hidro+Viento (N3) > Hidro+Térmico (N3)
  if (acoplamiento > 0.5) {
    if (rC > 1.5 && rV > 1.5) {
      vectorDominante = 'CONVECTIVO_VIENTO';
    } else if (rH > 1.5 && rV > 1.5) {
      vectorDominante = 'HIDRO_VIENTO';
    } else if (rH > 1.5 && rT > 1.5) {
      vectorDominante = 'HIDRO_TERMICO';
    }
  }

  // H5.0.1 — Fix de coherencia vector/nivel.
  // Un Nivel 1 (Calma) NO tiene vector dominante: todos los vectores están
  // en su línea base (1.0). Elegir uno por margen ínfimo (ej. convectivo=1.05
  // vs hidro=1.00) es un falso positivo del desempate y confunde al operador
  // cuando audita la localidad. Se marca explícitamente como SIN_AMENAZA.
  // Ver 04_HISTORIAL_BUGS.md H-ORQ-05.
  if (nivelGlobal === 1) {
    vectorDominante = 'SIN_AMENAZA';
  }

  const acciones = generarAcciones(vectorDominante, nivelGlobal);

  // 9. Construir diagnóstico compuesto
  let titulo = resHidro.diagnostico?.titulo || "Condiciones Normales";
  let causa = "Sin riesgos significativos detectados.";

  const modulosConRiesgo = [
    { nombre: 'Hidrología', r: rH, diag: resHidro.diagnostico },
    { nombre: 'Viento', r: rV, diag: resViento.diagnostico },
    { nombre: 'Térmico', r: rT, diag: resTermico.diagnostico },
    { nombre: 'Convectivo', r: rC, diag: resConvectivo.diagnostico }
  ].sort((a, b) => b.r - a.r);

  if (modulosConRiesgo[0].r > 1.5) {
    titulo = modulosConRiesgo[0].diag?.titulo || titulo;
    causa = modulosConRiesgo[0].diag?.causa || causa;
  }

  // H5.0.2 — Coherencia nivel/diagnóstico por acoplamiento.
  // Si el nivel global subió por encima del máximo individual, el diagnóstico
  // debe decirlo explícitamente. Antes, un N2 por acoplamiento hidro+viento
  // se reportaba como "Vientos Normales" (título del vector dominante),
  // contradiciendo el nivel. Ahora se marca como compuesto por acoplamiento.
  // Ver 04_HISTORIAL_BUGS.md H-ORQ-06.
  const nivelDelVectorTop = Math.max(rH, rV, rT, rC);
  if (nivelGlobal > nivelDelVectorTop && nivelGlobal > 1) {
    titulo = `Nivel compuesto por acoplamiento (${titulo} + otras amenazas)`;
    causa = `El nivel ${nivelGlobal} se alcanza por acoplamiento entre múltiples amenazas. ${causa}`;
  }

  if (acoplamiento > 0.5) {
    titulo = `Riesgo Compuesto: ${titulo}`;
    causa = `Acoplamiento detectado entre múltiples amenazas. ${causa}`;
  }

  // 10. Retornar el objeto multiamenaza
  return {
    localidad_id: localidad.id,
    nombre: localidad.nombre,
    municipio: localidad.municipio,
    estado: localidad.estado,
    zona_id: localidad.zona_id,
    zona_nombre: localidad.zona_nombre,

    nivel_alerta_global: nivelGlobal,
    riesgo_continuo: parseFloat(riesgoContinuo.toFixed(2)),
    vector_dominante: vectorDominante,
    estado_alerta: ['NORMAL', 'VIGILANCIA', 'ALERTA_TEMPRANA', 'EMERGENCIA'][nivelGlobal - 1],
    color_alerta: ['#10B981', '#F59E0B', '#F97316', '#EF4444'][nivelGlobal - 1],

    niveles_por_vector: {
      hidrologico: parseFloat(rH.toFixed(2)),
      viento: parseFloat(rV.toFixed(2)),
      termico: parseFloat(rT.toFixed(2)),
      convectivo: parseFloat(rC.toFixed(2))
    },

    diagnostico: {
      titulo,
      causa,
      acoplamiento: parseFloat(acoplamiento.toFixed(2))
    },

    acciones_operativas: acciones,

    diagnosticos_por_vector: {
      hidrologico: resHidro.diagnostico,
      viento: resViento.diagnostico,
      termico: resTermico.diagnostico,
      convectivo: resConvectivo.diagnostico
    },

    donde: resHidro.donde,
    geografia: resHidro.geografia,
    tiempos: resHidro.tiempos,
    impactoSistemico: resHidro.impactoSistemico,
    protocolo: "Consulte al coordinador de Cáritas",
    sin_datos_regionales: resHidro.sin_datos_regionales || false
  };
}