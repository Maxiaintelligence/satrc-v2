import { describe, it, expect } from 'vitest';
import { evaluarTermico } from '../thermalEvaluator.js';

// Helper para crear mocks de localidad
function mockLocalidad(altitud = 2000) {
  return { topografia: { altitud_msnm: altitud, relieve: 'MESETA' } };
}

// Helper para crear mocks de serie horaria
function mockSerie({
  temp = 15,
  sensacion = 15,
  nubosidad = 50,
  viento = 10,
  bulbo = 10,
  lluvia = 0,
  nivelCongelacion = 4000
} = {}) {
  return {
    time: Array(192).fill('2026-10-21T12:00'),
    temperatura_c: Array(192).fill(temp),
    sensacion_termica_c: Array(192).fill(sensacion),
    cobertura_nubosa_pct: Array(192).fill(nubosidad),
    viento_kmh: Array(192).fill(viento),
    bulbo_humedo_c: Array(192).fill(bulbo),
    lluvia_mm: Array(192).fill(lluvia),
    nivel_congelacion_m: Array(192).fill(nivelCongelacion)
  };
}

describe('thermalEvaluator.js', () => {
  it('1. Calma térmica: 15°C sin riesgos', () => {
    const loc = mockLocalidad();
    const serie = mockSerie({ temp: 15, sensacion: 15 });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(1);
    expect(res.vector_dominante).toBe('TERMICO_NORMAL');
  });

  it('2. Frío extremo: Sensación de -3°C debe dar N2 (Vigilancia)', () => {
    const loc = mockLocalidad();
    const serie = mockSerie({ temp: 0, sensacion: -3, nubosidad: 80 });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.vector_dominante).toBe('FRIO_EXTREMO');
  });

  it('3. Frío severo: Sensación de -8°C debe dar N3 (Alerta)', () => {
    const loc = mockLocalidad();
    const serie = mockSerie({ temp: -5, sensacion: -8, nubosidad: 80 });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.diagnostico.titulo).toMatch(/Frío Extremo/);
  });

  it('4. Helada Agrícola: +2°C con cielo despejado y sin viento', () => {
    const loc = mockLocalidad(2400);
    // Aire a 2m = 2°C, cielo despejado (5%), viento calmo (2 km/h)
    // Grass Minimum = 2 - 3.5 = -1.5°C → Alerta N3
    const serie = mockSerie({ temp: 2, sensacion: 2, nubosidad: 5, viento: 2 });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.vector_dominante).toBe('HELADA_AGRICOLA');
    expect(res.datos_tecnicos.temp_superficie_estimada_c).toBeLessThan(0);
  });

  it('5. Nevada: Precipitación con bulbo húmedo bajo y capa de fusión pequeña', () => {
    const loc = mockLocalidad(2400);
    // Bulbo húmedo = 0.5°C, nivel congelación = 2700m → Δh = 300m
    const serie = mockSerie({ 
      temp: 1, sensacion: -1, nubosidad: 90, 
      bulbo: 0.5, lluvia: 5, nivelCongelacion: 2700 
    });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.vector_dominante).toBe('NEVADA');
    expect(res.datos_tecnicos.es_nevada).toBe(true);
  });

  it('6. Calor extremo: Sensación de 45°C debe dar N3 (Golpe de calor)', () => {
    const loc = mockLocalidad();
    const serie = mockSerie({ temp: 40, sensacion: 45, nubosidad: 20 });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.vector_dominante).toBe('CALOR_EXTREMO');
  });

  it('7. Fallback: Sin datos térmicos, retorna N1', () => {
    const loc = mockLocalidad();
    const serie = { time: [] };
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(1);
  });
});