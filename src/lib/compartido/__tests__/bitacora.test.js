import { describe, it, expect } from 'vitest';
import { generarResumenMultivector, calcularNuevaEntradaBitacora } from '../bitacora.js';

// Helper: crea una evaluación mock con el campo datos_disponibles_por_vector
// por defecto en "todos disponibles" (sistema normal).
function mockEval(overrides = {}) {
  return {
    nombre: 'Test Localidad',
    municipio: 'Test Municipio',
    nivel_alerta: 1,
    vector_dominante: 'SIN_AMENAZA',
    datos_disponibles_por_vector: {
      hidrologico: true,
      viento: true,
      termico: true,
      convectivo: true
    },
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

  describe('H-BITACORA-01 — disponibilidad y colisión de IDs', () => {
    it('Test 1: marca SIN_DATOS cuando el campo datos_disponibles_por_vector está ausente (en N3)', () => {
      // Se usa nivel 3 porque el resumen solo imprime el desglose de vectores
      // para N3 y N4. Sin el campo, debe mostrar SIN_DATOS en lugar del número.
      const evaluaciones = [
        { nombre: 'A', nivel_alerta: 3, vector_dominante: 'HIDROLOGICO' }, // sin datos_disponibles_por_vector
        { nombre: 'B', nivel_alerta: 3, vector_dominante: 'HIDROLOGICO' }
      ];
      const resumen = generarResumenMultivector(evaluaciones);
      
      // El desglose completo debe reflejar la falta de datos
      expect(resumen).toContain('N3 [hidro:SIN_DATOS');
      expect(resumen).toContain('termico:SIN_DATOS');
      expect(resumen).toContain('conv:SIN_DATOS');
    });

    it('Test 2: calcularNuevaEntradaBitacora colisiona si el caller no actualiza la base', () => {
      const base = [
        { id: 'SARA_LOG_1', hash_completo: 'a'.repeat(64), timestamp_iso_utc: '2026-10-24T00:00:00Z' }
      ];
      const timestamp = '2026-10-24T00:01:00Z';

      // Ambas llamadas usan la MISMA base
      const entrada1 = calcularNuevaEntradaBitacora(base, timestamp, { tipo: 'RUNNER' });
      const entrada2 = calcularNuevaEntradaBitacora(base, timestamp, { tipo: 'DIARIO' });

      // COLISIÓN: ambas generan SARA_LOG_2 y comparten prev_hash
      expect(entrada1.id).toBe('SARA_LOG_2');
      expect(entrada2.id).toBe('SARA_LOG_2');
      expect(entrada1.prev_hash).toBe(entrada2.prev_hash);

      // Si el caller actualiza la base, los IDs ya no colisionan
      const baseActualizada = [...base, { id: entrada1.id, hash_completo: entrada1.hash_completo }];
      const entrada3 = calcularNuevaEntradaBitacora(baseActualizada, timestamp, { tipo: 'DIARIO' });
      expect(entrada3.id).toBe('SARA_LOG_3');
      expect(entrada3.prev_hash).toBe(entrada1.hash_completo.slice(0, 16) + '...');
    });
  });
});