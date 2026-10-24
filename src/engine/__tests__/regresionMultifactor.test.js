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
import { generarResumenMultivector } from '../../lib/compartido/bitacora.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNNER_PATH = path.resolve(__dirname, '../../../scripts/ejecutar_sara_autonomo.mjs');
const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/openmeteo_sample.json');
const REPORTE_DIARIO_PATH = path.resolve(__dirname, '../../../scripts/reportes/reporteDiario.mjs');

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

   it('E. Regresión H-MULTI-04: distingue 0 reales de ausentes con ??', () => {
    // Serie con 0 reales (helada radiativa perfecta: despejado, sin viento, 0°C)
    const serieCeroReal = Array.from({ length: 192 }, (_, i) => ({
      fecha_hora: `2026-10-21T${String(i % 24).padStart(2, '0')}:00`,
      lluvia_mm: 0,
      temperatura_c: 0,        // 0 °C real
      sensacion_termica_c: 0,  // 0 °C real
      rafagas_kmh: 0,          // Sin viento real
      viento_kmh: 0,
      cobertura_nubosa_pct: 0, // Cielo totalmente despejado (real)
      bulbo_humedo_c: 0,       // 0 °C real
      cape_jkg: 0,
      humedad_700hpa: 50,
      nivel_congelacion_m: 4000,
      presion_hpa: 1013,
      viento_700hpa: 20
    }));

    const res = evaluarMultiamenaza(mockLocalidadPMN(), serieCeroReal);

    // Con `||`, el orquestador convertiría temperatura_c:0 en 15 y la helada
    // radiativa se perdería (nivel térmico = 1.0).
    // Con `??`, la helada se detecta. H-TERM-01 corregido: el continuo
    // térmico respeta el contrato [nivel, nivel + 0.99]; una helada N3
    // debe dar continuo entre 3.0 y 3.99 (antes del fix daba 2.64).
    expect(res.niveles_por_vector.termico).toBeGreaterThanOrEqual(3.0);
    expect(res.niveles_por_vector.termico).toBeLessThanOrEqual(3.99);

    // Confirmar que el diagnóstico es de helada, no "sin datos"
    expect(res.diagnosticos_por_vector.termico.titulo).toMatch(/Helada|Frío/i);
  });

  it('F. Bug latente: Math.min(...[]) no debe romper cuando nivel_congelacion_m es null', () => {
    const serieNulls = Array.from({ length: 192 }, (_, i) => ({
      fecha_hora: `2026-10-21T${String(i % 24).padStart(2, '0')}:00`,
      lluvia_mm: 0,
      temperatura_c: 15,
      sensacion_termica_c: 15,
      rafagas_kmh: 20,
      viento_kmh: 10,
      cobertura_nubosa_pct: 50,
      bulbo_humedo_c: 10,
      cape_jkg: 0, // idéntico al test C para que el continuo sea 1.05
      humedad_700hpa: 60,
      nivel_congelacion_m: null, // Todos nulos
      presion_hpa: 1013,
      viento_700hpa: 20
    }));

    const res = evaluarMultiamenaza(mockLocalidadPMN(), serieNulls);

    // No debe devolver Infinity ni romper. El convectivo queda en línea base.
    expect(res.niveles_por_vector.convectivo).toBeGreaterThanOrEqual(1.0);
    expect(res.niveles_por_vector.convectivo).toBeLessThan(1.1);
    expect(res.niveles_por_vector.termico).toBe(1.0);
  });

    it('G. Regresión H-MULTI-02: registra disponibilidad de datos por vector (serie sin E4)', () => {
    const serieSinE4 = Array.from({ length: 192 }, (_, i) => ({
      fecha_hora: `2026-10-21T${String(i % 24).padStart(2, '0')}:00`,
      lluvia_mm: 0,
      temperatura_c: 15,
      viento_kmh: 10,
      rafagas_kmh: 20,
      humedad_relativa_pct: 60,
      visibility_km: 10
      // sin sensacion_termica_c, cobertura_nubosa_pct, cape_jkg, nivel_congelacion_m
    }));

    const res = evaluarMultiamenaza(mockLocalidadPMN(), serieSinE4);
    expect(res.datos_disponibles_por_vector).toBeDefined();
    expect(res.datos_disponibles_por_vector.hidrologico).toBe(true);
    expect(res.datos_disponibles_por_vector.viento).toBe(true);
    expect(res.datos_disponibles_por_vector.termico).toBe(false);
    expect(res.datos_disponibles_por_vector.convectivo).toBe(false);
  });

  it('H. Regresión H-MULTI-02: serie con E4 marca todos los vectores como disponibles', () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
    const serie = generarConsensoDeterminista(fixture.hourly);
    const res = evaluarMultiamenaza(mockLocalidadPMN(), serie);
    expect(res.datos_disponibles_por_vector.termico).toBe(true);
    expect(res.datos_disponibles_por_vector.convectivo).toBe(true);
  });

  it('I. Regresión H-MULTI-02: bitácora muestra SIN_DATOS cuando falta el vector', () => {
    const mockEvaluaciones = [
      {
        nivel_alerta: 3,
        vector_dominante: 'HIDROLOGICO',
        nombre: 'Pachuca',
        datos_disponibles_por_vector: {
          hidrologico: true,
          viento: true,
          termico: false,
          convectivo: false
        }
      }
    ];
    const resumen = generarResumenMultivector(mockEvaluaciones);
    expect(resumen).toContain('termico:SIN_DATOS');
    expect(resumen).toContain('conv:SIN_DATOS');
    expect(resumen).toContain('hidro:1');
  });

  it('J. Expone el subtipo de amenaza estructurado para SARA (H-PROMPT-02)', () => {
    // Serie con lluvia muy ligera y bulbo húmedo bajo: forzará una Nevada (Térmico N3)
    // sin activar el vector hidrológico (que requiere >= 8mm para N2).
    const serieNevada = Array.from({ length: 192 }, (_, i) => ({
      fecha_hora: `2026-10-21T${String(i % 24).padStart(2, '0')}:00`,
      lluvia_mm: 0.1, temperatura_c: 1, sensacion_termica_c: -1, // 👈 lluvia_mm cambiado a 0.1
      rafagas_kmh: 0, viento_kmh: 0, cobertura_nubosa_pct: 90,
      bulbo_humedo_c: 0.5, cape_jkg: 0, humedad_700hpa: 50,
      nivel_congelacion_m: 2700, presion_hpa: 1013, viento_700hpa: 20
    }));
    
    const res = evaluarMultiamenaza(mockLocalidadPMN(), serieNevada);
    
    // El orquestador debe detectar el subtipo exacto
    expect(res.tipo_amenaza).toBe('NEVADA');
    expect(res.vector_dominante).toBe('TERMICO');
  });
  describe('H-BITACORA-01 / H-REPORTE-01 — blindaje estático', () => {
    it('K. reporteDiario.mjs NO escribe bitácora (fix H-BITACORA-01)', () => {
      const codigo = fs.readFileSync(REPORTE_DIARIO_PATH, 'utf-8');
      expect(codigo).not.toMatch(/put\(\s*['"]bitacora_sara\.json['"]/);
    });

    it('L. reporteDiario.mjs solo escribe el reporte vigente si NO es parcial (fix H-REPORTE-01)', () => {
      const codigo = fs.readFileSync(REPORTE_DIARIO_PATH, 'utf-8');
      expect(codigo).toMatch(/if\s*\(\s*!\s*esParcial\s*\)[\s\S]*?put\(\s*['"]reporte_diocesano_vigente\.json['"]/);
    });

    it('M. ejecutar_sara_autonomo.mjs pasa bitacoraBase a generarReporteDiario (fix H-BITACORA-01)', () => {
      const codigo = fs.readFileSync(RUNNER_PATH, 'utf-8');
      expect(codigo).toMatch(/generarReporteDiario\(\s*\{[\s\S]*?bitacoraBase\s*:/);
    });
  });
});