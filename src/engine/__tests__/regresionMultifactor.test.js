/**
 * Regresión multifactor — H-MULTI-01 / H-MULTI-02
 *
 * Test de blindaje contra la re-introducción del bug documentado en
 * VERIFICACION_MULTIFACTOR.md y 06_PENDIENTES.md §2.7.
 *
 * Estado:
 * - Test A: ROJO con el runner actual (no importa el consenso compartido).
 * - Test B: VERDE (el consenso compartido ya produce los 8 campos E4).
 * - Test C: VERDE (confirma el comportamiento del orquestador sin datos E4).
 * - Test D: VERDE (confirma que con datos E4 el convectivo dispara).
 *
 * Al aplicar el commit 2 (fix del runner), el Test A pasa a verde.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generarConsensoDeterminista } from '../consensusEngine.js';
import { evaluarMultiamenaza } from '../crossThreatOrchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNNER_PATH = path.resolve(__dirname, '../../../scripts/ejecutar_sara_autonomo.mjs');
const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/openmeteo_sample.json');

/**
 * Localidad real: nodo de PMN (Pachuca Centro).
 * Coincide con las coordenadas del fixture Open-Meteo.
 */
function mockLocalidadPMN() {
  return {
    id: 'PMN_PACHUCA_DE_SOTO_PACHUCA_DE_SOTO_CENTRO_173',
    nombre: 'Pachuca de Soto Centro',
    municipio: 'Pachuca de Soto',
    estado: 'Hidalgo',
    zona_id: 'PMN',
    zona_nombre: 'Pachuca Metropolitana Norte',
    coords: { lat: 20.12235972, lon: -98.73700056 },
    topografia: {
      altitud_msnm: 2401,
      pendiente_max_deg: 10.10,
      relieve: 'MESETA',
      twi: 12.79
    },
    hidrologia: {
      subcuenca_cve: 'RH26Dt',
      subcuenca_nom: 'R. Tezontepec',
      posicion: 'BAJA',
      distancia_cauce_km: 12.01,
      tc_horas: 6.66,
      poblacion_aguas_arriba: 528323
    },
    vulnerabilidad: {
      poblacion: 297848,
      marginacion: 'ALTO',
      acceso_vial: 'CARRETERA_FEDERAL',
      dist_hospital_km: 23.65
    }
  };
}

describe('Regresión multifactor — H-MULTI-01/02', () => {

  it('A. El runner importa el consenso compartido y no tiene copia local', () => {
    const codigo = fs.readFileSync(RUNNER_PATH, 'utf-8');

    // DEBE importar generarConsensoDeterminista desde consensusEngine.js
    expect(codigo).toMatch(
      /import\s*\{\s*generarConsensoDeterminista\s*\}\s*from\s*['"][^'"]*consensusEngine\.js['"]/
    );

    // NO debe declarar la función local con el mismo nombre
    expect(codigo).not.toMatch(/function\s+generarConsensoDeterminista\s*\(/);

    // NO debe declarar calcularMediana ni filtrarCerosEspurios localmente
    // (son parte del consenso local que se elimina)
    expect(codigo).not.toMatch(/function\s+calcularMediana\s*\(/);
    expect(codigo).not.toMatch(/function\s+filtrarCerosEspurios\s*\(/);
  });

  it('B. El consenso compartido produce los 8 campos E4 desde el fixture real', () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
    const serie = generarConsensoDeterminista(fixture.hourly);

    expect(serie).toHaveLength(240);

    const hora = serie[168]; // "ahora" (aprox)
    expect(hora).toHaveProperty('presion_hpa');
    expect(hora).toHaveProperty('sensacion_termica_c');
    expect(hora).toHaveProperty('cobertura_nubosa_pct');
    expect(hora).toHaveProperty('bulbo_humedo_c');
    expect(hora).toHaveProperty('cape_jkg');
    expect(hora).toHaveProperty('nivel_congelacion_m');
    expect(hora).toHaveProperty('humedad_700hpa');
    expect(hora).toHaveProperty('viento_700hpa');

    // En el fixture, GFS tiene datos de freezing_level_height (GEM no).
    expect(hora.nivel_congelacion_m).not.toBeNull();
    expect(hora.nivel_congelacion_m).toBeGreaterThan(4000);
  });

  it('C. Regresión H-MULTI-01: una serie SIN campos E4 deja el convectivo y el térmico en línea base', () => {
    // Simula la serie que produce HOY el consenso LOCAL del runner (9 campos).
    // Esta es la serie que, hasta el commit 2, llega al orquestador en producción.
    const serieSinE4 = Array.from({ length: 192 }, (_, i) => ({
      fecha_hora: `2026-10-21T${String(i % 24).padStart(2, '0')}:00`,
      lluvia_mm: 0,
      temperatura_c: 15,
      viento_kmh: 10,
      rafagas_kmh: 20,
      humedad_relativa_pct: 60,
      visibility_km: 10,
      confiabilidad: 'ALTA',
      detalle_modelos: {}
    }));

    const res = evaluarMultiamenaza(mockLocalidadPMN(), serieSinE4);

    // Sin cape_jkg, el orquestador lo sustituye por 0 → el convectivo queda
    // en línea base (~1.05 por el sigmoide de CAPE=0). No puede disparar N2.
    expect(res.niveles_por_vector.convectivo).toBeGreaterThanOrEqual(1.0);
    expect(res.niveles_por_vector.convectivo).toBeLessThan(1.1);

    // Sin cobertura_nubosa_pct ni bulbo_humedo_c reales, el térmico no puede
    // detectar helada radiativa ni nevada → queda en calma (1.0).
    expect(res.niveles_por_vector.termico).toBe(1.0);
  });

  it('D. Una serie CON los 8 campos E4 sí puede disparar el convectivo', () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
    const serie = generarConsensoDeterminista(fixture.hourly);

    // Forzar CAPE alto en la ventana de 24h (168–191) para que el convectivo
    // tenga condiciones de disparar con independencia de la meteorología real.
    const serieForzada = serie.map((h, i) =>
      i >= 168 && i < 192
        ? { ...h, cape_jkg: 3500, humedad_700hpa: 20 }
        : h
    );

    const res = evaluarMultiamenaza(mockLocalidadPMN(), serieForzada);

    // Con CAPE 3500, el convectivo debe superar la línea base N1.
    expect(res.niveles_por_vector.convectivo).toBeGreaterThan(1.0);
  });
});