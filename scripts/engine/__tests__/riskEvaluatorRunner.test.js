/**
 * Tests del gemelo `riskEvaluatorRunner.mjs` (H4.1).
 *
 * 3 tests:
 *  - Test 1: shape del runner (no del frontend).
 *  - Test 2: zonaSinDatos=true fuerza SIN_DATOS_REGIONALES y N1.
 *  - Test 3: paridad funcional con riskEvaluator.js del frontend en 3 casos simples.
 */

import { describe, it, expect } from 'vitest';
import { evaluarLocalidadRunner } from '../riskEvaluatorRunner.mjs';
import { evaluarLocalidad } from '../../../src/engine/riskEvaluator.js';

/**
 * Mock de localidad (mismo patrón que riskEvaluator.test.js).
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
 * Mock de serie horaria (mismo patrón que riskEvaluator.test.js).
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

describe('riskEvaluatorRunner — gemelo del runner (H4.1)', () => {
  describe('Test 1 — Shape del runner (no del frontend)', () => {
    it('expone vector_dominante y sin_datos_regionales; NO expone tipoAmenaza ni posicionHidro', () => {
      const localidad = mockLocalidad();
      const serie = mockSerie({ lluvia_mm: 0 });
      const res = evaluarLocalidadRunner(localidad, serie, { alertaSMN: null, zonaSinDatos: false });

      // Campos del runner que el frontend NO tiene
      expect(res).toHaveProperty('vector_dominante');
      expect(res).toHaveProperty('sin_datos_regionales');
      expect(res.impactoSistemico).toHaveProperty('tempMinimaC');

      // Campos del frontend que el runner NO tiene
      expect(res.diagnostico).not.toHaveProperty('tipoAmenaza');
      expect(res.geografia).not.toHaveProperty('posicionHidro');
      expect(res.impactoSistemico).not.toHaveProperty('umbralFisicoDeslaveMm');
      expect(res.impactoSistemico).not.toHaveProperty('esLaderaHabitada');
      expect(res.impactoSistemico).not.toHaveProperty('esRiberaVulnerable');

      // tiempos hardcodeados (divergencia conocida)
      expect(res.tiempos.inicio).toBe('En curso');
      expect(res.tiempos.picoMaximo).toBe('Periodo activo');
      expect(res.tiempos).not.toHaveProperty('crestaImpacto');
    });
  });

  describe('Test 2 — zonaSinDatos=true fuerza SIN_DATOS_REGIONALES y N1', () => {
    it('con zonaSinDatos=true, nivel=1 y vector_dominante="SIN_DATOS_REGIONALES"', () => {
      const localidad = mockLocalidad();
      const res = evaluarLocalidadRunner(localidad, [], { alertaSMN: null, zonaSinDatos: true });

      expect(res.nivel_alerta).toBe(1);
      expect(res.vector_dominante).toBe('SIN_DATOS_REGIONALES');
      expect(res.sin_datos_regionales).toBe(true);
      expect(res.diagnostico.titulo).toMatch(/Sin datos/i);
    });
  });

  describe('Test 3 — Paridad funcional con riskEvaluator.js del frontend', () => {
    it('en casos simples (sin niebla, sin aviso SMN), ambos motores coinciden en nivel_alerta', () => {
      const casos = [
        {
          nombre: 'Altiplano plano sin lluvia → N1 en ambos',
          localidad: mockLocalidad({
            zona_id: 'ACT',
            topografia: { altitud_msnm: 2000, pendiente_max_deg: 5, relieve: 'MESETA', twi: 8 }
          }),
          serie: mockSerie({ lluvia_mm: 0, temperatura_c: 20 }),
          esperadoNivel: 1
        },
        {
          nombre: 'Ladera crítica con saturación → N4 en ambos',
          localidad: mockLocalidad({
            zona_id: 'HUA',
            topografia: { altitud_msnm: 1600, pendiente_max_deg: 50, relieve: 'LADERA', twi: 13 }
          }),
          serie: mockSerie({ lluvia_mm: 5.0, temperatura_c: 15 }),
          esperadoNivel: 4
        },
        {
          nombre: 'Corte vial con terracería y lluvia → N3 en ambos',
          localidad: mockLocalidad({
            zona_id: 'HUA',
            topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 },
            vulnerabilidad: {
              poblacion: 1000,
              marginacion: 'ALTO',
              acceso_vial: 'CAMINO_TERRACERIA',
              dist_hospital_km: 30
            }
          }),
          serie: mockSerie({ lluvia_mm: 1.0, temperatura_c: 15 }),
          esperadoNivel: 3
        },
        {
          nombre: 'Niebla sin lluvia ni saturación → N1 en ambos (PEND-06)',
          localidad: mockLocalidad({
            zona_id: 'HUA',
            topografia: { altitud_msnm: 1500, pendiente_max_deg: 10, relieve: 'MESETA', twi: 10 }
          }),
          serie: mockSerie({ lluvia_mm: 0, temperatura_c: 15, visibilidad_km: 1.5 }),
          esperadoNivel: 1
        }
      ];

      casos.forEach(({ nombre, localidad, serie, esperadoNivel }) => {
        const resRunner = evaluarLocalidadRunner(localidad, serie, { alertaSMN: null, zonaSinDatos: false });
        const resFrontend = evaluarLocalidad(localidad, serie, { alertaSMN: null });

        expect(resRunner.nivel_alerta, `[runner] ${nombre}`).toBe(esperadoNivel);
        expect(resFrontend.nivel_alerta, `[frontend] ${nombre}`).toBe(esperadoNivel);
      });
    });
  });
});