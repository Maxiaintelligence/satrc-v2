const fs = require('fs');
const path = require('path');

const rutaCSV = path.join(__dirname, 'localidades_crudo.csv');
const rutaSalida = path.join(__dirname, 'src', 'data', 'localidades.json');

console.log('🔄 Procesando base de datos diocesana depurada...');

if (!fs.existsSync(rutaCSV)) {
  console.error('❌ Error: No se encontró "localidades_crudo.csv" en la raíz.');
  process.exit(1);
}

const contenido = fs.readFileSync(rutaCSV, 'utf-8');
const lineas = contenido.split(/\r?\n/).filter(linea => linea.trim() !== '');

if (lineas.length < 2) {
  console.error('❌ Error: El archivo CSV está vacío.');
  process.exit(1);
}

const encabezados = lineas[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
const localidades = [];
const subcuencasMap = {};
const zonasMap = {};
const laderasCriticas = [];
const municipiosUnicos = new Set();

function sanitizar(texto) {
  return (texto || '')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');
}

for (let i = 1; i < lineas.length; i++) {
  const valores = lineas[i].split(',');
  if (valores.length < encabezados.length) continue;

  const fila = {};
  encabezados.forEach((enc, index) => {
    fila[enc] = valores[index] ? valores[index].trim() : '';
  });

  const pendienteMax = parseFloat(fila.pendiente_maxima_grados) || 0;
  const relieve = fila.tipo_relieve || 'MESETA';
  const subcuencaCve = fila.CVE_SUBCUE || 'SIN_CUENCA';
  const zonaId = fila.ZONA_ID || 'GEN';
  const municipio = fila.NOM_MUN || 'Sin Municipio';
  const nombreLoc = fila.NOM_LOC || `Comunidad_${i}`;

  municipiosUnicos.add(municipio);

  // ID único irrepetible
  const idUnico = `${sanitizar(zonaId)}_${sanitizar(municipio)}_${sanitizar(nombreLoc)}_${i}`;

  const objLocalidad = {
    id: idUnico,
    nombre: nombreLoc,
    municipio: municipio,
    estado: fila.NOM_ENT,
    zona_id: zonaId,
    zona_nombre: fila.ZONA_RESGUARDO,
    coords: {
      lat: parseFloat(fila.lat_dd) || 0,
      lon: parseFloat(fila.lon_dd) || 0
    },
    topografia: {
      altitud_msnm: parseInt(fila.altitud_msnm) || 0,
      pendiente_prom_deg: parseFloat(fila.pendiente_promedio_grados) || 0,
      pendiente_max_deg: pendienteMax,
      relieve: relieve,
      twi: parseFloat(fila.indice_humedad_topografica) || 0
    },
    hidrologia: {
      subcuenca_cve: subcuencaCve,
      subcuenca_nom: fila.SUBCUENCA || '',
      posicion: fila.posicion_hidrologica || 'BAJA',
      distancia_cauce_km: parseFloat(fila.distancia_al_cauce_principal_km) || 0,
      tc_horas: parseFloat(fila.tiempo_concentracion_horas) || 6.0,
      poblacion_aguas_arriba: parseInt(fila.poblacion_total_aguas_arriba) || 0
    },
    vulnerabilidad: {
      poblacion: parseInt(fila.pobtot) || 0,
      marginacion: fila.grado_marginacion || 'MEDIO',
      acceso_vial: fila.tipo_acceso_vial || 'CARRETERA_ESTATAL',
      dist_hospital_km: parseFloat(fila.distancia_hospital_km) || 0,
      dist_carretera_km: parseFloat(fila.distancia_carretera_km) || 0,
      combustibilidad: parseInt(fila.indice_combustibilidad) || 1,
      heladas_historicas: parseFloat(fila.heladas_historicas_promedio) || 0,
      uso_suelo: fila.uso_suelo_dominante || 'AGRICULTURA_TEMPORAL',
      clima_koppen: fila.tipo_clima_koppen || 'Cwb'
    }
  };

  localidades.push(objLocalidad);

  // 1. Árbol Jerárquico: Zona -> Municipios -> Localidades
  if (!zonasMap[zonaId]) {
    zonasMap[zonaId] = {
      id: zonaId,
      nombre: fila.ZONA_RESGUARDO,
      municipios: {},
      localidades_ids: []
    };
  }
  zonasMap[zonaId].localidades_ids.push(idUnico);

  if (!zonasMap[zonaId].municipios[municipio]) {
    zonasMap[zonaId].municipios[municipio] = [];
  }
  zonasMap[zonaId].municipios[municipio].push(idUnico);

  // 2. Indexar Subcuenca
  if (!subcuencasMap[subcuencaCve]) {
    subcuencasMap[subcuencaCve] = {
      cve: subcuencaCve,
      nombre: fila.SUBCUENCA || '',
      cabecera: [],
      media: [],
      baja: []
    };
  }
  const pos = (fila.posicion_hidrologica || 'BAJA').toLowerCase();
  if (pos === 'cabecera') subcuencasMap[subcuencaCve].cabecera.push(idUnico);
  else if (pos === 'media') subcuencasMap[subcuencaCve].media.push(idUnico);
  else subcuencasMap[subcuencaCve].baja.push(idUnico);

  // 3. Laderas críticas para deslaves
  if (pendienteMax >= 20.0 || relieve === 'LADERA') {
    laderasCriticas.push(idUnico);
  }
}

const estructuraFinal = {
  version: "3.0",
  actualizado: new Date().toISOString(),
  total_localidades: localidades.length,
  total_municipios: municipiosUnicos.size,
  indices: {
    zonas: zonasMap,
    subcuencas: subcuencasMap,
    laderas_criticas: laderasCriticas
  },
  localidades: localidades
};

fs.writeFileSync(rutaSalida, JSON.stringify(estructuraFinal, null, 2), 'utf-8');

console.log('--------------------------------------------------');
console.log(`✅ ¡Base de datos diocesana generada con éxito!`);
console.log(`📍 Localidades registradas: ${localidades.length}`);
console.log(`🏛️ Municipios únicos: ${municipiosUnicos.size}`);
console.log(`🗺️ Zonas de resguardo activas: ${Object.keys(zonasMap).length}`);
console.log(`🌊 Subcuencas hidrológicas: ${Object.keys(subcuencasMap).length}`);
console.log(`⚠️ Comunidades en ladera crítica: ${laderasCriticas.length}`);
console.log(`📁 Guardado en: src/data/localidades.json`);
console.log('--------------------------------------------------');