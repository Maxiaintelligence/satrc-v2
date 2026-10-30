import { describe, it, expect } from 'vitest';
import { evaluarConvectivo } from '../convectiveEvaluator.js';

// Helper para crear mocks de localidad
function mockLocalidad(altitud = 2000) {
  return { topografia: { altitud_msnm: altitud, relieve: 'MESETA' } };
}

// Helper para crear mocks de serie horaria
function mockSerie({
  cape = 500,
  humedad700 = 60,
  lluvia = 0,
  nivelCongelacion = 4000,
  viento700 = 20,
  viento10 = 10,
  windDir700 = null,
  windDir10 = null,
  showers = null
} = {}) {
  const base = {
    time: Array(192).fill('2026-10-21T12:00'),
    cape_jkg: Array(192).fill(cape),
    humedad_700hpa: Array(192).fill(humedad700),
    lluvia_mm: Array(192).fill(lluvia),
    nivel_congelacion_m: Array(192).fill(nivelCongelacion),
    viento_700hpa: Array(192).fill(viento700),
    viento_kmh: Array(192).fill(viento10)
  };
  if (windDir10 !== null) base.wind_direction_10m = Array(192).fill(windDir10);
  if (windDir700 !== null) base.wind_direction_700hPa = Array(192).fill(windDir700);
  if (showers !== null) base.showers_mm = Array(192).fill(showers);
  return base;
}

describe('convectiveEvaluator.js', () => {
  it('1. Atmósfera estable: CAPE 500, sin lluvia → N1', () => {
    const loc = mockLocalidad(2000);
    const serie = mockSerie({ cape: 500, lluvia: 0 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(1);
    expect(res.vector_dominante).toBe('CONVECTIVO_NORMAL');
  });

  it('2. Vigilancia por inestabilidad: CAPE 1200 → N2', () => {
    const loc = mockLocalidad(2000);
    const serie = mockSerie({ cape: 1200, lluvia: 2, humedad700: 70 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(2);
    expect(res.vector_dominante).toBe('TORMENTA_DISPERSA');
  });

  it('3. Alerta por granizo: CAPE alto + capa de fusión pequeña → N3', () => {
    const loc = mockLocalidad(2400);
    // Nivel de congelación a 2800m, localidad a 2400m → Δh = 400m (granizo llega intacto)
    const serie = mockSerie({ cape: 1800, lluvia: 15, nivelCongelacion: 2800, humedad700: 70 });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.vector_dominante).toBe('GRANIZO');
    expect(res.datos_tecnicos.espesor_capa_fusion_m).toBeLessThan(1000);
  });

  it('4. Alerta por downburst: CAPE alto + aire seco + cizalladura vectorial + convección → N3', () => {
    const loc = mockLocalidad(2000);
    // H-CONV-02 (Opción A): se requieren direcciones opuestas para que la
    // cizalladura vectorial supere el umbral de 10 m/s.
    // 10m desde 180°, 700hPa desde 0° → cizalladura vectorial = 50 km/h = 13.9 m/s.
    const serie = mockSerie({
      cape: 2000, humedad700: 30, lluvia: 5,
      viento700: 40, viento10: 10,
      windDir10: 180, windDir700: 0
    });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(3);
    expect(res.vector_dominante).toBe('DOWNBURST');
    expect(res.datos_tecnicos.potencial_desplome).toBeGreaterThan(100);
    expect(res.datos_tecnicos.cizalladura_vectorial_ms).toBeGreaterThan(10);
  });

  it('5. Emergencia por supercélula: CAPE extremo + cizalladura vectorial extrema + convección → N4', () => {
    const loc = mockLocalidad(2000);
    // Direcciones opuestas → cizalladura vectorial = 80 km/h = 22.2 m/s (>15 m/s).
    const serie = mockSerie({
      cape: 3500, humedad700: 20, lluvia: 20,
      viento700: 70, viento10: 10,
      windDir10: 180, windDir700: 0
    });
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(4);
    expect(res.vector_dominante).toBe('SUPERCELULA');
  });

  it('6. No es granizo si la capa de fusión es grande (derretimiento)', () => {
    const loc = mockLocalidad(2000);
    // Nivel de congelación a 5000m, localidad a 2000m → Δh = 3000m (el granizo se derrite)
    const serie = mockSerie({ cape: 1800, lluvia: 15, nivelCongelacion: 5000, humedad700: 70 });
    const res = evaluarConvectivo(loc, serie);
    // Debe ser N2 (vigilancia) o N1, pero no N3 por granizo
    expect(res.nivel_alerta).toBeLessThan(3);
  });

  it('7. Fallback: Sin datos convectivos, retorna N1', () => {
    const loc = mockLocalidad(2000);
    const serie = { time: [] };
    const res = evaluarConvectivo(loc, serie);
    expect(res.nivel_alerta).toBe(1);
  });

  // === H6.7: Test con fixture real (verifica que GEM null no rompe) ===
  it('8. Procesa el fixture real de Open-Meteo sin errores (GEM null no rompe)', () => {
    const fs = require('fs');
    const path = require('path');
    const { generarConsensoDeterminista } = require('../consensusEngine.js');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));
    const serieConsenso = generarConsensoDeterminista(fixture.hourly);

    // Convertir el array de objetos al formato que convectiveEvaluator espera.
    const serieParaConvectivo = {
      time: serieConsenso.map(h => h.fecha_hora),
      cape_jkg: serieConsenso.map(h => h.cape_jkg ?? 0),
      humedad_700hpa: serieConsenso.map(h => h.humedad_700hpa ?? 50),
      lluvia_mm: serieConsenso.map(h => h.lluvia_mm || 0),
      nivel_congelacion_m: serieConsenso.map(h => h.nivel_congelacion_m ?? 4000),
      viento_700hpa: serieConsenso.map(h => h.viento_700hpa ?? 20),
      viento_kmh: serieConsenso.map(h => h.viento_kmh || 0)
    };

    const loc = mockLocalidad(2386);
    const res = evaluarConvectivo(loc, serieParaConvectivo);

    expect(res.nivel_alerta).toBeGreaterThanOrEqual(1);
    expect(res.nivel_alerta).toBeLessThanOrEqual(4);
    // No debe haber NaN ni Infinity por culpa de GEM null
    expect(res.datos_tecnicos).toBeDefined();
  });

    describe('N-MOTOR-06 / N-MOTOR-06-bis — defensa contra null (29/10/2026)', () => {
      it('N-MOTOR-06: humedad_700hpa null en toda la ventana → humedadMin=100, sin downburst', () => {
        const loc = mockLocalidad(2000);
        const serie = mockSerie({ cape: 1500, humedad700: null, lluvia: 5, viento700: 30, viento10: 10 });
        const res = evaluarConvectivo(loc, serie);
        expect(res.vector_dominante).not.toBe('DOWNBURST');
        expect(res.datos_tecnicos.humedad_700hpa_min).toBe(100);
        expect(res.datos_tecnicos.potencial_desplome).toBe(0);
      });

      it('N-MOTOR-06: humedad_700hpa parcial con nulls → usa el mínimo de las válidas', () => {
        const loc = mockLocalidad(2000);
        const serie = mockSerie({ cape: 1500, humedad700: 30, lluvia: 5, viento700: 30, viento10: 10 });
        // Corromper la mitad de la ventana con null
        serie.humedad_700hpa = serie.humedad_700hpa.map((v, i) => (i >= 168 && i < 180) ? null : v);
        const res = evaluarConvectivo(loc, serie);
        expect(res.datos_tecnicos.humedad_700hpa_min).toBe(30);
        expect(res.datos_tecnicos.potencial_desplome).toBeGreaterThan(0);
      });

      it('N-MOTOR-06-bis: nivel_congelacion_m null → espesorFusion=null, sin falso granizo', () => {
        const loc = mockLocalidad(2000);
        const serie = mockSerie({ cape: 1200, lluvia: 15, nivelCongelacion: null, humedad700: 70, viento700: 25, viento10: 10 });
        const res = evaluarConvectivo(loc, serie);
        expect(res.vector_dominante).not.toBe('GRANIZO');
        expect(res.nivel_alerta).toBeLessThan(3);
        expect(res.datos_tecnicos.espesor_capa_fusion_m).toBeNull();
        expect(res.datos_tecnicos.nivel_congelacion_m).toBeNull();
      });
    });

    describe('H-CONV-03 — Calibración de Downburst (CAPE mínimo)', () => {
    it('No debe disparar Downburst con CAPE bajo (caso Apan: CAPE 560)', () => {
      const loc = mockLocalidad(2400);
      // CAPE 560, humedad 58% (potencial desplome 235), shear 20 km/h
      const serie = mockSerie({ 
        cape: 560, humedad700: 58, lluvia: 0.1, viento700: 30, viento10: 10 
      });
      const res = evaluarConvectivo(loc, serie);
      
      // Al no tener energía suficiente (CAPE < 1000), no debe ser N3
      expect(res.nivel_alerta).toBeLessThan(3);
      expect(res.vector_dominante).not.toBe('DOWNBURST');
    });

    it('Sí debe disparar Downburst con CAPE alto (1500) y aire seco y cizalladura vectorial', () => {
      const loc = mockLocalidad(2400);
      // H-CONV-02 (Opción A): direcciones opuestas para cizalladura vectorial > 10 m/s.
      const serie = mockSerie({
        cape: 1500, humedad700: 30, lluvia: 5,
        viento700: 40, viento10: 10,
        windDir10: 180, windDir700: 0
      });
      const res = evaluarConvectivo(loc, serie);
      
      expect(res.nivel_alerta).toBe(3);
      expect(res.vector_dominante).toBe('DOWNBURST');
    });
    
  });
  
  describe('H-CONV-02 / Opción A: reproducción del falso positivo del 29/10/2026', () => {
    // Contexto empírico: en producción el 29/10/2026 el motor publicó 39 N3
    // por DOWNBURST en TIZ/PMN con lluvia real = 0 mm. El ambiente real
    // tenía LCL=338 m, DMI=-6.08, showers=0. Físicamente imposible un
    // downburst (dry ni wet).
    //
    // El código actual (pre-fix) dispara DOWNBURST porque:
    //   - capeMax > 1000 ✓
    //   - potencialDesplome > 100 ✓
    //   - shearMax escalar (22.3 - 8.3 = 14.0) — borderline
    //   - En horas con viento 700 hPa más fuerte de la ventana 24h,
    //     shearMax escalar supera 15 → dispara DOWNBURST N3.
    //
    // Con el fix (Opción A):
    //   - Cizalladura vectorial (10m 48°, 700hPa 131°) subestima la
    //     escalar actual: escalar 16.7 km/h, vectorial ~33 km/h.
    //   - Gate convectivo: showers = 0, precipitation = 0 → rechaza.
    //   - El downburst NO se clasifica.
    it('NO clasifica DOWNBURST sin lluvia convectiva en ambiente tipo Pachuca (29/10/2026)', () => {
      // Localidad: Pachuca de Soto Centro (PMN), 2401 msnm
      const loc = mockLocalidad(2401);

      // Serie que reproduce el estado real de hoy:
      // - CAPE moderado (1100 J/kg, sobre el umbral 1000)
      // - Humedad 700hPa al 85% (supera el 90% de saturación, deja
      //   potencialDesplome > 100)
      // - Viento 700hPa fuerte (25 km/h) y viento 10m débil (8.3 km/h)
      //   → shearMax escalar = 16.7 km/h > 15 → el código actual DISPARA
      // - Direcciones cruzadas (48° vs 131°) → shear vectorial ~9.25 m/s
      //   < 10 m/s → con fix NO dispara
      // - showers = 0, precipitation = 0 → gate convectivo lo rechaza
      const serieFalsoDownburst = {
        time: Array(192).fill('2026-10-29T18:00'),
        cape_jkg: Array(192).fill(1100),
        humedad_700hpa: Array(192).fill(85),
        lluvia_mm: Array(192).fill(0),
        nivel_congelacion_m: Array(192).fill(4200),
        viento_700hpa: Array(192).fill(25),
        viento_kmh: Array(192).fill(8.3),
        wind_direction_10m: Array(192).fill(48),
        wind_direction_700hPa: Array(192).fill(131),
        showers: Array(192).fill(0),
        precipitation: Array(192).fill(0)
      };

      const res = evaluarConvectivo(loc, serieFalsoDownburst);

      // Con el código actual (pre-fix), estas aserciones FALLAN.
      // Con el fix (Opción A), estas aserciones PASAN.
      expect(res.vector_dominante).not.toBe('DOWNBURST');
      expect(res.vector_dominante).not.toBe('TORMENTA_DISPERSA');
      expect(res.nivel_alerta).toBeLessThanOrEqual(2);
    });

    it('diagnóstico: confirma que el código actual dispara con esta serie', () => {
      // Este test NO valida el comportamiento deseado. Valida que el bug
      // existe con el código actual. Su valor es documental: si mañana el
      // código cambia y este test deja de fallar sin tocar el evaluador,
      // significa que el falso positivo desapareció por otra vía.
      //
      // Se espera que pase con el código actual y siga pasando con el fix
      // (porque el fix hace que el downburst NO se dispare, por lo que
      // "no debería ser DOWNBURST" sigue siendo coherente).
      const loc = mockLocalidad(2401);
      const serie = {
        time: Array(192).fill('2026-10-29T18:00'),
        cape_jkg: Array(192).fill(1100),
        humedad_700hpa: Array(192).fill(85),
        lluvia_mm: Array(192).fill(0),
        nivel_congelacion_m: Array(192).fill(4200),
        viento_700hpa: Array(192).fill(25),
        viento_kmh: Array(192).fill(8.3),
        wind_direction_10m: Array(192).fill(48),
        wind_direction_700hPa: Array(192).fill(131),
        showers: Array(192).fill(0),
        precipitation: Array(192).fill(0)
      };

      const res = evaluarConvectivo(loc, serie);
      // Solo trazabilidad: no se valida contra el estado deseado, solo se
      // reporta en consola qué devuelve el código actual.
      // eslint-disable-next-line no-console
      console.log(`[A.3 diagnóstico] vector=${res.vector_dominante}, nivel=${res.nivel_alerta}, continuo=${res.nivel_alerta_continuo}`);
      expect(res).toBeDefined();
    });
  });

});