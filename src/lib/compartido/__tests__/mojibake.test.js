import { describe, it, expect } from 'vitest';
import { repararMojibake, repararObjeto } from '../mojibake.js';

describe('mojibake.js', () => {
  describe('repararMojibake', () => {
    it('repara un string con doble encoding UTF-8 (ej. Ã³ -> ó)', () => {
      expect(repararMojibake('atmÃ³sferas')).toBe('atmósferas');
      expect(repararMojibake('TulancingÃ³')).toBe('Tulancingó');
      expect(repararMojibake('dÃ­a')).toBe('día');
    });

    it('retorna el string intacto si no tiene mojibake', () => {
      const textoLimpio = 'atmósferas y día';
      expect(repararMojibake(textoLimpio)).toBe(textoLimpio);
    });

    it('retorna el input tal cual si es null, undefined o no es string', () => {
      expect(repararMojibake(null)).toBeNull();
      expect(repararMojibake(undefined)).toBeUndefined();
      expect(repararMojibake(123)).toBe(123);
      expect(repararMojibake('')).toBe('');
    });
  });

  describe('repararObjeto', () => {
    it('repara strings dentro de un objeto simple', () => {
      const obj = { nombre: 'TulancingÃ³', estado: 'Hidalgo' };
      const reparado = repararObjeto(obj);
      expect(reparado.nombre).toBe('Tulancingó');
      expect(reparado.estado).toBe('Hidalgo');
    });

    it('repara strings en objetos anidados y arrays', () => {
      const obj = {
        titulo: 'SituaciÃ³n crÃ­tica',
        datos: ['dÃ­a', 'noche', { nota: 'seÃ±al' }],
        nulo: null,
        numero: 42
      };
      const reparado = repararObjeto(obj);
      expect(reparado.titulo).toBe('Situación crítica');
      expect(reparado.datos[0]).toBe('día');
      expect(reparado.datos[1]).toBe('noche');
      expect(reparado.datos[2].nota).toBe('señal');
      expect(reparado.nulo).toBeNull();
      expect(reparado.numero).toBe(42);
    });

    it('maneja arrays directos y tipos primitivos', () => {
      expect(repararObjeto(['Ã³', 'Ã­'])).toEqual(['ó', 'í']);
      expect(repararObjeto(null)).toBeNull();
      expect(repararObjeto(123)).toBe(123);
    });
  });
});