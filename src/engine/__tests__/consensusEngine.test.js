/**
 * Tests de consensusEngine.js
 *
 * H7a.2 — Migración de test_consenso.mjs a Vitest.
 *
 * A diferencia del test original:
 * - No hace fetch a Open-Meteo (usa datos sintéticos).
 * - Tiene asserts reales (no solo console.log).
 * - Incluye el caso del bug N18 (visibilidad real).
 * - Se ejecuta con `npm test`.
 */

import { describe, it, expect } from 'vitest';
import { generarConsensoDeterminista } from '../consensusEngine.js';

/**
 * Helper: construye un objeto `datosHorarios` sintético compatible con
 * el que devuelve Open-Meteo (con sufijos _gfs_seamless, _icon_seamless, _gem_seamless).
 */
function construirDatosSinteticos({ horas = 3, precipitaciones = [0, 0, 0] } = {}) {
  const time = Array.from({ length: horas }, (_, i) => `2026-10-20T0${i}:00`);

  return {
    time,
    // Precipitación: 3 modelos
    precipitation_gfs_seamless: precipitaciones,
    precipitation_icon_seamless: precipitaciones,
    precipitation_gem_seamless: precipitaciones,
    // Temperatura
    temperature_2m_gfs_seamless: Array(horas).fill(15),
    temperature_2m_icon_seamless: Array(horas).fill(15),
    temperature_2m_gem_seamless: Array(horas).fill(15),
    // Viento
    wind_speed_10m_gfs_seamless: Array(horas).fill(10),
    wind_speed_10m_icon_seamless: Array(horas).fill(10),
    wind_speed_10m_gem_seamless: Array(horas).fill(10),
    // Ráfagas
    wind_gusts_10m_gfs_seamless: Array(horas).fill(20),
    wind_gusts_10m_icon_seamless: Array(horas).fill(20),
    wind_gusts_10m_gem_seamless: Array(horas).fill(20),
    // Humedad
    relative_humidity_2m_gfs_seamless: Array(horas).fill(60),
    relative_humidity_2m_icon_seamless: Array(horas).fill(60),
    relative_humidity_2m_gem_seamless: Array(horas).fill(60),
    // Visibilidad (solo GFS la provee)
    visibility_gfs_seamless: Array(horas).fill(10000),
  };
}

describe('generarConsensoDeterminista', () => {
  it('devuelve array vacío si datosHorarios es null o vacío', () => {
    expect(generarConsensoDeterminista(null)).toEqual([]);
    expect(generarConsensoDeterminista({})).toEqual([]);
    expect(generarConsensoDeterminista({ time: [] })).toEqual([]);
  });

  it('devuelve la misma cantidad de horas que el input', () => {
    const datos = construirDatosSinteticos({ horas: 5 });
    const serie = generarConsensoDeterminista(datos);
    expect(serie).toHaveLength(5);
  });

  it('calcula la mediana de precipitación (3 modelos iguales)', () => {
    const datos = construirDatosSinteticos({ precipitaciones: [5.0, 5.0, 5.0] });
    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.lluvia_mm).toBe(5.0);
    });
  });

  it('aplica filtro de ceros espurios: si 2 modelos coinciden en lluvia y 1 es 0, ignora el 0', () => {
    const datos = construirDatosSinteticos();
    // 2 modelos dicen 5.0, 1 dice 0.0 → la mediana debe ser 5.0 (filtro activo)
    datos.precipitation_gfs_seamless = [5.0, 5.0, 5.0];
    datos.precipitation_icon_seamless = [5.0, 5.0, 5.0];
    datos.precipitation_gem_seamless = [0.0, 0.0, 0.0];

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.lluvia_mm).toBe(5.0);
    });
  });

  it('sin filtro de ceros: si los 3 modelos tienen lluvia, usa la mediana real', () => {
    const datos = construirDatosSinteticos();
    // 3 modelos con lluvia (>= 0.5) → no filtra. Mediana de [1, 3, 6] = 3.
    datos.precipitation_gfs_seamless = [1.0, 1.0, 1.0];
    datos.precipitation_icon_seamless = [3.0, 3.0, 3.0];
    datos.precipitation_gem_seamless = [6.0, 6.0, 6.0];

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.lluvia_mm).toBe(3.0);
    });
  });

  it('filtro de ceros: si 2 modelos dicen "hay lluvia" y 1 dice "no hay", ignora el cero', () => {
    const datos = construirDatosSinteticos();
    // 2 con lluvia (3 y 6), 1 con cero → filtra el cero. Mediana de [3, 6] = 4.5.
    datos.precipitation_gfs_seamless = [0.0, 0.0, 0.0];
    datos.precipitation_icon_seamless = [3.0, 3.0, 3.0];
    datos.precipitation_gem_seamless = [6.0, 6.0, 6.0];

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.lluvia_mm).toBe(4.5);
    });
  });

  it('usa el MÁXIMO de ráfagas (criterio conservador)', () => {
    const datos = construirDatosSinteticos();
    datos.wind_gusts_10m_gfs_seamless = [30, 30, 30];
    datos.wind_gusts_10m_icon_seamless = [50, 50, 50];
    datos.wind_gusts_10m_gem_seamless = [40, 40, 40];

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.rafagas_kmh).toBe(50);
    });
  });

  it('clasifica confiabilidad como ALTA si dispersión <= 4', () => {
    const datos = construirDatosSinteticos();
    datos.precipitation_gfs_seamless = [5.0, 5.0, 5.0];
    datos.precipitation_icon_seamless = [6.0, 6.0, 6.0];
    datos.precipitation_gem_seamless = [4.0, 4.0, 4.0];
    // dispersión = 6 - 4 = 2 → ALTA

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.confiabilidad).toBe('ALTA');
    });
  });

  it('clasifica confiabilidad como MODERADA si dispersión entre 4 y 12', () => {
    const datos = construirDatosSinteticos();
    datos.precipitation_gfs_seamless = [15.0, 15.0, 15.0];
    datos.precipitation_icon_seamless = [8.0, 8.0, 8.0];
    datos.precipitation_gem_seamless = [3.0, 3.0, 3.0];
    // dispersión = 15 - 3 = 12 → borde. Para MODERADA necesitamos entre 4 y 12.
    // Ajustamos: dispersión = 10.
    datos.precipitation_gfs_seamless = [13.0, 13.0, 13.0];
    datos.precipitation_icon_seamless = [8.0, 8.0, 8.0];
    datos.precipitation_gem_seamless = [3.0, 3.0, 3.0];

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.confiabilidad).toBe('MODERADA');
    });
  });

  it('clasifica confiabilidad como EN_DISPUTA si dispersión > 12', () => {
    const datos = construirDatosSinteticos();
    datos.precipitation_gfs_seamless = [20.0, 20.0, 20.0];
    datos.precipitation_icon_seamless = [10.0, 10.0, 10.0];
    datos.precipitation_gem_seamless = [0.0, 0.0, 0.0];
    // dispersión = 20 - 0 = 20 → EN_DISPUTA

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.confiabilidad).toBe('EN_DISPUTA');
    });
  });

  it('lee visibilidad de visibility_gfs_seamless (N18: no debe quedar en 10km por default)', () => {
    const datos = construirDatosSinteticos();
    // Visibilidad reducida por niebla: 1.5 km = 1500 m
    datos.visibility_gfs_seamless = [1500, 1500, 1500];

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.visibility_km).toBe(1.5);
    });
  });

  it('usa visibility genérica si visibility_gfs_seamless no está (fallback intermedio)', () => {
    const datos = construirDatosSinteticos();
    // Eliminamos el sufijo _gfs_seamless, pero dejamos visibility
    delete datos.visibility_gfs_seamless;
    datos.visibility = [2000, 2000, 2000]; // 2000 metros = 2 km

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      // El motor debe usar visibility (2km), no el fallback de 10km
      expect(h.visibility_km).toBe(2);
    });
  });

  it('usa 10km como fallback si visibility_gfs_seamless no está', () => {
    const datos = construirDatosSinteticos();
    delete datos.visibility_gfs_seamless;

    const serie = generarConsensoDeterminista(datos);
    serie.forEach(h => {
      expect(h.visibility_km).toBe(10);
    });
  });
});