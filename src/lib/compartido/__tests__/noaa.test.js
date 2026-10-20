import { describe, it, expect } from 'vitest';
import { parseNoaaStamp, compararNoaaStamps } from '../noaa.js';

describe('noaa.js', () => {
  describe('parseNoaaStamp', () => {
    it('parsea un stamp válido correctamente', () => {
      // 2026, día juliano 290 (17 oct), 15:30
      const res = parseNoaaStamp('20262901530');
      expect(res).toEqual({ year: 2026, dayOfYear: 290, hour: 15, minute: 30 });
    });

    it('parsea fechas borde válidas (1 de enero y 31 de diciembre bisiesto)', () => {
      expect(parseNoaaStamp('20260010000')).toEqual({ year: 2026, dayOfYear: 1, hour: 0, minute: 0 });
      expect(parseNoaaStamp('20243662359')).toEqual({ year: 2024, dayOfYear: 366, hour: 23, minute: 59 });
    });

    it('retorna null si el string no tiene 11 caracteres', () => {
      expect(parseNoaaStamp('2026290153')).toBeNull();   // 10 dígitos
      expect(parseNoaaStamp('202629015300')).toBeNull(); // 12 dígitos
      expect(parseNoaaStamp('')).toBeNull();
    });

    it('retorna null si contiene caracteres no numéricos', () => {
      expect(parseNoaaStamp('2026290153A')).toBeNull();
      expect(parseNoaaStamp('2026-2901530')).toBeNull();
    });

    it('retorna null si el año está fuera de rango (2000-2100)', () => {
      expect(parseNoaaStamp('19992901530')).toBeNull();
      expect(parseNoaaStamp('21012901530')).toBeNull();
    });

    it('retorna null si el día juliano está fuera de rango (1-366)', () => {
      expect(parseNoaaStamp('20260001530')).toBeNull(); // día 0
      expect(parseNoaaStamp('20263671530')).toBeNull(); // día 367
    });

    it('retorna null si la hora está fuera de rango (0-23)', () => {
      expect(parseNoaaStamp('20262902430')).toBeNull(); // hora 24
    });

    it('retorna null si el minuto está fuera de rango (0-59)', () => {
      expect(parseNoaaStamp('20262901560')).toBeNull(); // minuto 60
    });
  });

  describe('compararNoaaStamps', () => {
    it('ordena correctamente (el más reciente primero)', () => {
      const antiguo = '20262891500'; // 15 oct, 15:00
      const reciente = '20262901530'; // 17 oct, 15:30
      expect(compararNoaaStamps(reciente, antiguo)).toBeLessThan(0);
      expect(compararNoaaStamps(antiguo, reciente)).toBeGreaterThan(0);
    });

    it('ordena correctamente si es el mismo día pero distinta hora', () => {
      const temprano = '20262901500'; // 15:00
      const tarde = '20262901830';    // 18:30
      expect(compararNoaaStamps(tarde, temprano)).toBeLessThan(0);
      expect(compararNoaaStamps(temprano, tarde)).toBeGreaterThan(0);
    });

    it('retorna 0 si son idénticos', () => {
      expect(compararNoaaStamps('20262901530', '20262901530')).toBe(0);
    });

    it('manda los inválidos al final', () => {
      const valido = '20262901530';
      const invalido = '20263671530'; // día 367
      expect(compararNoaaStamps(valido, invalido)).toBeLessThan(0);
      expect(compararNoaaStamps(invalido, valido)).toBeGreaterThan(0);
      expect(compararNoaaStamps(invalido, invalido)).toBe(0);
    });
  });
});