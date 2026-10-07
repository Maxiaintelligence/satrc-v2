import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluarLocalidad } from './src/engine/riskEvaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/localidades.json'), 'utf-8'));

console.log('========================================================================');
console.log('🔬 AUDITORÍA FORENSE DEL MOTOR: DIAGNÓSTICO DE NIVELES EN 3 TESTIGOS');
console.log('========================================================================\n');

// Seleccionar 3 testigos geográficos opuestos:
// 1. Altiplano Seco Plano: Apan o Tizayuca (Debe ser SIEMPRE Nivel 1 en día seco)
const testigoAltiplano = db.localidades.find(l => l.nombre.toLowerCase().includes('apan') || l.zona_id === 'APN');

// 2. Sierra de Ladera: Coahuitlán o Zihuateutla (Pendiente crítica)
const testigoSierraLadera = db.localidades.find(l => l.nombre.toLowerCase().includes('coahuitlán') || l.nombre.toLowerCase().includes('la unión'));

// 3. Ribera Encajonada: Huehuetla (Río Pantepec cercano)
const testigoRibera = db.localidades.find(l => l.nombre.toLowerCase().includes('huehuetla'));

const testigos = [
  { tipo: 'ALTIPLANO PLANO', loc: testigoAltiplano },
  { tipo: 'SIERRA LADERA', loc: testigoSierraLadera },
  { tipo: 'RIBERA ENCAJONADA', loc: testigoRibera }
];

// ESCENARIO A: Cero Lluvia (Día Seco Normal)
console.log('--- ESCENARIO A: PRUEBA CON CERO LLUVIA (0.0 mm) SIN AVISO SMN ---');
const serieSeca = Array(192).fill({ lluvia_mm: 0, temperatura_c: 20, wind_speed_10m: 10, rafagas_kmh: 15, visibility: 10000 });

testigos.forEach(({ tipo, loc }) => {
  if (!loc) return;
  const res = evaluarLocalidad(loc, serieSeca, { alertaSMN: null });
  console.log(`[${tipo}] ${loc.nombre} (${loc.municipio})`);
  console.log(`   👉 Nivel Resultante: NIVEL ${res.nivel_alerta} (${res.estado_alerta}) | Color: ${res.color_alerta}`);
  console.log(`   🔍 Diagnóstico: ${res.diagnostico?.titulo}`);
  console.log(`   🌧️ Saturación Calculada: ${res.impactoSistemico?.saturacionTotalSueloMm} mm`);
  console.log(`   ⚠️ ¿FALLA EL TEST?: ${tipo === 'ALTIPLANO PLANO' && res.nivel_alerta !== 1 ? '❌ SÍ, DIO ALERTA EN PLANICIE SECA' : '✅ CORRECTO'}\n`);
});

// ESCENARIO B: Con Aviso del SMN Activo (Frente Frío 1: 75-150 mm)
console.log('--- ESCENARIO B: PRUEBA CON AVISO FEDERAL SMN ACTIVO ---');
const contextoSMN = {
  alertaSMN: {
    titulo: "Frente Frío Núm. 1",
    rango_lluvia_min_mm: 75,
    rango_lluvia_max_mm: 150,
    estados_afectados: ["PUE", "HGO"]
  }
};

testigos.forEach(({ tipo, loc }) => {
  if (!loc) return;
  const res = evaluarLocalidad(loc, serieSeca, contextoSMN);
  console.log(`[${tipo}] ${loc.nombre} (${loc.municipio}) bajo Aviso SMN`);
  console.log(`   👉 Nivel Resultante: NIVEL ${res.nivel_alerta} (${res.estado_alerta})`);
  console.log(`   🌧️ Lluvia Efectiva Adoptada: ${res.impactoSistemico?.lluviaEvento24hMm} mm`);
  console.log(`   🔍 Causa: ${res.diagnostico?.causa?.slice(0, 90)}...`);
  console.log(`   ⚠️ ¿FALLA EL TEST?: ${tipo === 'ALTIPLANO PLANO' && res.nivel_alerta >= 3 ? '❌ SÍ, EL SMN ELEVÓ AL ALTIPLANO SIN LLUVIA' : '✅ COMPORTAMIENTO ADECUADO'}\n`);
});
