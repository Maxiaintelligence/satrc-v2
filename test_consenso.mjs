import { consultarModelosDeterministas } from './src/engine/meteoFetcher.js';
import { generarConsensoDeterminista } from './src/engine/consensusEngine.js';

async function probarMotor() {
  console.log('📡 [SatRC Test] Conectando con ECMWF IFS, GFS e ICON para Tulancingo...');
  
  // Coordenadas de Tulancingo de Bravo
  const lat = 20.0806;
  const lon = -98.3681;

  const resultado = await consultarModelosDeterministas(lat, lon);

  if (!resultado.exito) {
    console.error('❌ Error en la conexión:', resultado.error);
    return;
  }

  console.log('✅ Datos crudos recibidos exitosamente de los 3 modelos.');
  console.log('⚙️ Ejecutando Algoritmo de Consenso y filtro de ceros espurios...\n');

  const consenso = generarConsensoDeterminista(resultado.datos_horarios);

  console.log('========================================================================');
  console.log('   REPORTE DE CONSENSO MULTI-MODELO (PRÓXIMAS 6 HORAS EN TULANCINGO)    ');
  console.log('========================================================================');

  // Mostramos las primeras 6 horas como muestra
  for (let i = 0; i < 6; i++) {
    const h = consenso[i];
    console.log(`🕒 Hora: ${h.fecha_hora}`);
    console.log(`   🌧️ Lluvia Consenso:  ${h.lluvia_mm} mm/h (ECMWF: ${h.detalle_modelos.lluvia.ecmwf} | GFS: ${h.detalle_modelos.lluvia.gfs} | ICON: ${h.detalle_modelos.lluvia.icon})`);
    console.log(`   🌡️ Temp Consenso:    ${h.temperatura_c} °C (ECMWF: ${h.detalle_modelos.temp.ecmwf} | GFS: ${h.detalle_modelos.temp.gfs} | ICON: ${h.detalle_modelos.temp.icon})`);
    console.log(`   💨 Viento / Ráfagas: ${h.viento_kmh} km/h (Ráfagas hasta ${h.rafagas_kmh} km/h)`);
    console.log(`   💧 Humedad Relativa: ${h.humedad_relativa_pct}%`);
    console.log(`   🎯 Confiabilidad:   [${h.confiabilidad}]`);
    console.log('------------------------------------------------------------------------');
  }

  console.log(`\n🎉 Motor determinista validado: ${consenso.length} horas calculadas con éxito.`);
}

probarMotor();