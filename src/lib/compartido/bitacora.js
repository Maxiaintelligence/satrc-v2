/**
 * SatRC V2.0 — Generador de resumen multivector para la bitácora
 * 
 * Extrae el conteo y el vector dominante de un array de evaluaciones
 * para guardarlo en la bitácora SHA-256.
 */

const NOMBRES_VECTOR = {
  HIDROLOGICO: 'hidro',
  VIENTO: 'viento',
  TERMICO: 'termico',
  CONVECTIVO: 'conv',
  // Vectores compuestos se agrupan en su componente principal o se marcan como compuestos
  HIDRO_VIENTO: 'viento',
  CONVECTIVO_VIENTO: 'conv',
  HIDRO_TERMICO: 'termico',
  SIN_AMENAZA: 'ninguno'
};

export function generarResumenMultivector(evaluaciones) {
  if (!evaluaciones || evaluaciones.length === 0) {
    return 'N4: 0 | N3: 0 | N2: 0 | N1: 0 | Top-1: Ninguno';
  }

  // 1. Encontrar el top-1 (ya vienen ordenadas por severidad descendente)
  const top1 = evaluaciones[0];
  const top1Str = `${top1.vector_dominante} (${top1.nombre})`;

  // 2. Contadores por nivel
  const conteo = {
    4: { hidro: 0, viento: 0, termico: 0, conv: 0, total: 0 },
    3: { hidro: 0, viento: 0, termico: 0, conv: 0, total: 0 },
    2: { hidro: 0, viento: 0, termico: 0, conv: 0, total: 0 },
    1: { hidro: 0, viento: 0, termico: 0, conv: 0, total: 0 }
  };


  // 3. Acumular
  evaluaciones.forEach(ev => {
    const nivel = ev.nivel_alerta;
    if (conteo[nivel]) {
      conteo[nivel].total++;
      const v = ev.vector_dominante;

      // Un compuesto suma a sus dos componentes
      if (v === 'HIDROLOGICO' || v === 'HIDRO_VIENTO' || v === 'HIDRO_TERMICO') {
        conteo[nivel].hidro++;
      }
      if (v === 'VIENTO' || v === 'HIDRO_VIENTO' || v === 'CONVECTIVO_VIENTO') {
        conteo[nivel].viento++;
      }
      if (v === 'TERMICO' || v === 'HIDRO_TERMICO') {
        conteo[nivel].termico++;
      }
      if (v === 'CONVECTIVO' || v === 'CONVECTIVO_VIENTO') {
        conteo[nivel].conv++;
      }
    }
  });


  // 4. Construir el string
  const partes = [];
  
  // Solo mostramos el desglose de N4 y N3 si existen
  if (conteo[4].total > 0) {
    partes.push(`N4 [hidro:${conteo[4].hidro}, viento:${conteo[4].viento}, termico:${conteo[4].termico}, conv:${conteo[4].conv}]`);
  } else {
    partes.push('N4: 0');
  }

  if (conteo[3].total > 0) {
    partes.push(`N3 [hidro:${conteo[3].hidro}, viento:${conteo[3].viento}, termico:${conteo[3].termico}, conv:${conteo[3].conv}]`);
  } else {
    partes.push('N3: 0');
  }

  partes.push(`N2: ${conteo[2].total}`);
  partes.push(`N1: ${conteo[1].total}`);

  return `${partes.join(' | ')} | Top-1: ${top1Str}`;
}