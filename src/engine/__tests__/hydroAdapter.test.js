import { describe, it, expect } from 'vitest';
import { evaluarHidrologico } from '../hydroAdapter.js';

// Helper para crear mocks de localidad
function mockLocalidad(overrides = {}) {
  return {
    id: 'TEST_001',
    nombre: 'Test Localidad',
    municipio: 'Test',
    estado: 'Puebla',
    zona_id: 'HUA',
    zona_nombre: 'Test Zona',
    coords: { lat: 20.0, lon: -98.0 },
    topografia: {
      altitud_msnm: 1500,
      pendiente_max_deg: 10,
      relieve: 'MESETA',
      twi: 8
    },
    hidrologia: {
      subcuenca_cve: 'RH27Bb',
      subcuenca_nom: 'R. Test',
      posicion: 'BAJA',
      distancia_cauce_km: 20,
      tc_horas: 6,
      poblacion_aguas_arriba: 0
    },
    vulnerabilidad: {
      poblacion: 1000,
      marginacion: 'MEDIO',
      acceso_vial: 'CARRETERA_FEDERAL',
      dist_hospital_km: 10
    },
    ...overrides
  };
}

// Helper para crear mocks de serie horaria
function mockSerie({ horas = 192, lluvia_mm = 0, temperatura_c = 18, visibilidad_km = 10 } = {}) {
  return Array.from({ length: horas }, (_, i) => ({
    fecha_hora: `2026-10-20T${String(i % 24).padStart(2, '0')}:00`,
    lluvia_mm,
    temperatura_c,
    viento_kmh: 10,
    rafagas_kmh: 15,
    humedad_relativa_pct: 60,
    visibility_km: visibilidad_km
  }));
}

describe('hydroAdapter.js', () => {
  it('1. Mantenimiento N1: Localidad sin lluvia ni riesgo', () => {
    const loc = mockLocalidad();
    const serie = mockSerie({ lluvia_mm: 0 });
    const res = evaluarHidrologico(loc, serie);
    
    expect(res.nivel_alerta).toBe(1);
    expect(res.nivel_alerta_continuo).toBe(1.0);
    expect(res.modulo).toBe('hidrologico');
  });

  it('2. Proximidad N3.1: Saturación de 30 mm en ladera con terracería', () => {
    // Ladera con pendiente de 30° Y terracería (para forzar Regla 5, N3)
    const loc = mockLocalidad({ 
      zona_id: 'HUA',
      topografia: { altitud_msnm: 1500, pendiente_max_deg: 30, relieve: 'LADERA', twi: 10 },
      vulnerabilidad: {
        poblacion: 1000,
        marginacion: 'ALTO',
        acceso_vial: 'CAMINO_TERRACERIA',
        dist_hospital_km: 30
      }
    });
    
    // 168 horas sin lluvia (API = 0) + 24 horas con 1.25 mm/h → 30 mm de lluvia total
    const serieSeca = mockSerie({ horas: 168, lluvia_mm: 0 });
    const serieLluvia = mockSerie({ horas: 24, lluvia_mm: 1.25 });
    const serie = [...serieSeca, ...serieLluvia];
    
    const res = evaluarHidrologico(loc, serie);
    
    // El motor da N3 por Regla 5 (terracería + 30mm de lluvia).
    // El adaptador debe dar un nivel continuo bajo (cerca de 3.0, no de 4.0).
    expect(res.nivel_alerta).toBe(3);
    expect(res.nivel_alerta_continuo).toBeGreaterThanOrEqual(3.0);
    expect(res.nivel_alerta_continuo).toBeLessThan(3.5);
  });

  it('3. Proximidad a N4: Saturación de 64 mm en ladera', () => {
    // Ladera con pendiente de 30° y mucha lluvia
    const loc = mockLocalidad({ 
      zona_id: 'HUA',
      topografia: { altitud_msnm: 1500, pendiente_max_deg: 30, relieve: 'LADERA', twi: 10 }
    });
    // 3mm/h * 24 = 72mm de lluvia + API previo → saturación > 65mm
    const serie = mockSerie({ lluvia_mm: 3.0 });
    const res = evaluarHidrologico(loc, serie);
    
    // Debería ser N3 o N4, pero el nivel continuo debe ser alto
    expect(res.nivel_alerta_continuo).toBeGreaterThan(3.5);
  });

  it('4. Emergencia N4.0: Saturación extrema en ladera crítica', () => {
    // Ladera con pendiente de 50° (Regla 2, N4 directo)
    const loc = mockLocalidad({ 
      zona_id: 'HUA',
      topografia: { altitud_msnm: 1500, pendiente_max_deg: 50, relieve: 'LADERA', twi: 13 }
    });
    // 5mm/h * 24 = 120mm de lluvia → saturación masiva
    const serie = mockSerie({ lluvia_mm: 5.0 });
    const res = evaluarHidrologico(loc, serie);
    
    expect(res.nivel_alerta).toBe(4);
    expect(res.nivel_alerta_continuo).toBe(4.0);
  });

  it('5. Preservación del diagnóstico original', () => {
    const loc = mockLocalidad();
    const serie = mockSerie({ lluvia_mm: 1.0 });
    const res = evaluarHidrologico(loc, serie);
    
    // Verificar que el adaptador preserva los campos del motor original
    expect(res).toHaveProperty('localidad_id');
    expect(res).toHaveProperty('nombre');
    expect(res).toHaveProperty('diagnostico');
    expect(res).toHaveProperty('impactoSistemico');
    expect(res).toHaveProperty('geografia');
    expect(res).toHaveProperty('donde');
    expect(res).toHaveProperty('tiempos');
    expect(res).toHaveProperty('protocolo');
  });

  it('6. Fallback: Serie vacía devuelve N1', () => {
    const loc = mockLocalidad();
    const res = evaluarHidrologico(loc, []);
    
    expect(res.nivel_alerta).toBe(1);
    expect(res.nivel_alerta_continuo).toBe(1.0);
  });

  it('7. proximidad_umbral_n4 es null en N1', () => {
    const loc = mockLocalidad();
    const serie = mockSerie({ lluvia_mm: 0 });
    const res = evaluarHidrologico(loc, serie);
    expect(res.nivel_alerta).toBe(1);
    expect(res.datos_tecnicos.proximidad_umbral_n4).toBeNull();
  });

  it('8. proximidad_umbral_n4 es null en N2', () => {
    const loc = mockLocalidad();
    // 0.5 mm/h × 24h = 12 mm → Regla 6 dispara N2 (lluvia >= 8mm)
    const serie = mockSerie({ lluvia_mm: 0.5 });
    const res = evaluarHidrologico(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.datos_tecnicos.proximidad_umbral_n4).toBeNull();
  });

  it('9. proximidad_umbral_n4 es null en N4', () => {
    const loc = mockLocalidad({
      zona_id: 'HUA',
      topografia: { altitud_msnm: 1500, pendiente_max_deg: 50, relieve: 'LADERA', twi: 13 }
    });
    // 5 mm/h × 24h = 120 mm → Regla 2 dispara N4 (pendiente >= 45°, saturación >= 65mm)
    const serie = mockSerie({ lluvia_mm: 5.0 });
    const res = evaluarHidrologico(loc, serie);
    expect(res.nivel_alerta).toBe(4);
    expect(res.datos_tecnicos.proximidad_umbral_n4).toBeNull();
  });

  it('10. proximidad_umbral_n4 es número entre 0 y 1 en N3 por deslave moderado', () => {
    const loc = mockLocalidad({
      zona_id: 'HUA',
      topografia: { altitud_msnm: 1500, pendiente_max_deg: 30, relieve: 'LADERA', twi: 10 }
    });
    // 3 mm/h × 24h = 72 mm → Regla 3 dispara N3 (pendiente 25-44°, saturación >= 65mm)
    const serie = mockSerie({ lluvia_mm: 3.0 });
    const res = evaluarHidrologico(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.datos_tecnicos.proximidad_umbral_n4).not.toBeNull();
    expect(typeof res.datos_tecnicos.proximidad_umbral_n4).toBe('number');
    expect(res.datos_tecnicos.proximidad_umbral_n4).toBeGreaterThanOrEqual(0);
    expect(res.datos_tecnicos.proximidad_umbral_n4).toBeLessThanOrEqual(1);
  });

});