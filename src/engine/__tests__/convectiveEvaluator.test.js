import { describe, it, expect } from 'vitest';
import { evaluarConvectivo } from '../convectiveEvaluator.js';

// Helper para crear mocks de localidad
function mockLocalidad(altitud = 2000) {
  return { topografia: { altitud_msnm: altitud, relieve: 'MESETA' } };
}

// Helper para crear mocks de serie horaria
function mockSerie({
  cape = 500,
  humedad700 = 60,
  lluvia = 0,
  nivelCongelacion = 4000,
  viento700 = 20,
  viento10 = 10
} = {}) {
  return {
    time: Array(192).fill('2026-10-21T12:00'),
    cape_jkg: Array(192).fill(cape),
    humedad_700hpa: Array(192).fill(humedad700),
    lluvia_mm: Array(192).fill(lluvia),
    nivel_congelacion_m: Array(192).fill(nivelCongelacion),
    viento_700hpa: Array(192).fill(viento700),
    viento_kmh: Array(192).fill(viento10)
  };
}

describe('convectiveEvaluator.js', () => {
  it('1. Atmósfera estable: CAPE 500, sin lluvia → N1', () => {
    const loc = mockLocalidad(2000);
    const serie = mockSerie({ cape: 500, lluvia: 0 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(1);
    expect(res.vector_dominante).toBe('CONVECTIVO_NORMAL');
  });

  it('2. Vigilancia por inestabilidad: CAPE 1200 → N2', () => {
    const loc = mockLocalidad(2000);
    const serie = mockSerie({ cape: 1200, lluvia: 2, humedad700: 70 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.vector_dominante).toBe('TORMENTA_DISPERSA');
  });

  it('3. Alerta por granizo: CAPE alto + capa de fusión pequeña → N3', () => {
    const loc = mockLocalidad(2400);
    // Nivel de congelación a 2800m, localidad a 2400m → Δh = 400m (granizo llega intacto)
    const serie = mockSerie({ cape: 1800, lluvia: 15, nivelCongelacion: 2800, humedad700: 70 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.vector_dominante).toBe('GRANIZO');
    expect(res.datos_tecnicos.espesor_capa_fusion_m).toBeLessThan(1000);
  });

  it('4. Alerta por downburst: CAPE alto + aire seco en capas medias → N3', () => {
    const loc = mockLocalidad(2000);
    // Humedad baja (30%) y shear alto (viento700 40 km/h vs viento10 10 km/h)
    const serie = mockSerie({ cape: 2000, humedad700: 30, lluvia: 5, viento700: 40, viento10: 10 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.vector_dominante).toBe('DOWNBURST');
    expect(res.datos_tecnicos.potencial_desplome).toBeGreaterThan(100);
  });

  it('5. Emergencia por supercélula: CAPE extremo + shear extremo → N4', () => {
    const loc = mockLocalidad(2000);
    const serie = mockSerie({ cape: 3500, humedad700: 20, lluvia: 20, viento700: 60, viento10: 10 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(4);
    expect(res.vector_dominante).toBe('SUPERCELULA');
  });

  it('6. No es granizo si la capa de fusión es grande (derretimiento)', () => {
    const loc = mockLocalidad(2000);
    // Nivel de congelación a 5000m, localidad a 2000m → Δh = 3000m (el granizo se derrite)
    const serie = mockSerie({ cape: 1800, lluvia: 15, nivelCongelacion: 5000, humedad700: 70 });
    const res = evaluarConvectivo(loc, serie);
    // Debe ser N2 (vigilancia) o N1, pero no N3 por granizo
    expect(res.nivel_alerta).toBeLessThan(3);
  });

  it('7. Fallback: Sin datos convectivos, retorna N1', () => {
    const loc = mockLocalidad(2000);
    const serie = { time: [] };
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(1);
  });
});