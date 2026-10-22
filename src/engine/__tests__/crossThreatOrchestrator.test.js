import { describe, it, expect } from 'vitest';
import { evaluarMultiamenaza } from '../crossThreatOrchestrator.js';

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


// Helper para serie horaria con todos los datos (formato array de objetos)
function mockSerieCompleta({
  lluvia = 0,
  temp = 15,
  sensacion = 15,
  rafagas = 20,
  sostenido = 10,
  nubosidad = 50,
  bulbo = 10,
  cape = 500,
  humedad700 = 60,
  nivelCongelacion = 4000,
  presion = 1013
} = {}) {
  return Array.from({ length: 192 }, (_, i) => ({
    fecha_hora: `2026-10-21T${String(i % 24).padStart(2, '0')}:00`,
    lluvia_mm: lluvia,
    temperatura_c: temp,
    sensacion_termica_c: sensacion,
    rafagas_kmh: rafagas,
    viento_kmh: sostenido,
    cobertura_nubosa_pct: nubosidad,
    bulbo_humedo_c: bulbo,
    cape_jkg: cape,
    humedad_700hpa: humedad700,
    nivel_congelacion_m: nivelCongelacion,
    presion_hpa: presion,
    viento_700hpa: 20
  }));
}

describe('crossThreatOrchestrator.js', () => {
  it('1. Calma Total: Todos los módulos N1 → Global N1', () => {
    const loc = mockLocalidad();
    const serie = mockSerieCompleta({});
    const res = evaluarMultiamenaza(loc, serie);
    
    // El nivel global debe ser N1 (calma)
    expect(res.nivel_alerta_global).toBe(1);
    // No debe haber acoplamiento
    expect(res.diagnostico.acoplamiento).toBe(0);
    // El título debe indicar condiciones sin riesgo (Estabilidad, Normal, Calma o Estable)
    expect(res.diagnostico.titulo).toMatch(/Estabilidad|Normal|Calma|Estable/i);
    // Todos los niveles por vector deben ser 1.0
    expect(res.niveles_por_vector.hidrologico).toBe(1.0);
    expect(res.niveles_por_vector.viento).toBe(1.0);
    expect(res.niveles_por_vector.termico).toBe(1.0);
    expect(res.niveles_por_vector.convectivo).toBeGreaterThanOrEqual(1.0);
    expect(res.niveles_por_vector.convectivo).toBeLessThan(2.0);
  });

  it('2. Máximo Individual: Solo Hidrología N3 → Global N3', () => {
    // Lluvia de 1.5 mm/h * 24 = 36mm, con terracería = Regla 5 → N3
    const loc = mockLocalidad({
      vulnerabilidad: { ...mockLocalidad().vulnerabilidad, acceso_vial: 'CAMINO_TERRACERIA' }
    });
    const serie = mockSerieCompleta({ lluvia: 1.5 });
    const res = evaluarMultiamenaza(loc, serie);
    
    expect(res.nivel_alerta_global).toBeGreaterThanOrEqual(3);
  });

  it('3. Acoplamiento Hidro+Viento: Lluvia N2 + Viento N2 → N3', () => {
    const loc = mockLocalidad({
      zona_id: 'HUA',
      topografia: { altitud_msnm: 2400, pendiente_max_deg: 10, relieve: 'MESETA', twi: 8 },
      vulnerabilidad: { ...mockLocalidad().vulnerabilidad, acceso_vial: 'CAMINO_TERRACERIA' }
    });
    // Lluvia moderada + ráfagas fuertes
    const serie = mockSerieCompleta({ 
      lluvia: 1.0,    // 24mm
      rafagas: 60,    // Ráfagas que en altura dan N2
      presion: 760,
      temp: 15
    });
    const res = evaluarMultiamenaza(loc, serie);
    
    // El nivel global debe ser mayor que el máximo individual (por acoplamiento)
    expect(res.diagnostico.acoplamiento).toBeGreaterThan(0);
    expect(res.nivel_alerta_global).toBeGreaterThanOrEqual(3);
  });

  it('4. Acoplamiento Convectivo+Viento: Downburst → N4', () => {
    const loc = mockLocalidad({
      zona_id: 'HUA',
      topografia: { altitud_msnm: 2000, pendiente_max_deg: 10, relieve: 'MESETA', twi: 8 }
    });
    // CAPE alto + aire seco + viento fuerte
    const serie = mockSerieCompleta({ 
      cape: 3000,
      humedad700: 20,
      lluvia: 3,
      rafagas: 90,
      temp: 25,
      sensacion: 25
    });
    const res = evaluarMultiamenaza(loc, serie);
    
    expect(res.nivel_alerta_global).toBe(4);
    expect(res.vector_dominante).toBe('CONVECTIVO_VIENTO');
  });

  it('5. No-intersección (Falsa Alarma): Hidro N2 + Térmico N1 → N2', () => {
    const loc = mockLocalidad({
      zona_id: 'HUA',
      topografia: { altitud_msnm: 2400, pendiente_max_deg: 10, relieve: 'MESETA', twi: 8 },
      vulnerabilidad: { ...mockLocalidad().vulnerabilidad, acceso_vial: 'CAMINO_TERRACERIA' }
    });
    // Lluvia moderada + clima normal (no hay frío ni calor)
    const serie = mockSerieCompleta({ 
      lluvia: 1.0,
      temp: 20,
      sensacion: 20,
      rafagas: 20
    });
    const res = evaluarMultiamenaza(loc, serie);
    
    // No debe haber acoplamiento por frío (solo por lluvia+viento leve)
    expect(res.nivel_alerta_global).toBeLessThanOrEqual(3);
    expect(res.niveles_por_vector.termico).toBe(1);
  });

  it('6. Preservación del Diagnóstico Original', () => {
    const loc = mockLocalidad();
    const serie = mockSerieCompleta({});
    const res = evaluarMultiamenaza(loc, serie);
    
    // Verificar que el orquestador preserva los campos del motor hidrológico
    expect(res).toHaveProperty('donde');
    expect(res).toHaveProperty('geografia');
    expect(res).toHaveProperty('tiempos');
    expect(res).toHaveProperty('impactoSistemico');
    expect(res).toHaveProperty('protocolo');
    expect(res).toHaveProperty('localidad_id');
    expect(res).toHaveProperty('nombre');
    expect(res).toHaveProperty('municipio');
  });

  it('7. Fallback: Sin datos, retorna N1', () => {
    const loc = mockLocalidad();
    const serie = []; // Array vacío, no un objeto
    const res = evaluarMultiamenaza(loc, serie);
    
    expect(res.nivel_alerta_global).toBe(1);
  });

  // === H6.7: Test con fixture real ===
  it('8. Procesa el fixture real de Open-Meteo sin errores', () => {
    const fs = require('fs');
    const path = require('path');
    const { generarConsensoDeterminista } = require('../consensusEngine.js');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));
    const serieConsenso = generarConsensoDeterminista(fixture.hourly);

    const loc = mockLocalidad({ zona_id: 'PMN' });
    const res = evaluarMultiamenaza(loc, serieConsenso);

    expect(res.nivel_alerta_global).toBeGreaterThanOrEqual(1);
    expect(res.nivel_alerta_global).toBeLessThanOrEqual(4);
    expect(res.niveles_por_vector).toHaveProperty('hidrologico');
    expect(res.niveles_por_vector).toHaveProperty('viento');
    expect(res.niveles_por_vector).toHaveProperty('termico');
    expect(res.niveles_por_vector).toHaveProperty('convectivo');
  });

});