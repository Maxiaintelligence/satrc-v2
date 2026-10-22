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

  it('7. Umbral dinámico: ráfaga de 52 km/h en Pachuca (2400m) da N1 (no N2)', () => {
    // H6.4: A >2200 msnm, umbral N2 sube a 50 km/h vEq.
    // Pachuca: 2400m, presión 760 hPa, temp 15°C → rho ≈ 0.92
    // vEq = 52 * sqrt(0.92/1.225) ≈ 45 km/h → con umbral 50 → N1
    const loc = mockLocalidad(2400, 'MESETA');
    const serie = mockSerie({ rafaga: 52, presion: 760, temp: 15 });
    
    const res = evaluarViento(loc, serie);
    expect(res.nivel_alerta).toBe(1);
    expect(res.datos_tecnicos.velocidad_equivalente_kmh).toBeLessThan(50);
  });

  it('8. Umbral dinámico: ráfaga de 52 km/h en el nivel del mar sigue dando N2', () => {
    // H6.4: A nivel del mar, umbral N2 se mantiene en 45 km/h.
    // 52 * sqrt(1.225/1.225) = 52 km/h → con umbral 45 → N2
    const loc = mockLocalidad(100, 'LLANURA_COSTERA');
    const serie = mockSerie({ rafaga: 52, presion: 1013, temp: 20 });
    
    const res = evaluarViento(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.datos_tecnicos.velocidad_equivalente_kmh).toBeGreaterThanOrEqual(45);
  });

    it('9. Clamp: N1 con vEqFinal=47.6 NO debe emitir nivelContinuo > 2.0', () => {
    // Bug detectado en H6.4a: N1 con vEqFinal=47.6 emitía nivelContinuo=2.25,
    // causando que el orquestador tratara como N2 una localidad que el motor veía como N1.
    // Con el clamp, N1 nunca supera 1.99.
    const loc = mockLocalidad(2400, 'MESETA');
    const serie = mockSerie({ rafaga: 55, presion: 760, temp: 15 });

    const res = evaluarViento(loc, serie);
    // vEqFinal ≈ 47.6 → nivel=1 (umbral 50 no alcanzado) → nivelContinuo debe ser 1.99
    expect(res.nivel_alerta).toBe(1);
    expect(res.nivel_alerta_continuo).toBeLessThan(2.0);
    expect(res.nivel_alerta_continuo).toBeGreaterThan(1.9);
  });

  it('10. Clamp: N2 con vEqFinal=59.5 NO debe emitir nivelContinuo > 3.0', () => {
    // Análogo para N2: si el motor ve N2, no puede emitir continuo > 2.99.
    const loc = mockLocalidad(500, 'LLANURA_COSTERA');  // altitud baja, umbral 45
    const serie = mockSerie({ rafaga: 60, presion: 1013, temp: 20 });

    const res = evaluarViento(loc, serie);
    // vEqFinal ≈ 59.5 (nivel mar) → N2 (45-65) → nivelContinuo debe ser <= 2.99
    expect(res.nivel_alerta).toBe(2);
    expect(res.nivel_alerta_continuo).toBeLessThan(3.0);
    expect(res.nivel_alerta_continuo).toBeGreaterThan(2.0);
  });

  // === H6.7: Test con fixture real ===
  it('11. Procesa el fixture real de Open-Meteo sin errores', () => {
    const fs = require('fs');
    const path = require('path');
    const { generarConsensoDeterminista } = require('../consensusEngine.js');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));
    const serieConsenso = generarConsensoDeterminista(fixture.hourly);

    // Convertir el array de objetos al formato que windEvaluator espera (objeto de arrays).
    // El orquestador hace esta conversión en producción (ver crossThreatOrchestrator.js).
    const serieParaViento = {
      time: serieConsenso.map(h => h.fecha_hora),
      rafagas_kmh: serieConsenso.map(h => h.rafagas_kmh || 0),
      viento_kmh: serieConsenso.map(h => h.viento_kmh || 0),
      presion_hpa: serieConsenso.map(h => h.presion_hpa || 1013),
      temperatura_c: serieConsenso.map(h => h.temperatura_c || 15)
    };

    const loc = mockLocalidad(2386, 'MESETA');
    const res = evaluarViento(loc, serieParaViento);

    expect(res.nivel_alerta).toBeGreaterThanOrEqual(1);
    expect(res.nivel_alerta).toBeLessThanOrEqual(4);
    expect(res.datos_tecnicos).toBeDefined();
    expect(res.datos_tecnicos).toHaveProperty('velocidad_equivalente_kmh');
  });

});