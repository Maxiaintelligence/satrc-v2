console.log('========================================================================');
console.log('🌐 AUDITORÍA DEL ARCHIVO MAESTRO EN PRODUCCIÓN (VERCEL / BLOB)');
console.log('========================================================================\n');

// Consultamos directamente el endpoint de la API de producción
const URL_PRODUCCION = "https://satrc-v2.vercel.app/api/sara"; // Cambiar por tu URL de Vercel si es distinta

async function auditarProduccion() {
  try {
    console.log(`📡 Conectando a ${URL_PRODUCCION}...`);
    const res = await fetch(`${URL_PRODUCCION}?t=${Date.now()}`);
    
    if (!res.ok) {
      console.error(`❌ Error HTTP ${res.status}: La API en producción no responde.`);
      return;
    }

    const data = await res.json();
    console.log(`✅ Respuesta recibida exitosamente.`);
    console.log(`📦 Origen de los datos: [${data.origen}]`);
    console.log(`🕒 Hora reportada por el servidor: [${data.hora_servidor_mexico}]`);
    console.log(`🤖 Dictamen de SARA: ${data.dictamen?.titulo} (${data.dictamen?.estado_situacion})`);
    
    if (!data.evaluaciones || data.evaluaciones.length === 0) {
      console.error(`❌ FALLA GRAVE: data.evaluaciones está VACÍO (0 localidades). El mapa no tiene qué pintar.`);
      return;
    }

    console.log(`📍 Total de localidades recibidas por el cliente: ${data.evaluaciones.length} / 405\n`);

    // Conteo real de niveles en producción
    const n4 = data.evaluaciones.filter(e => e.nivel_alerta === 4);
    const n3 = data.evaluaciones.filter(e => e.nivel_alerta === 3);
    const n2 = data.evaluaciones.filter(e => e.nivel_alerta === 2);
    const n1 = data.evaluaciones.filter(e => e.nivel_alerta === 1);

    console.log('📊 DISTRIBUCIÓN REAL DE NIVELES EN PRODUCCIÓN:');
    console.log(`   🔴 Nivel 4 (Emergencia):     ${n4.length}`);
    console.log(`   🟠 Nivel 3 (Alerta Temprana): ${n3.length}`);
    console.log(`   🟡 Nivel 2 (Vigilancia):      ${n2.length}`);
    console.log(`   🟢 Nivel 1 (Estables):        ${n1.length}\n`);

    // Muestra de las primeras 3 en Nivel 4
    console.log('🔍 Muestra de comunidades en Nivel 4 en producción:');
    n4.slice(0, 5).forEach(c => {
      console.log(`   • ${c.nombre} (${c.municipio}, ${c.estado}) | Relieve: ${c.geografia?.relieve} (${c.geografia?.pendienteMax}°) | Lluvia: ${c.impactoSistemico?.saturacionTotalSueloMm} mm`);
    });

  } catch (err) {
    console.error("❌ Fallo de conexión:", err.message);
  }
}

auditarProduccion();
