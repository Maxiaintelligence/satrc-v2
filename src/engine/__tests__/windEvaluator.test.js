import { describe, it, expect } from 'vitest';
import { evaluarViento } from '../windEvaluator.js';

// Helper para crear mocks de localidad
function mockLocalidad(altitud, relieve = 'MESETA') {
  return { topografia: { altitud_msnm: altitud, relieve } };
}

// Helper para crear mocks de serie horaria
function mockSerie({ rafaga = 50, sostenido = 20, presion = 1013, temp = 15 }) {
  // Creamos 192 horas de datos (7 dias pasados + hoy)
  return {
    time: Array(192).fill('2026-10-21T12:00'),
    rafagas_kmh: Array(192).fill(rafaga),
    viento_kmh: Array(192).fill(sostenido),
    presion_hpa: Array(192).fill(presion),
    temperatura_c: Array(192).fill(temp)
  };
}

describe('windEvaluator.js', () => {
  it('1. Calma en Pachuca (alta altitud): 50 km/h de ráfaga es brisa normal', () => {
    // Pachuca a 2400m: Presión ~760 hPa, Temp ~15°C (Densidad ~0.92)
    // vEq = 50 * sqrt(0.92/1.225) = ~43 km/h -> N1
    const loc = mockLocalidad(2400, 'MESETA');
    const serie = mockSerie({ rafaga: 50, presion: 760, temp: 15 });
    
    const res = evaluarViento(loc, serie);
    expect(res.nivel_alerta).toBe(1);
    expect(res.datos_tecnicos.velocidad_equivalente_kmh).toBeLessThan(45);
  });

  it('2. Vigilancia en el nivel del mar: 50 km/h de ráfaga es más peligroso', () => {
    // A nivel del mar: Presión ~1013 hPa, Temp ~25°C (Densidad ~1.18)
    // vEq = 50 * sqrt(1.18/1.225) = ~49 km/h -> N2
    const loc = mockLocalidad(100, 'LLANURA_COSTERA');
    const serie = mockSerie({ rafaga: 50, presion: 1013, temp: 25 });
    
    const res = evaluarViento(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.datos_tecnicos.velocidad_equivalente_kmh).toBeGreaterThan(45);
  });

  it('3. Alerta por Vientos Fuertes (N3)', () => {
    const loc = mockLocalidad(2000);
    const serie = mockSerie({ rafaga: 80, presion: 800, temp: 20 }); // vEq ~72 km/h
    const res = evaluarViento(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.diagnostico.titulo).toMatch(/Vientos Fuertes/i);
  });

  it('4. Emergencia por Vientos Destructivos (N4)', () => {
    const loc = mockLocalidad(2000);
    const serie = mockSerie({ rafaga: 120, presion: 800, temp: 20 }); // vEq ~108 km/h
    const res = evaluarViento(loc, serie);
    expect(res.nivel_alerta).toBe(4);
    expect(res.vector_dominante).toBe('VIENTO_DESTRUCTIVO');
  });

  it('5. Factor de Ráfaga: viento de 10, ráfaga de 50', () => {
    const loc = mockLocalidad(1000);
    const serie = mockSerie({ rafaga: 50, sostenido: 10 });
    const res = evaluarViento(loc, serie);
    expect(res.datos_tecnicos.factor_rafaga).toBe(5.0);
  });

  it('6. Fallback: Sin datos de viento, retorna N1', () => {
    const loc = mockLocalidad(2400);
    const serie = { time: [] }; // Sin datos
    const res = evaluarViento(loc, serie);
    expect(res.nivel_alerta).toBe(1);
  });
});