/**
 * Tests de riskEvaluator.js — Las 6 reglas del motor SEIAG
 *
 * H7a.4 — Cobertura exhaustiva de las reglas de evaluación de riesgo.
 *
 * Objetivo: blindar el motor antes de H4 (extracción del gemelo runner).
 *
 * Cada test construye una localidad mock con los campos mínimos y una
 * serie horaria sintética (o vacía) para forzar el escenario deseado.
 */

import { describe, it, expect } from 'vitest';
import { evaluarLocalidad } from '../riskEvaluator.js';

/**
 * Helper: construye un mock de localidad con defaults razonables.
 * Los tests sobreescriben los campos que necesitan.
 */
function mockLocalidad(overrides = {}) {
  return {
    id: 'TEST_001',
    nombre: 'Test Localidad',
    municipio: 'Test Municipio',
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

/**
 * Helper: construye una serie horaria de N horas con lluvia y temperatura fijas.
 * Si la serie es menor a 168h, el motor cae a un caso especial (slice de "evento actual").
 */
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

describe('riskEvaluator — Las 6 reglas del motor', () => {
  describe('Regla 1 — Protección Altiplano (N1)', () => {
    it('Altiplano plano sin lluvia ni viento → N1', () => {
      const localidad = mockLocalidad({
        zona_id: 'ACT',
        topografia: { altitud_msnm: 2000, pendiente_max_deg: 5, relieve: 'MESETA', twi: 8 }
      });
      const res = evaluarLocalidad(localidad, mockSerie({ lluvia_mm: 0, temperatura_c: 20 }), {});
      expect(res.nivel_alerta).toBe(1);
      expect(res.estado_alerta).toBe('NORMAL');
    });

    it('Altiplano con lluvia >= 20mm pierde protección → N2 o más', () => {
      const localidad = mockLocalidad({
        zona_id: 'ACT',
        topografia: { altitud_msnm: 2000, pendiente_max_deg: 5, relieve: 'MESETA', twi: 8 }
      });
      // 24h con 1mm/h = 24mm total → supera los 20mm del piso
      const serie = mockSerie({ lluvia_mm: 1.0, temperatura_c: 20 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Regla 2 — Deslave crítico (N4)', () => {
    it('Sierra + ladera + pendiente >= 45° + saturación >= 65mm → N4', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 1600, pendiente_max_deg: 50, relieve: 'LADERA', twi: 13 }
      });
      // Serie con lluvia suficiente para saturar (24h x 5mm = 120mm > 65mm)
      const serie = mockSerie({ lluvia_mm: 5.0, temperatura_c: 15 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(4);
      expect(res.estado_alerta).toBe('EMERGENCIA');
      expect(res.diagnostico.titulo).toMatch(/Deslave/i);
    });
  });

  describe('Regla 3 — Deslave moderado (N3)', () => {
    it('Sierra + ladera 25°–44° + saturación >= 65mm → N3', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 1600, pendiente_max_deg: 35, relieve: 'LADERA', twi: 13 }
      });
      const serie = mockSerie({ lluvia_mm: 5.0, temperatura_c: 15 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(3);
      expect(res.estado_alerta).toBe('ALERTA_TEMPRANA');
    });
  });

  describe('Regla 4 — Inundación fluvial', () => {
    it('Ribera + lluvia >= 65mm + poblacion aguas arriba >= 50k → N4', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 400, pendiente_max_deg: 8, relieve: 'MESETA', twi: 13 },
        hidrologia: {
          subcuenca_cve: 'RH27Bb',
          subcuenca_nom: 'R. Necaxa',
          posicion: 'BAJA',
          distancia_cauce_km: 0.5,
          tc_horas: 6,
          poblacion_aguas_arriba: 60000
        }
      });
      // 24h x 3mm = 72mm > 65mm, y poblacion arriba >= 50k → severidad N4
      const serie = mockSerie({ lluvia_mm: 3.0, temperatura_c: 18 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(4);
      expect(res.diagnostico.titulo).toMatch(/Inundaci[oó]n|Desbordamiento/i);
    });

    it('Ribera + lluvia 35-64mm + poblacion aguas arriba < 50k → N3', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 400, pendiente_max_deg: 8, relieve: 'MESETA', twi: 13 },
        hidrologia: {
          subcuenca_cve: 'RH27Bb',
          subcuenca_nom: 'R. Necaxa',
          posicion: 'BAJA',
          distancia_cauce_km: 0.5,
          tc_horas: 6,
          poblacion_aguas_arriba: 10000
        }
      });
      // 24h x 2mm = 48mm → entre 35 y 65, poblacion arriba < 50k → N3
      const serie = mockSerie({ lluvia_mm: 2.0, temperatura_c: 18 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(3);
    });

    it('Altiplano plano NO dispara Regla 4 aunque cumpla el resto', () => {
      const localidad = mockLocalidad({
        zona_id: 'ACT',
        topografia: { altitud_msnm: 2000, pendiente_max_deg: 5, relieve: 'MESETA', twi: 13 },
        hidrologia: {
          subcuenca_cve: 'RH26Dr',
          subcuenca_nom: 'R. Actopan',
          posicion: 'BAJA',
          distancia_cauce_km: 0.5,
          tc_horas: 4,
          poblacion_aguas_arriba: 60000
        }
      });
      const serie = mockSerie({ lluvia_mm: 3.0, temperatura_c: 18 });
      const res = evaluarLocalidad(localidad, serie, {});
      // El altiplano NO debe caer en Regla 4 (inundación). Queda en N2 por vigilancia.
      expect(res.nivel_alerta).toBeLessThanOrEqual(2);
    });
  });

  describe('Regla 5 — Corte vial', () => {
    it('Terracería + lluvia >= 20mm → N3 (si no está ya en N4)', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 },
        vulnerabilidad: {
          poblacion: 1000,
          marginacion: 'ALTO',
          acceso_vial: 'CAMINO_TERRACERIA',
          dist_hospital_km: 30
        }
      });
      // 24h x 1mm = 24mm > 20mm → corte vial
      const serie = mockSerie({ lluvia_mm: 1.0, temperatura_c: 15 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(3);
      expect(res.diagnostico.titulo).toMatch(/Corte|Incomunicaci[oó]n/i);
    });
  });

  describe('Regla 6 — Vigilancia (N2)', () => {
    it('Lluvia >= 8mm sin otras reglas → N2', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 }
      });
      // 24h x 0.5mm = 12mm > 8mm, no llega a 20mm → solo N2 (vigilancia)
      const serie = mockSerie({ lluvia_mm: 0.5, temperatura_c: 15 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(2);
      expect(res.estado_alerta).toBe('VIGILANCIA');
    });

    it('Niebla densa (visibilidad <= 2km) sin lluvia → N2 (N18)', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 }
      });
      // Visibilidad 1.5km, sin lluvia → debe disparar N2 por niebla
      const serie = mockSerie({ lluvia_mm: 0, temperatura_c: 15, visibilidad_km: 1.5 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(2);
      expect(res.diagnostico.titulo).toMatch(/Niebla/i);
    });

    it('Sin lluvia, sin niebla, sin saturación → N1', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 }
      });
      const serie = mockSerie({ lluvia_mm: 0, temperatura_c: 18, visibilidad_km: 10 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(1);
    });
  });

  describe('Prioridad entre reglas (comportamiento real del motor)', () => {
    it('Ladera crítica (N4) + inundación fluvial (N4): el motor reporta inundación (sobreescritura por severidad >=)', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 400, pendiente_max_deg: 50, relieve: 'LADERA', twi: 13 },
        hidrologia: {
          subcuenca_cve: 'RH27Bb',
          subcuenca_nom: 'R. Necaxa',
          posicion: 'BAJA',
          distancia_cauce_km: 0.5,
          tc_horas: 6,
          poblacion_aguas_arriba: 60000
        }
      });
      const serie = mockSerie({ lluvia_mm: 5.0, temperatura_c: 15 });
      const res = evaluarLocalidad(localidad, serie, {});
      // Ambas reglas dan N4. El motor prioriza inundación (Regla 4) por severidad >=.
      expect(res.nivel_alerta).toBe(4);
      expect(res.diagnostico.titulo).toMatch(/Inundaci[oó]n/i);
    });

    it('Ladera crítica (N4) + inundación fluvial (N3): el motor mantiene deslave (N4 prevalece)', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 400, pendiente_max_deg: 50, relieve: 'LADERA', twi: 13 },
        hidrologia: {
          subcuenca_cve: 'RH27Bb',
          subcuenca_nom: 'R. Necaxa',
          posicion: 'BAJA',
          distancia_cauce_km: 0.5,
          tc_horas: 6,
          poblacion_aguas_arriba: 10000 // < 50k → severidad fluvial N3
        }
      });
      // 24h x 2mm = 48mm → saturación alta (para deslave), pero lluvia efectiva < 65mm (inundación N3)
      const serie = mockSerie({ lluvia_mm: 2.0, temperatura_c: 15 });
      const res = evaluarLocalidad(localidad, serie, {});
      // Ambas reglas dan N4 vs N3. El motor mantiene deslave (4 >= 3, pero 4 es mayor).
      expect(res.nivel_alerta).toBe(4);
      expect(res.diagnostico.titulo).toMatch(/Deslave/i);
    });

    it('Ladera moderada (N3) + inundación fluvial (N4): el motor reporta inundación (severidad >= sobreescribe)', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        topografia: { altitud_msnm: 400, pendiente_max_deg: 35, relieve: 'LADERA', twi: 13 },
        hidrologia: {
          subcuenca_cve: 'RH27Bb',
          subcuenca_nom: 'R. Necaxa',
          posicion: 'BAJA',
          distancia_cauce_km: 0.5,
          tc_horas: 6,
          poblacion_aguas_arriba: 60000
        }
      });
      // 24h x 3mm = 72mm → deslave N3 (pendiente 35°) e inundación N4 (lluvia >= 65mm)
      const serie = mockSerie({ lluvia_mm: 3.0, temperatura_c: 15 });
      const res = evaluarLocalidad(localidad, serie, {});
      expect(res.nivel_alerta).toBe(4);
      expect(res.diagnostico.titulo).toMatch(/Inundaci[oó]n/i);
    });
  });

  describe('H-MOTOR-06 — Aviso SMN solo a estados afectados', () => {
    it('Localidad en Puebla + aviso solo para VER → NO eleva el piso de lluvia', () => {
      const localidad = mockLocalidad({
        zona_id: 'HUA',
        estado: 'Puebla',
        topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 }
      });
      const alertaSMN = {
        activo: true,
        rango_lluvia_min_mm: 75,
        estados_afectados: ['VER'] // solo Veracruz
      };
      // Sin lluvia real → si el piso NO se aplica, queda en N1
      const serie = mockSerie({ lluvia_mm: 0, temperatura_c: 18 });
      const res = evaluarLocalidad(localidad, serie, { alertaSMN });
      expect(res.nivel_alerta).toBe(1);
      expect(res.impactoSistemico.lluviaEvento24hMm).toBeLessThan(75);
    });

    it('Localidad en Veracruz + aviso solo para VER → SÍ eleva el piso de lluvia', () => {
      const localidad = mockLocalidad({
        zona_id: 'HYC',
        estado: 'Veracruz',
        topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 }
      });
      const alertaSMN = {
        activo: true,
        rango_lluvia_min_mm: 75,
        estados_afectados: ['VER']
      };
      // Sin lluvia real, pero el piso SMN de 75mm debe elevar la lluvia efectiva
      const serie = mockSerie({ lluvia_mm: 0, temperatura_c: 18 });
      const res = evaluarLocalidad(localidad, serie, { alertaSMN });
      expect(res.impactoSistemico.lluviaEvento24hMm).toBeGreaterThanOrEqual(75);
    });
  });
});