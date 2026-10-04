import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluarLocalidad } from './src/engine/riskEvaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/localidades.json'), 'utf-8'));

console.log('========================================================================');
console.log('   EVALUACIÓN DEL MOTOR SISTÉMICO MULTI-FACTORIAL (CASOS REALES)        ');
console.log('========================================================================\n');

// Simulación de temporal monzónico de varios días (suelo con 55 mm previos + 40 mm en curso)
const serieSemanal = [];
// 7 días previos de lluvia continua acumulando humedad en el subsuelo
for (let i = 0; i < 168; i++) {
  serieSemanal.push({ lluvia_mm: (i % 8 === 0) ? 2.5 : 0.2, temperatura_c: 18 });
}
// Próximas 24 horas con lluvia activa
for (let i = 0; i < 24; i++) {
  serieSemanal.push({ 
    fecha_hora: `2026-10-03T${String(i).padStart(2, '0')}:00`, 
    lluvia_mm: (i >= 12 && i <= 16) ? 6.0 : 1.5, 
    temperatura_c: 17 
  });
}

const contextoAlertaSMN = {
  alertaSMN: {
    titulo: "Frente núm. 1 y circulación ciclónica",
    rango_lluvia_min_mm: 75,
    estados_afectados: ["PUE", "HGO"]
  },
  lluvia_cabecera_mm: 80
};

// 1. Probar Huehuetla (Riesgo Fluvial de Cañada)
const huehuetla = db.localidades.find(l => l.nombre.toLowerCase().includes('huehuetla')) || db.localidades[0];
const resHuehuetla = evaluarLocalidad(huehuetla, serieSemanal, contextoAlertaSMN);

console.log(`📍 CASO 1: ${resHuehuetla.nombre} (${resHuehuetla.municipio})`);
console.log(`   🚨 Nivel Asignado: [NIVEL ${resHuehuetla.nivel_alerta} • ${resHuehuetla.estado_alerta}]`);
console.log(`   📋 Diagnóstico:   ${resHuehuetla.diagnostico.titulo}`);
console.log(`   🌊 Causa:         ${resHuehuetla.diagnostico.causa}`);
console.log(`   💧 Saturación:    ${resHuehuetla.impactoSistemico.saturacionTotalSueloMm} mm acumulados (Memoria 7 días + Hoy)`);
console.log(`   🏥 Dist. Río / Hospital: ${resHuehuetla.geografia.distanciaRioKm} km del río / ${resHuehuetla.impactoSistemico.distanciaHospitalKm} km hospital`);
console.log(`   ⛪ Protocolo:     "${resHuehuetla.protocolo}"`);
console.log('------------------------------------------------------------------------\n');

// 2. Probar Zihuateutla (Ladera de Terracería en Puebla)
const zihuateutla = db.localidades.find(l => l.municipio.toLowerCase().includes('zihuateutla')) || db.localidades[1];
const resZihuateutla = evaluarLocalidad(zihuateutla, serieSemanal, contextoAlertaSMN);

console.log(`📍 CASO 2: ${resZihuateutla.nombre} (${resZihuateutla.municipio})`);
console.log(`   🚨 Nivel Asignado: [NIVEL ${resZihuateutla.nivel_alerta} • ${resZihuateutla.estado_alerta}]`);
console.log(`   📋 Diagnóstico:   ${resZihuateutla.diagnostico.titulo}`);
console.log(`   ⛰️ Relieve:       ${resZihuateutla.geografia.relieve} (${resZihuateutla.geografia.pendienteMax}° de pendiente)`);
console.log(`   🛣️ Acceso Vial:   ${resZihuateutla.impactoSistemico.accesoVial}`);
console.log(`   ⛪ Protocolo:     "${resZihuateutla.protocolo}"`);
console.log('========================================================================');