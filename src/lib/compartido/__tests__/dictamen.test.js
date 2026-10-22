import { describe, it, expect } from 'vitest';
import { generarTituloDictamen } from '../dictamen.js';

describe('dictamen.js', () => {
  describe('generarTituloDictamen', () => {
    it('N1 retorna "Situación Diocesana de Calma" sin importar el vector', () => {
      expect(generarTituloDictamen(1, 'HIDROLOGICO')).toBe('Situación Diocesana de Calma');
      expect(generarTituloDictamen(1, 'SIN_AMENAZA')).toBe('Situación Diocesana de Calma');
    });

    it('N3 con vector HIDROLOGICO retorna "Alerta Temprana por Lluvias y Deslaves"', () => {
      expect(generarTituloDictamen(3, 'HIDROLOGICO')).toBe('Alerta Temprana por Lluvias y Deslaves');
    });

    it('N4 con vector CONVECTIVO_VIENTO retorna "Emergencia por Downburst y Rachas Descendentes"', () => {
      expect(generarTituloDictamen(4, 'CONVECTIVO_VIENTO')).toBe('Emergencia por Downburst y Rachas Descendentes');
    });

    it('N3 con vector TERMICO retorna "Alerta Temprana por Frío/Calor Extremo"', () => {
      expect(generarTituloDictamen(3, 'TERMICO')).toBe('Alerta Temprana por Frío/Calor Extremo');
    });

    it('N2 con vector HIDRO_VIENTO retorna "Vigilancia por Lluvia y Viento (Árboles Caídos)"', () => {
      expect(generarTituloDictamen(2, 'HIDRO_VIENTO')).toBe('Vigilancia por Lluvia y Viento (Árboles Caídos)');
    });

    it('N3 con vector HIDRO_TERMICO retorna "Alerta Temprana por Lluvia y Frío (Vías Congeladas)"', () => {
      expect(generarTituloDictamen(3, 'HIDRO_TERMICO')).toBe('Alerta Temprana por Lluvia y Frío (Vías Congeladas)');
    });
    
    it('Fallback: vector desconocido retorna "Condiciones Meteorológicas Complejas"', () => {
      expect(generarTituloDictamen(3, 'METEORITO')).toBe('Alerta Temprana por Condiciones Meteorológicas Complejas');
    });
  });
});