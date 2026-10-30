/**
 * Tests de cizalladura vectorial y showers en consensusEngine.js
 * H-CONV-02 / Opción A (29/10/2026)
 *
 * Cobertura:
 * 1. Conversión speed+dir → u, v (convención meteorológica).
 * 2. Reconstrucción dir a partir de u, v (ida y vuelta).
 * 3. Consenso vectorial con los 3 modelos coincidentes.
 * 4. Consenso vectorial con 1 modelo null (usa mediana de 2).
 * 5. Consenso de showers con los 3 modelos.
 * 6. Cizalladura vectorial > cizalladura escalar en cambio de dirección.
 */

import { describe, it, expect } from 'vitest';
import { generarConsensoDeterminista } from '../consensusEngine.js';

function construirSerie({
  horas = 3,
  windSpeed10m = [10, 10, 10],
  windDir10m = [48, 48, 48],
  windSpeed700 = [20, 20, 20],
  windDir700 = [131, 131, 131],
  showersGfs = Array(horas).fill(0),
  showersIcon = Array(horas).fill(0),
  showersGem = Array(horas).fill(0),
  gemNullsDir10m = false,
  gemNullsShowers = false
} = {}) {
  const time = Array.from({ length: horas }, (_, i) => `2026-10-29T${String(i).padStart(2, '0')}:00`);

  const datos = {
    time,
    // Precipitación base (necesaria para el loop)
    precipitation_gfs_seamless: Array(horas).fill(0),
    precipitation_icon_seamless: Array(horas).fill(0),
    precipitation_gem_seamless: Array(horas).fill(0),
    // Temperatura base
    temperature_2m_gfs_seamless: Array(horas).fill(15),
    temperature_2m_icon_seamless: Array(horas).fill(15),
    temperature_2m_gem_seamless: Array(horas).fill(15),
    // Viento superficie
    wind_speed_10m_gfs_seamless: windSpeed10m,
    wind_speed_10m_icon_seamless: windSpeed10m,
    wind_speed_10m_gem_seamless: windSpeed10m,
    wind_direction_10m_gfs_seamless: windDir10m,
    wind_direction_10m_icon_seamless: windDir10m,
    wind_direction_10m_gem_seamless: gemNullsDir10m ? Array(horas).fill(null) : windDir10m,
    // Ráfagas (necesarias para el loop)
    wind_gusts_10m_gfs_seamless: Array(horas).fill(20),
    wind_gusts_10m_icon_seamless: Array(horas).fill(20),
    wind_gusts_10m_gem_seamless: Array(horas).fill(20),
    // Humedad
    relative_humidity_2m_gfs_seamless: Array(horas).fill(60),
    relative_humidity_2m_icon_seamless: Array(horas).fill(60),
    relative_humidity_2m_gem_seamless: Array(horas).fill(60),
    // Visibilidad
    visibility_gfs_seamless: Array(horas).fill(10000),
    // Viento 700 hPa
    wind_speed_700hPa_gfs_seamless: windSpeed700,
    wind_speed_700hPa_icon_seamless: windSpeed700,
    wind_speed_700hPa_gem_seamless: windSpeed700,
    wind_direction_700hPa_gfs_seamless: windDir700,
    wind_direction_700hPa_icon_seamless: windDir700,
    wind_direction_700hPa_gem_seamless: windDir700,
    // Showers (precipitación convectiva)
    showers_gfs_seamless: showersGfs,
    showers_icon_seamless: showersIcon,
    showers_gem_seamless: gemNullsShowers ? Array(horas).fill(null) : showersGem
  };

  return datos;
}

describe('consensusEngine — cizalladura vectorial y showers (H-CONV-02)', () => {
  it('1. Convierte speed+dir a componentes u,v con convención meteorológica', () => {
    // 10 km/h desde 48° (NE): u,v negativos (viento del NE sopla hacia el SO)
    const serie = generarConsensoDeterminista(construirSerie({ horas: 1 }));
    const h = serie[0];
    // speed_ms = 10/3.6 = 2.778
    // u = -2.778*sin(48°) = -2.064
    // v = -2.778*cos(48°) = -1.858
    expect(h.u10_ms).toBeCloseTo(-2.06, 1);
    expect(h.v10_ms).toBeCloseTo(-1.86, 1);
  });

  it('2. Reconstruye la dirección original desde componentes u,v (ida y vuelta)', () => {
    const serie = generarConsensoDeterminista(construirSerie({ horas: 1 }));
    const h = serie[0];
    expect(h.wind_direction_10m).toBe(48);
    expect(h.wind_direction_700hpa).toBe(131);
  });

  it('3. Consenso vectorial con los 3 modelos coincidentes', () => {
    const serie = generarConsensoDeterminista(construirSerie({ horas: 3 }));
    expect(serie).toHaveLength(3);
    serie.forEach(h => {
      expect(h.u10_ms).not.toBeNull();
      expect(h.v10_ms).not.toBeNull();
      expect(h.wind_direction_10m).toBe(48);
    });
  });

  it('4. Consenso vectorial con GEM null en dirección: usa mediana de 2 (GFS+ICON)', () => {
    const serie = generarConsensoDeterminista(construirSerie({ horas: 1, gemNullsDir10m: true }));
    const h = serie[0];
    // GFS e ICON tienen 48° con 10 km/h → mismos u,v. Mediana de 2.
    expect(h.u10_ms).not.toBeNull();
    expect(h.wind_direction_10m).toBe(48);
  });

  it('5. Consenso de showers: mediana de los 3 modelos en la misma hora', () => {
    // 3 modelos, 1 hora, valores distintos: [0, 0.5, 0.3] → mediana = 0.3
    const serie = generarConsensoDeterminista(construirSerie({
      horas: 1,
      showersGfs: [0],
      showersIcon: [0.5],
      showersGem: [0.3]
    }));
    expect(serie[0].showers_mm).toBe(0.3);
  });

  it('5.bis. Consenso de showers con GEM null: usa mediana de los 2 válidos', () => {
    // Solo GFS=0.4 y ICON=0.6 son válidos. Mediana de [0.4, 0.6] = 0.5
    const serie = generarConsensoDeterminista(construirSerie({
      horas: 1,
      showersGfs: [0.4],
      showersIcon: [0.6],
      showersGem: [0],
      gemNullsShowers: true
    }));
    expect(serie[0].showers_mm).toBe(0.5);
  });

  it('6. Cizalladura vectorial > diferencia escalar cuando hay cambio de dirección', () => {
    // Escenario real del 29/10/2026 en Pachuca:
    // - 10m: 10 km/h desde 48° (NE)
    // - 700hPa: 20 km/h desde 131° (SE)
    // Diferencia escalar: |20 - 10| / 3.6 = 2.78 m/s
    // Vectorial: cambio de 83° de dirección → shear grande
    const serie = generarConsensoDeterminista(construirSerie({ horas: 1 }));
    const h = serie[0];

    const diffEscalar = Math.abs(h.viento_700hpa - h.viento_kmh) / 3.6;
    const shearVectorial = Math.sqrt(
      Math.pow(h.u700_ms - h.u10_ms, 2) + Math.pow(h.v700_ms - h.v10_ms, 2)
    );

    expect(shearVectorial).toBeGreaterThan(diffEscalar * 1.3);
    expect(shearVectorial).toBeGreaterThan(2.0);
  });
});