import { describe, it, expect } from 'vitest';
import { formatearTimestamp } from '../fechas.js';

describe('fechas.js', () => {
  describe('formatearTimestamp', () => {
    it('formatea un timestamp ISO UTC válido a hora local de México', () => {
      // 2026-10-20T19:00:00Z = 13:00 en CDMX (UTC-6)
      // Nota: Intl en Node 22 usa "20-oct" (guion), no "20 oct" (espacio)
      const resultado = formatearTimestamp('2026-10-20T19:00:00Z');
      expect(resultado).toBe('20-oct • 13:00 hrs');
    });

    it('formatea correctamente el cambio de día por zona horaria', () => {
      // 2026-10-21T03:00:00Z = 21:00 del 20 oct en CDMX (UTC-6)
      const resultado = formatearTimestamp('2026-10-21T03:00:00Z');
      expect(resultado).toBe('20-oct • 21:00 hrs');
    });

    it('usa formato de 24 horas (sin AM/PM)', () => {
      // 2026-10-20T14:30:00Z = 08:30 en CDMX
      const resultado = formatearTimestamp('2026-10-20T14:30:00Z');
      expect(resultado).toBe('20-oct • 08:30 hrs');
      expect(resultado).not.toContain('AM');
      expect(resultado).not.toContain('PM');
    });

    it('retorna null si el input es null, undefined o vacío', () => {
      expect(formatearTimestamp(null)).toBeNull();
      expect(formatearTimestamp(undefined)).toBeNull();
      expect(formatearTimestamp('')).toBeNull();
    });

    it('retorna null si el input es un string que no es fecha válida', () => {
      expect(formatearTimestamp('no-es-fecha')).toBeNull();
      expect(formatearTimestamp('2026-13-45T99:99:99Z')).toBeNull();
    });

    it('usa el locale es-MX (mes abreviado en español)', () => {
      // Diciembre debe decir "dic", no "Dec"
      const resultado = formatearTimestamp('2026-12-25T18:00:00Z');
      expect(resultado).toBe('25-dic • 12:00 hrs');
      expect(resultado).not.toContain('Dec');
    });

    it('formatea correctamente un timestamp del 1 de enero (borde de año)', () => {
      // 2027-01-01T06:00:00Z = 00:00 del 1 ene en CDMX
      const resultado = formatearTimestamp('2027-01-01T06:00:00Z');
      expect(resultado).toBe('01-ene • 00:00 hrs');
    });
  });
});