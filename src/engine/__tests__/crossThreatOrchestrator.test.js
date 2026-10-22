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

  // === H5.0.1: Fix de coherencia vector/nivel para N1 ===
  it('9. N1 con vectores marginales: vector_dominante debe ser SIN_AMENAZA', () => {
    // Escenario real del 22/10/2026: Actopan (N1) con convectivo=1.05,
    // hidro=1.00, viento=1.00, termico=1.00. El orquestador elegía
    // CONVECTIVO por un margen de 0.05, generando incoherencia en la UI.
    // Con el fix, debe ser SIN_AMENAZA.
    const loc = mockLocalidad({
      zona_id: 'ACT',
      topografia: { altitud_msnm: 2000, pendiente_max_deg: 5, relieve: 'MESETA', twi: 8 }
    });
    // Serie con CAPE bajo (convectivo 1.05) y todo lo demás en calma
    const serie = mockSerieCompleta({
      lluvia: 0,
      temp: 18,
      sensacion: 18,
      rafagas: 15,
      sostenido: 5,
      nubosidad: 30,
      bulbo: 12,
      cape: 200,          // CAPE bajo → convectivo 1.05 (marginal)
      humedad700: 60,
      nivelCongelacion: 4000,
      presion: 1013
    });
    const res = evaluarMultiamenaza(loc, serie);

    // Debe ser N1 (calma)
    expect(res.nivel_alerta_global).toBe(1);
    // Y el vector debe ser SIN_AMENAZA (no CONVECTIVO)
    expect(res.vector_dominante).toBe('SIN_AMENAZA');
    // Los niveles por vector deben reflejar el estado real (todos cerca de 1.0)
    expect(res.niveles_por_vector.convectivo).toBeLessThan(1.1);
    expect(res.niveles_por_vector.hidrologico).toBe(1.0);
  });

  it('10. N2 viento subido: título debe ser "Acoplamiento viento + convección — Nivel 2"', () => {
    // Escenario: hidro=1.0, viento=1.99 (ráfaga 52 km/h a 2400 msnm), convectivo=1.05.
    // El acoplamiento convectivo-viento (γ=0.30) sube el riesgo a 2.00485 → N2.
    // El vector dominante (VIENTO, 1.99) está en N1.
    // El segundo contribuyente es CONVECTIVO (γ=0.30 × 0.05 × 0.99 = 0.01485).
    const loc = mockLocalidad({
      zona_id: 'PMN',
      topografia: { altitud_msnm: 2400, pendiente_max_deg: 8, relieve: 'MESETA', twi: 10 }
    });
    const serie = mockSerieCompleta({
      lluvia: 0,
      temp: 15,
      sensacion: 15,
      rafagas: 52,
      sostenido: 10,
      nubosidad: 50,
      bulbo: 12,
      cape: 300,
      humedad700: 60,
      nivelCongelacion: 4000,
      presion: 760
    });
    const res = evaluarMultiamenaza(loc, serie);

    expect(res.nivel_alerta_global).toBe(2);
    expect(res.diagnostico.titulo).toMatch(/Acoplamiento viento \+ convección — Nivel 2/i);
    expect(res.diagnostico.causa).toMatch(/acoplamiento entre viento y convección/i);
  });

  it('11. N3 hidro puro: NO debe marcarse como "Acoplamiento"', () => {
    // Los N3 hidro puros (hidro=3.03, sin acoplamiento significativo) NO deben
    // marcarse como compuestos. Su título debe quedar intacto.
    const loc = mockLocalidad({
      zona_id: 'ZAC',
      topografia: { altitud_msnm: 2000, pendiente_max_deg: 40, relieve: 'LADERA', twi: 13 },
      vulnerabilidad: {
        poblacion: 1000,
        marginacion: 'ALTO',
        acceso_vial: 'CAMINO_TERRACERIA',
        dist_hospital_km: 10
      }
    });
    const serie = mockSerieCompleta({
      lluvia: 1.0,
      temp: 15,
      rafagas: 20,
      presion: 800
    });
    const res = evaluarMultiamenaza(loc, serie);

    expect(res.nivel_alerta_global).toBe(3);
    expect(res.vector_dominante).toBe('HIDROLOGICO');
    expect(res.diagnostico.titulo).not.toMatch(/Acoplamiento/i);
    expect(res.diagnostico.causa).not.toMatch(/acoplamiento entre/i);
  });

    it('12. N3 hidro subido: título debe ser "Acoplamiento hidrología + viento — Nivel 3"', () => {
    // Escenario: hidro≈2.95 (N2 puro, por lluvia moderada), viento≈1.39 (N1).
    // El acoplamiento HIDRO_VIENTO (γ=0.20) sube el riesgo a ≈3.1 → N3.
    // El vector dominante (HIDROLOGICO, 2.95) está en N2.
    // El segundo contribuyente es VIENTO (γ=0.20 × 1.95 × 0.39 = 0.152).
    const loc = mockLocalidad({
      zona_id: 'ZAC',
      topografia: { altitud_msnm: 2000, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 },
      vulnerabilidad: {
        poblacion: 1000,
        marginacion: 'ALTO',
        acceso_vial: 'CARRETERA_FEDERAL',  // sin terracería → no N3 por corte vial
        dist_hospital_km: 10
      }
    });
    // lluvia = 0.48 mm/h → saturación ≈ 56 mm (N2, no N3)
    const serie = mockSerieCompleta({
      lluvia: 0.48,
      temp: 15,
      rafagas: 45,       // N1 marginal (nivelContinuo ≈ 1.39)
      sostenido: 10,
      presion: 760
    });
    const res = evaluarMultiamenaza(loc, serie);

    expect(res.nivel_alerta_global).toBe(3);
    expect(res.vector_dominante).toBe('HIDROLOGICO');
    expect(res.niveles_por_vector.hidrologico).toBeGreaterThanOrEqual(2.0);
    expect(res.niveles_por_vector.hidrologico).toBeLessThan(3.0);
    expect(res.diagnostico.titulo).toMatch(/Acoplamiento hidrología \+ viento — Nivel 3/i);
    expect(res.diagnostico.causa).toMatch(/acoplamiento entre hidrología y viento/i);
  });

  it('13. N4 hidro puro: NO debe marcarse como "Acoplamiento"', () => {
    // N4 hidro puro (hidro=4.0, sin acoplamiento significativo) NO debe
    // marcarse como compuesto. Su título debe quedar intacto.
    const loc = mockLocalidad({
      zona_id: 'HUA',
      topografia: { altitud_msnm: 1600, pendiente_max_deg: 50, relieve: 'LADERA', twi: 13 }
    });
    const serie = mockSerieCompleta({
      lluvia: 5.0,        // 120mm → N4 por deslave crítico
      temp: 15,
      rafagas: 20,
      presion: 800
    });
    const res = evaluarMultiamenaza(loc, serie);

    expect(res.nivel_alerta_global).toBe(4);
    expect(res.vector_dominante).toBe('HIDROLOGICO');
    expect(res.diagnostico.titulo).not.toMatch(/Acoplamiento/i);
    expect(res.diagnostico.causa).not.toMatch(/acoplamiento entre/i);
  });
  
});