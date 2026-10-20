import { describe, it, expect } from 'vitest';
import { normalizarDatosRegionales, construirBloqueRegional } from '../regionales.js';

/**
 * Construye un objeto de datos regionales crudos (mínimo) para testear.
 */
function construirDatosCrudos() {
  return {
    zonas_totales: 14,
    zonas_ok: 2,
    zonas_fallidas: ['TUL'],
    resumenes: [
      {
        zona_id: 'ACT',
        zona_nombre: 'Altiplano Tula-Actopan',
        nodo_referencia: 'Actopan (Actopan)',
        poblacion: 32276,
        lluvia_ayer_24h_mm: 0,
        lluvia_hoy_24h_mm: 0.5,
        lluvia_manana_24h_mm: 1.2,
        temperatura_min_c: 7.8,
        temperatura_max_c: 19.7,
        temperatura_actual_c: 11.1,
        viento_max_kmh: 15.1,
        rafaga_max_kmh: 38.2,
        humedad_min_pct: 52,
        humedad_max_pct: 97,
        visibilidad_min_km: 21.4,
        confiabilidad_dominante: 'ALTA'
      },
      {
        zona_id: 'HUA',
        zona_nombre: 'Huauchinango y Cuenca del Necaxa',
        nodo_referencia: 'Huauchinango (Huauchinango)',
        poblacion: 58957,
        lluvia_ayer_24h_mm: 0,
        lluvia_hoy_24h_mm: 0,
        lluvia_manana_24h_mm: 6.6,
        temperatura_min_c: 11.7,
        temperatura_max_c: 19.8,
        temperatura_actual_c: 12.4,
        viento_max_kmh: 8.3,
        rafaga_max_kmh: 27.7,
        humedad_min_pct: 66,
        humedad_max_pct: 98,
        visibilidad_min_km: 20,
        confiabilidad_dominante: 'ALTA'
      }
    ]
  };
}

describe('regionales.js', () => {
  describe('normalizarDatosRegionales', () => {
    it('retorna null si el input no es un objeto o no tiene resumenes', () => {
      expect(normalizarDatosRegionales(null)).toBeNull();
      expect(normalizarDatosRegionales(undefined)).toBeNull();
      expect(normalizarDatosRegionales('no-object')).toBeNull();
      expect(normalizarDatosRegionales({})).toBeNull();
      expect(normalizarDatosRegionales({ resumenes: 'no-array' })).toBeNull();
    });

    it('normaliza un objeto válido, limpia strings largos y valida números', () => {
      const crudos = construirDatosCrudos();
      const normalizado = normalizarDatosRegionales(crudos);

      expect(normalizado).not.toBeNull();
      expect(normalizado.zonas_totales).toBe(14);
      expect(normalizado.zonas_ok).toBe(2);
      expect(normalizado.zonas_fallidas).toEqual(['TUL']);
      expect(normalizado.resumenes).toHaveLength(2);

      const act = normalizado.resumenes[0];
      expect(act.zona_id).toBe('ACT');
      expect(act.zona_nombre).toBe('Altiplano Tula-Actopan');
      expect(act.lluvia_hoy_24h_mm).toBe(0.5);
      expect(act.lluvia_manana_24h_mm).toBe(1.2);
      expect(act.confiabilidad_dominante).toBe('ALTA');
    });

    it('convierte a null los números inválidos o faltantes', () => {
      const crudos = construirDatosCrudos();
      // Corrompemos algunos campos
      crudos.resumenes[0].lluvia_hoy_24h_mm = 'no-es-numero';
      crudos.resumenes[0].temperatura_max_c = NaN;
      // Dejamos temperatura_min_c ausente
      delete crudos.resumenes[0].temperatura_min_c;

      const normalizado = normalizarDatosRegionales(crudos);
      const act = normalizado.resumenes[0];

      expect(act.lluvia_hoy_24h_mm).toBeNull();
      expect(act.temperatura_max_c).toBeNull();
      expect(act.temperatura_min_c).toBeNull();
    });

    it('limita strings largos a su longitud máxima', () => {
      const crudos = construirDatosCrudos();
      crudos.resumenes[0].zona_nombre = 'A'.repeat(200);
      crudos.resumenes[0].nodo_referencia = 'B'.repeat(300);

      const normalizado = normalizarDatosRegionales(crudos);
      expect(normalizado.resumenes[0].zona_nombre.length).toBeLessThanOrEqual(100);
      expect(normalizado.resumenes[0].nodo_referencia.length).toBeLessThanOrEqual(150);
    });
  });

  describe('construirBloqueRegional', () => {
    it('retorna un mensaje de no disponibilidad si no hay resumenes', () => {
      const bloque = construirBloqueRegional(null);
      expect(bloque).toBe('DATOS REGIONALES: no disponibles en esta emisión.');
    });

    it('construye un bloque de texto con las 3 ventanas (ayer, hoy, manana)', () => {
      const crudos = construirDatosCrudos();
      const normalizado = normalizarDatosRegionales(crudos);
      const bloque = construirBloqueRegional(normalizado);

      // Contiene encabezado
      expect(bloque).toContain('DATOS REGIONALES (2/14 zonas disponibles, ventana 72h, consenso GFS + ICON + GEM):');
      
      // Contiene ambos nodos
      expect(bloque).toContain('Altiplano Tula-Actopan');
      expect(bloque).toContain('Huauchinango y Cuenca del Necaxa');
      
      // Contiene las 3 ventanas
      expect(bloque).toContain('AYER: Lluvia 0 mm');
      expect(bloque).toContain('HOY: Lluvia 0.5 mm');
      expect(bloque).toContain('MAÑANA: Lluvia 1.2 mm');
      
      // Contiene zonas fallidas
      expect(bloque).toContain('ZONAS SIN DATOS EN ESTA EMISIÓN: TUL.');
    });

    it('maneja resumenes sin zonas fallidas (no agrega el aviso)', () => {
      const crudos = construirDatosCrudos();
      crudos.zonas_fallidas = [];
      crudos.zonas_ok = 14;
      crudos.zonas_totales = 14;
      const normalizado = normalizarDatosRegionales(crudos);
      const bloque = construirBloqueRegional(normalizado);

      expect(bloque).not.toContain('ZONAS SIN DATOS EN ESTA EMISIÓN');
    });
  });
});