import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluarLocalidad } from './src/engine/riskEvaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Cargar la base de datos real procesada
const rutaDatos = path.join(__dirname, 'src', 'data', 'localidades.json');
const db = JSON.parse(fs.readFileSync(rutaDatos, 'utf-8'));

console.log('========================================================================');
console.log(`📡 Base de datos SatRC: ${db.total_localidades} localidades cargadas en memoria.`);
console.log('========================================================================\n');

// 2. CASO A: Coahuitlán (Riesgo Crítico de Deslave por Pendiente Extrema)
const coahuitlan = db.localidades.find(l => l.nombre.toLowerCase().includes('coahuitlán'));

// Simulamos una tormenta orográfica de 45 mm acumulados en 24h
const tormentaSimulada = [
  { fecha_hora: '2026-10-02T14:00', lluvia_mm: 5.0, temperatura_c: 18 },
  { fecha_hora: '2026-10-02T15:00', lluvia_mm: 15.0, temperatura_c: 17 }, // Pico
  { fecha_hora: '2026-10-02T16:00', lluvia_mm: 12.0, temperatura_c: 16 },
  { fecha_hora: '2026-10-02T17:00', lluvia_mm: 8.0, temperatura_c: 16 },
  { fecha_hora: '2026-10-02T18:00', lluvia_mm: 5.0, temperatura_c: 16 }
];

console.log('🔍 EVALUANDO CASO A: Deslave en Coahuitlán (Veracruz)...');
const dictamenCoahuitlan = evaluarLocalidad(coahuitlan, tormentaSimulada);

console.log(`\n🚨 ESTADO: [${dictamenCoahuitlan.estado_alerta}] (Nivel ${dictamenCoahuitlan.nivel_alerta})`);
console.log('------------------------------------------------------------------------');
console.log('1. ¿QUÉ VA A SUCEDER?:');
console.log(`   • Evento: ${dictamenCoahuitlan.que.evento}`);
console.log(`   • Causa:  ${dictamenCoahuitlan.que.descripcion}`);
console.log('2. ¿CUÁNDO VA A SUCEDER?:');
console.log(`   • Inicio de amenaza: ${dictamenCoahuitlan.cuando.inicio_amenaza}`);
console.log(`   • Pico de lluvia:    ${dictamenCoahuitlan.cuando.pico_maximo_lluvia}`);
console.log(`   • Ventana de acción: ${dictamenCoahuitlan.cuando.ventana_evacuacion_horas} horas`);
console.log('3. ¿DÓNDE VA A SUCEDER?:');
console.log(`   • Localidad: ${dictamenCoahuitlan.nombre}, ${dictamenCoahuitlan.municipio} (${dictamenCoahuitlan.estado})`);
console.log(`   • Cuenca:    ${dictamenCoahuitlan.donde.subcuenca_nom} (${dictamenCoahuitlan.donde.subcuenca_cve})`);
console.log(`   • Relieve:   ${dictamenCoahuitlan.donde.tipo_relieve} con pendiente de ${dictamenCoahuitlan.donde.pendiente_max_grados}°`);
console.log('4. ¿DE QUÉ TAMAÑO SERÁ EL IMPACTO?:');
console.log(`   • Población directa expuesta: ${dictamenCoahuitlan.tamano_impacto.poblacion_directa} habitantes`);
console.log(`   • Población aguas arriba:     ${dictamenCoahuitlan.tamano_impacto.poblacion_aguas_arriba} habitantes`);
console.log(`   • Vulnerabilidad vial:        ${dictamenCoahuitlan.tamano_impacto.riesgo_aislamiento_vial}`);
console.log(`   • Distancia al hospital:      ${dictamenCoahuitlan.tamano_impacto.distancia_hospital_km} km`);
console.log(`   • Umbral crítico local:       ${dictamenCoahuitlan.tamano_impacto.umbral_deslave_local_mm} mm (Lluvia prevista: ${dictamenCoahuitlan.tamano_impacto.lluvia_acumulada_24h_mm} mm)`);
console.log('========================================================================\n');

// 3. CASO B: Cascada Hidrológica en la Subcuenca Río Necaxa
console.log('🔍 EVALUANDO CASO B: Cascada Hidrológica en la misma subcuenca...');
const contextoCuenca = { lluvia_cabecera_mm: 85 }; // Llovió torrencial en la parte alta
const dictamenCascada = evaluarLocalidad(coahuitlan, [], contextoCuenca);

console.log(`🚨 ESTADO AGUAS ABAJO: [${dictamenCascada.estado_alerta}] (Nivel ${dictamenCascada.nivel_alerta})`);
console.log(`   • Evento: ${dictamenCascada.que.evento}`);
console.log(`   • Causa:  ${dictamenCascada.que.descripcion}`);
console.log(`   • Ventana de evacuación comunitaria: ${dictamenCascada.cuando.ventana_evacuacion_horas} horas antes de la crecida.`);
console.log('========================================================================');