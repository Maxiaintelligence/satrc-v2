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

    // === H6.7: Tests con fixture real de Open-Meteo ===

  it('procesa el fixture real de Open-Meteo sin errores', () => {
    // Cargar el fixture real
    const fs = require('fs');
    const path = require('path');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));

    const serie = generarConsensoDeterminista(fixture.hourly);

    // Debe devolver 240 horas
    expect(serie).toHaveLength(240);

    // Cada hora debe tener todos los campos (nuevos y viejos)
    const hora = serie[168];  // ahora
    expect(hora).toHaveProperty('lluvia_mm');
    expect(hora).toHaveProperty('temperatura_c');
    expect(hora).toHaveProperty('presion_hpa');
    expect(hora).toHaveProperty('sensacion_termica_c');
    expect(hora).toHaveProperty('cobertura_nubosa_pct');
    expect(hora).toHaveProperty('bulbo_humedo_c');
    expect(hora).toHaveProperty('cape_jkg');
    expect(hora).toHaveProperty('nivel_congelacion_m');
    expect(hora).toHaveProperty('humedad_700hpa');
    expect(hora).toHaveProperty('viento_700hpa');
  });

  it('usa GFS como fallback de freezing_level_height cuando GEM es null', () => {
    const fs = require('fs');
    const path = require('path');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));

    // Confirmar que GEM tiene nulls en el fixture
    const gemNulls = fixture.hourly.freezing_level_height_gem_seamless.filter(v => v === null).length;
    expect(gemNulls).toBe(240);  // Todos null

    // La consensuación debe usar GFS como fallback
    const serie = generarConsensoDeterminista(fixture.hourly);
    const hora = serie[168];
    expect(hora.nivel_congelacion_m).not.toBeNull();
    expect(hora.nivel_congelacion_m).toBeGreaterThan(4000);  // Rango típico de Pachuca
  });

  it('el fixture real produce series de 240 horas con confiabilidad', () => {
    const fs = require('fs');
    const path = require('path');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));

    const serie = generarConsensoDeterminista(fixture.hourly);

    expect(serie).toHaveLength(240);
    serie.forEach(h => {
      expect(['ALTA', 'MODERADA', 'EN_DISPUTA']).toContain(h.confiabilidad);
    });
  });

  // N-FETCH-01 (29/10/2026): blindaje de la premisa estructural del motor.
  // Todo el pipeline (riskEvaluator, windEvaluator, thermalEvaluator,
  // convectiveEvaluator, calcularContextoNiebla, reportesRegionales) asume
  // que serie[168] es la medianoche local del día de emisión. Si Open-Meteo
  // cambia la política de alineación (ej. hora actual en vez de medianoche),
  // las reglas se desplazan silenciosamente. Este test detecta la regresión
  // contra el fixture real capturado el 21-22/10/2026.
  it('fixture real: la serie está alineada a medianoche local (N-FETCH-01)', () => {
    const fs = require('fs');
    const path = require('path');
    const rutaFixture = path.join(__dirname, 'fixtures', 'openmeteo_sample.json');
    const fixture = JSON.parse(fs.readFileSync(rutaFixture, 'utf-8'));

    // 1. Zona horaria y offset
    expect(fixture.timezone).toBe('America/Mexico_City');
    expect(fixture.utc_offset_seconds).toBe(-21600); // UTC-6 sin DST

    // 2. Estructura de 240 horas
    expect(fixture.hourly.time).toHaveLength(240);

    // 3. Alineación midnight en los índices críticos
    expect(fixture.hourly.time[0]).toMatch(/T00:00$/);   // inicio de la serie
    expect(fixture.hourly.time[144]).toMatch(/T00:00$/); // inicio de "ayer"
    expect(fixture.hourly.time[168]).toMatch(/T00:00$/); // inicio de "hoy"
    expect(fixture.hourly.time[192]).toMatch(/T00:00$/); // inicio de "mañana"
    expect(fixture.hourly.time[239]).toMatch(/T23:00$/); // fin de la serie

    // 4. Consecutividad (no hay huecos entre horas)
    for (let i = 1; i < fixture.hourly.time.length; i++) {
      const horaActual = parseInt(fixture.hourly.time[i].slice(11, 13), 10);
      const horaAnterior = parseInt(fixture.hourly.time[i - 1].slice(11, 13), 10);
      const esperada = (horaAnterior + 1) % 24;
      expect(horaActual).toBe(esperada);
    }
  });

  it('cape_jkg filtra nulls de GEM antes de aplicar Math.max (N-TEST-11)', () => {
    const fs = require('fs');
    const path = require('path');

    // 1. Cargar fixture real de Open-Meteo
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures', 'openmeteo_sample.json'),
        'utf-8'
      )
    );

    // 2. Extraer las tres series de CAPE por modelo
    const gfs = fixture.hourly.cape_gfs_seamless;
    const icon = fixture.hourly.cape_icon_seamless;
    const gem = fixture.hourly.cape_gem_seamless;

    expect(gfs).toBeDefined();
    expect(icon).toBeDefined();
    expect(gem).toBeDefined();

    // 3. Precondición: el fixture debe ejercitar el caso
    //    (si el fixture se regenera y pierde el patrón, este test debe fallar)
    const gemNulls = gem.filter(v => v === null).length;
    const horasConGemNullYAlgunoValido = [];
    for (let i = 0; i < gem.length; i++) {
      if (gem[i] === null && (Number.isFinite(gfs[i]) || Number.isFinite(icon[i]))) {
        horasConGemNullYAlgunoValido.push(i);
      }
    }

    expect(gemNulls, 'el fixture debe tener al menos un null en GEM').toBeGreaterThan(0);
    expect(
      horasConGemNullYAlgunoValido.length,
      'el fixture debe tener horas con GEM null y GFS o ICON válido'
    ).toBeGreaterThan(0);

    // 4. Construir la serie y verificar las 240 horas
    const serie = generarConsensoDeterminista(fixture.hourly);
    expect(serie).toHaveLength(240);

    serie.forEach((h, i) => {
      const gfsV = gfs[i];
      const iconV = icon[i];
      const gemV = gem[i];

      const validos = [gfsV, iconV, gemV].filter(
        v => v !== null && v !== undefined && Number.isFinite(v)
      );

      if (validos.length === 0) {
        expect(h.cape_jkg, `posición ${i}: sin válidos → null`).toBeNull();
      } else {
        const esperado = parseFloat(Math.max(...validos).toFixed(1));
        expect(h.cape_jkg, `posición ${i}`).toBe(esperado);
      }
    });

    // 5. Diagnóstico legible: las 5 primeras horas del patrón conocido [3,4,5,6,7]
    //    (Prueba C confirmó que son los primeros índices con GEM null y GFS/ICON válidos)
    const horasDiagnostico = [3, 4, 5, 6, 7];
    horasDiagnostico.forEach(i => {
      expect(gem[i], `fixture gem[${i}] debe ser null`).toBeNull();
      expect(
        Number.isFinite(gfs[i]) || Number.isFinite(icon[i]),
        `posición ${i}: GFS o ICON debe ser finito`
      ).toBe(true);
      const esperado = parseFloat(Math.max(gfs[i], icon[i]).toFixed(1));
      expect(serie[i].cape_jkg, `posición ${i} (GEM null)`).toBe(esperado);
    });
  });

});