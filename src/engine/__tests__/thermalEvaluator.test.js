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

  // === H6.7: Test con fixture real ===
  it('8. Procesa el fixture real de Open-Meteo sin errores', () => {
    const fs = require('fs');
    const path = require('path');
    const { generarConsensoDeterminista } = require('../consensusEngine.js');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));
    const serieConsenso = generarConsensoDeterminista(fixture.hourly);

    const serieParaTermico = {
      time: serieConsenso.map(h => h.fecha_hora),
      temperatura_c: serieConsenso.map(h => h.temperatura_c || 15),
      sensacion_termica_c: serieConsenso.map(h => h.sensacion_termica_c || 15),
      cobertura_nubosa_pct: serieConsenso.map(h => h.cobertura_nubosa_pct ?? 50),
      viento_kmh: serieConsenso.map(h => h.viento_kmh || 0),
      bulbo_humedo_c: serieConsenso.map(h => h.bulbo_humedo_c ?? 10),
      lluvia_mm: serieConsenso.map(h => h.lluvia_mm || 0),
      nivel_congelacion_m: serieConsenso.map(h => h.nivel_congelacion_m ?? 4000)
    };

    const loc = mockLocalidad(2386);
    const res = evaluarTermico(loc, serieParaTermico);

    expect(res.nivel_alerta).toBeGreaterThanOrEqual(1);
    expect(res.nivel_alerta).toBeLessThanOrEqual(4);
    expect(res.datos_tecnicos).toBeDefined();
  });
  
  // === H-TERM-01: reproducen el bug del nivel continuo fuera de rango ===
  // Contrato (ADR-008, 03_MOTOR_RIESGO.md §5.3): el continuo debe quedar en
  // [nivel_alerta, nivel_alerta + 0.99]. La fórmula actual
  //   nivelContinuo = 1 + (nivelFinal - 1) * peso
  // puede devolver valores por debajo del nivel discreto.
  // Estos tests fallan con el código pre-fix y pasan con el fix.

  it('9. Nevada (N3): continuo debe estar en [3.0, 3.99]', () => {
    const loc = mockLocalidad(2400);
    // Δh = 2800 - 2400 = 400 m < 500 → esNevada
    // bulbo 0.5 < 1, lluvia 5 > 0 → nevada
    // sensacionMin = 0 → pesoFrio ≈ 0.82
    const serie = mockSerie({
      temp: 1,
      sensacion: 0,
      nubosidad: 90,
      viento: 10,
      bulbo: 0.5,
      lluvia: 5,
      nivelCongelacion: 2800
    });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.nivel_alerta_continuo).toBeGreaterThanOrEqual(3.0);
    expect(res.nivel_alerta_continuo).toBeLessThanOrEqual(3.99);
  });

  it('10. Frío N2 (sensación -2°C): continuo debe estar en [2.0, 2.99]', () => {
    const loc = mockLocalidad(2000);
    // sensacionMin = -2 → nivelFrio = 2
    // Sin helada agrícola: nubosidad alta (80) evita el enfriamiento radiativo
    const serie = mockSerie({
      temp: 5,
      sensacion: -2,
      nubosidad: 80,
      viento: 10,
      bulbo: 10,
      lluvia: 0,
      nivelCongelacion: 4000
    });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.nivel_alerta_continuo).toBeGreaterThanOrEqual(2.0);
    expect(res.nivel_alerta_continuo).toBeLessThanOrEqual(2.99);
  });

  it('11. Frío N3 (sensación -8°C): continuo debe estar en [3.0, 3.99]', () => {
    const loc = mockLocalidad(2000);
    // sensacionMin = -8 < -5 → nivelFrio = 3
    const serie = mockSerie({
      temp: -5,
      sensacion: -8,
      nubosidad: 80,
      viento: 10,
      bulbo: 5,
      lluvia: 0,
      nivelCongelacion: 4000
    });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.nivel_alerta_continuo).toBeGreaterThanOrEqual(3.0);
    expect(res.nivel_alerta_continuo).toBeLessThanOrEqual(3.99);
  });

  it('12. Calor N2 (sensación 38°C): continuo debe estar en [2.0, 2.99]', () => {
    const loc = mockLocalidad(2000);
    // sensacionMax = 38 > 35 → nivelCalor = 2
    const serie = mockSerie({
      temp: 35,
      sensacion: 38,
      nubosidad: 30,
      viento: 10,
      bulbo: 25,
      lluvia: 0,
      nivelCongelacion: 4000
    });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.nivel_alerta_continuo).toBeGreaterThanOrEqual(2.0);
    expect(res.nivel_alerta_continuo).toBeLessThanOrEqual(2.99);
  });

  it('13. Calor N3 (sensación 45°C): continuo debe estar en [3.0, 3.99]', () => {
    const loc = mockLocalidad(2000);
    // sensacionMax = 45 > 42 → nivelCalor = 3
    const serie = mockSerie({
      temp: 40,
      sensacion: 45,
      nubosidad: 20,
      viento: 5,
      bulbo: 25,
      lluvia: 0,
      nivelCongelacion: 4000
    });
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.nivel_alerta_continuo).toBeGreaterThanOrEqual(3.0);
    expect(res.nivel_alerta_continuo).toBeLessThanOrEqual(3.99);
  });

  it('14. Frío N2 + Calor N2 simultáneos: frío gana, continuo en [2.0, 2.99]', () => {
    const loc = mockLocalidad(2000);
    // Ventana evaluada: 168-191 (24 h).
    //   168-179 (12 h): sensación -2 → frío N2
    //   180-191 (12 h): sensación 38 → calor N2
    // Desempate actual: nivelFrio >= nivelCalor → gana frío.
    // Con el bug actual el continuo se calcula como 1.89 (leído N1),
    // porque entra en la rama `if (nivelFrio > 1)` sin considerar
    // que el nivel discreto final es 2.
    const serie = {
      time: Array(192).fill('2026-10-21T12:00'),
      temperatura_c: [...Array(168).fill(15), ...Array(12).fill(5), ...Array(12).fill(35)],
      sensacion_termica_c: [...Array(168).fill(15), ...Array(12).fill(-2), ...Array(12).fill(38)],
      cobertura_nubosa_pct: [...Array(168).fill(50), ...Array(12).fill(80), ...Array(12).fill(30)],
      viento_kmh: Array(192).fill(10),
      bulbo_humedo_c: [...Array(168).fill(10), ...Array(12).fill(10), ...Array(12).fill(25)],
      lluvia_mm: Array(192).fill(0),
      nivel_congelacion_m: Array(192).fill(4000)
    };
    const res = evaluarTermico(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.nivel_alerta_continuo).toBeGreaterThanOrEqual(2.0);
    expect(res.nivel_alerta_continuo).toBeLessThanOrEqual(2.99);
  });

});