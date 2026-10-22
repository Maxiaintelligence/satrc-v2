import { describe, it, expect } from 'vitest';
import { generarResumenMultivector } from '../bitacora.js';

// Helper para crear evaluaciones mock
function mockEval(overrides = {}) {
  return {
    nombre: 'Test Localidad',
    municipio: 'Test Municipio',
    nivel_alerta: 1,
    vector_dominante: 'SIN_AMENAZA',
    ...overrides
  };
}

describe('bitacora.js', () => {
  describe('generarResumenMultivector', () => {
    it('genera un resumen vacío si no hay evaluaciones', () => {
      const resumen = generarResumenMultivector([]);
      expect(resumen).toContain('N4: 0');
      expect(resumen).toContain('N3: 0');
      expect(resumen).toContain('Top-1: Ninguno');
    });

    it('genera el resumen correcto con 1 N3 hidrológico', () => {
      const evaluaciones = [
        mockEval({ nivel_alerta: 3, vector_dominante: 'HIDROLOGICO', nombre: 'Zacatlán' }),
        mockEval({ nivel_alerta: 1, vector_dominante: 'SIN_AMENAZA' })
      ];
      const resumen = generarResumenMultivector(evaluaciones);
      
      expect(resumen).toContain('N4: 0');
      expect(resumen).toContain('N2: 0');
      expect(resumen).toContain('N1: 1');
      expect(resumen).toContain('Top-1: HIDROLOGICO (Zacatlán)');
      expect(resumen).toContain('N3 [hidro:1, viento:0, termico:0, conv:0]');
    });

    it('genera el resumen correcto con múltiples vectores (simulando helada y viento)', () => {
      const evaluaciones = [
        mockEval({ nivel_alerta: 3, vector_dominante: 'TERMICO', nombre: 'Pachuca' }),
        mockEval({ nivel_alerta: 3, vector_dominante: 'VIENTO', nombre: 'Mineral de la Reforma' }),
        mockEval({ nivel_alerta: 2, vector_dominante: 'CONVECTIVO', nombre: 'Tulancingo' }),
        mockEval({ nivel_alerta: 1, vector_dominante: 'SIN_AMENAZA' })
      ];
      const resumen = generarResumenMultivector(evaluaciones);
      
      expect(resumen).toContain('N4: 0');
      expect(resumen).toContain('N2: 1');
      expect(resumen).toContain('N1: 1');
      // El top-1 debe ser el primero en la lista (ya vienen ordenados por severidad)
      expect(resumen).toContain('Top-1: TERMICO (Pachuca)');
      expect(resumen).toContain('N3 [hidro:0, viento:1, termico:1, conv:0]');
      expect(resumen).toContain('N2: 1');
    });

    it('agrupa correctamente los vectores compuestos', () => {
      const evaluaciones = [
        mockEval({ nivel_alerta: 4, vector_dominante: 'CONVECTIVO_VIENTO', nombre: 'Huauchinango' }),
        mockEval({ nivel_alerta: 3, vector_dominante: 'HIDRO_VIENTO', nombre: 'Xicotepec' }),
        mockEval({ nivel_alerta: 3, vector_dominante: 'HIDROLOGICO' })
      ];
      const resumen = generarResumenMultivector(evaluaciones);
      
      expect(resumen).toContain('Top-1: CONVECTIVO_VIENTO (Huauchinango)');
      // En los conteos, los compuestos deben mapearse a su vector principal o agruparse
      expect(resumen).toContain('N4 [hidro:0, viento:1, termico:0, conv:1]'); 
    });
  });
});