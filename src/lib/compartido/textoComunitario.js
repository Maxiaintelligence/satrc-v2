/**
 * Genera el pronóstico comunitario textual para el Monitor Público.
 * P15 (29/10/2026): Motor heurístico multiamenaza, determinista y con variaciones.
 */
export function generarPronosticoComunitario(localidad, evaluacion, datosConsenso, alertaSMN) {
  if (!localidad) return "";
  
  const nombre = localidad.nombre;
  const hoy = new Date().toISOString().slice(0, 10);
  const semillaStr = nombre + hoy + (evaluacion?.nivel_alerta || 1);

  function elegirVariante(seed, totalVariantes) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    return Math.abs(hash) % totalVariantes;
  }

  let contextoSMN = "";
  if (alertaSMN && alertaSMN.activo) {
    contextoSMN = `Aviso del SMN: ${alertaSMN.titulo}. `;
  }

  // 1. RIESGO EXTREMO (N3/N4)
  if (evaluacion && evaluacion.nivel_alerta >= 3) {
    const nivel = evaluacion.nivel_alerta;
    const estado = nivel === 4 ? 'Emergencia' : 'Alerta temprana';
    const vector = evaluacion.vector_dominante;
    
    let amenaza = "condiciones meteorológicas adversas";
    if (vector === 'HIDROLOGICO') amenaza = "riesgo de deslaves o inundaciones";
    if (vector === 'VIENTO') amenaza = "ráfagas de viento peligrosas";
    if (vector === 'TERMICO') amenaza = "temperaturas extremas";
    if (vector === 'CONVECTIVO') amenaza = "tormentas severas con granizo";
    
    const vars = [
      `${estado} en ${nombre} por ${amenaza}. Siga las indicaciones de Protección Civil.`,
      `Condiciones peligrosas en ${nombre} por ${amenaza}. Tome precauciones extremas.`,
      `Alerta por ${amenaza} en ${nombre}. Evite salir de su hogar si no es necesario.`
    ];
    return vars[elegirVariante(semillaStr + "N3", vars.length)];
  }

  // 2. VIGILANCIA (N2)
  if (evaluacion && evaluacion.nivel_alerta === 2) {
    const vector = evaluacion.vector_dominante;
    let motivo = "condiciones climáticas cambiantes";
    if (vector === 'HIDROLOGICO') motivo = "lluvias previstas";
    if (vector === 'VIENTO') motivo = "ráfagas de viento";
    if (vector === 'TERMICO') motivo = "cambios de temperatura";
    
    const vars = [
      `Vigilancia activa en ${nombre} por ${motivo}. Manténgase atento a los cambios.`,
      `Nivel de precaución en ${nombre} debido a ${motivo}. Tome precauciones moderadas.`
    ];
    return vars[elegirVariante(semillaStr + "N2", vars.length)];
  }

  // 3. CLIMA MULTIVARIABLE (N1)
  let lluvia24h = 0, rafagaMax = 0, tempMin = 99, hayNiebla = false;
  if (datosConsenso && datosConsenso.length >= 192) {
    const ventana = datosConsenso.slice(168, 192);
    lluvia24h = ventana.reduce((acc, h) => acc + (h.lluvia_mm || 0), 0);
    rafagaMax = Math.max(...ventana.map(h => h.rafagas_kmh || 0));
    tempMin = Math.min(...ventana.map(h => h.temperatura_c || 99));
    hayNiebla = ventana.some(h => (h.visibility_km || 10) <= 2.0);
  }

  let condiciones = [];
  if (tempMin <= 5) condiciones.push(`frío (mínima de ${tempMin.toFixed(0)}°C)`); // Corregido: minúscula
  if (rafagaMax >= 40) condiciones.push(`vientos fuertes (ráfagas de ${rafagaMax.toFixed(0)} km/h)`);
  if (lluvia24h >= 5) condiciones.push("lluvias");
  if (hayNiebla) condiciones.push("niebla");

  if (condiciones.length === 1) {
    const c = condiciones[0];
    // Corregido: concordancia "Se esperan" si la condición es plural (lluvias, vientos)
    const esPlural = c.includes("lluvias") || c.includes("vientos") || c.includes("niebla");
    const verbo = esPlural ? "Se esperan" : "Se espera";
    const vars = [
      `${contextoSMN}${verbo} ${c} en ${nombre}. Tome precauciones al salir.`,
      `${contextoSMN}Hoy hay ${c} en ${nombre}. Manténgase informado.`
    ];
    return vars[elegirVariante(semillaStr + "M1", vars.length)];
  } else if (condiciones.length > 1) {
    let textoCond = "";
    if (condiciones.length === 2) {
      textoCond = `${condiciones[0]} y ${condiciones[1]}`;
    } else {
      const ultimo = condiciones.pop();
      textoCond = `${condiciones.join(", ")} y ${ultimo}`;
    }
    textoCond = textoCond.charAt(0).toUpperCase() + textoCond.slice(1);
    
    const vars = [
      `${contextoSMN}Se esperan ${textoCond} en ${nombre}. Tome precauciones.`,
      `${contextoSMN}Clima variable en ${nombre} con ${textoCond}. Manténgase atento.`
    ];
    return vars[elegirVariante(semillaStr + "M2", vars.length)];
  }

  // 4. DESPEJADO
  const vars = [
    `${contextoSMN}Cielo despejado en ${nombre}. Sin lluvias ni alertas activas.`,
    `${contextoSMN}Clima seco y estable en ${nombre}. Disfrute de un día tranquilo.`,
    `${contextoSMN}Sin precipitaciones en ${nombre}. Condiciones normales.`
  ];
  return vars[elegirVariante(semillaStr + "CLEAR", vars.length)];
}