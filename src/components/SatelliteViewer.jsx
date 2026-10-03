import React, { useState } from 'react';
import { Eye, RefreshCw, Info, ExternalLink, AlertCircle } from 'lucide-react';

/**
 * SatRC V2.0 - Visor Satelital Oficial GOES-East (GOES-16)
 * Sector México y Golfo de México (NOAA / NESDIS / STAR)
 */
export default function SatelliteViewer() {
  const canales = [
    {
      id: 'GEOCOLOR',
      nombre: 'GeoColor (Visible / Color Real)',
      descripcion: 'Nubosidad real de día y luces urbanas de noche.',
      urlPrimaria: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/GEOCOLOR/1000x1000.jpg',
      urlRespaldo: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/GEOCOLOR/latest.jpg',
      urlOficialNOAA: 'https://www.star.nesdis.noaa.gov/goes/sector.php?sat=G16&sector=mex'
    },
    {
      id: 'Band13',
      nombre: 'Infrarrojo Térmico (Banda 13 - Topes Fríos)',
      descripcion: 'Detección de tormentas severas. Rojo/Morado = convección violenta con potencial de deslave.',
      urlPrimaria: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/13/1000x1000.jpg',
      urlRespaldo: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/13/latest.jpg',
      urlOficialNOAA: 'https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G16&sector=mex&band=13&length=12'
    },
    {
      id: 'Band09',
      nombre: 'Vapor de Agua (Niveles Medios)',
      descripcion: 'Flujo de humedad y corrientes en chorro sobre México.',
      urlPrimaria: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/09/1000x1000.jpg',
      urlRespaldo: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/09/latest.jpg',
      urlOficialNOAA: 'https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G16&sector=mex&band=09&length=12'
    }
  ];

  const [canalSeleccionado, setCanalSeleccionado] = useState(canales[0]);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [cargando, setCargando] = useState(true);
  const [usarRespaldo, setUsarRespaldo] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);

  const refrescarImagen = () => {
    setCargando(true);
    setErrorCarga(false);
    setUsarRespaldo(false);
    setTimestamp(Date.now());
  };

  const manejarErrorImagen = () => {
    if (!usarRespaldo) {
      // Intentar de inmediato con la URL de respaldo
      setUsarRespaldo(true);
    } else {
      // Si ambas fallan, mostrar aviso con enlace directo a NOAA
      setCargando(false);
      setErrorCarga(true);
    }
  };

  const urlActual = usarRespaldo 
    ? `${canalSeleccionado.urlRespaldo}?t=${timestamp}` 
    : `${canalSeleccionado.urlPrimaria}?t=${timestamp}`;

  return (
    <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
      
      {/* Cabecera del Visor */}
      <div className="p-4 bg-slate-800/90 flex flex-wrap justify-between items-center gap-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-sm md:text-base tracking-wide text-white">
            Satélite GOES-East (GOES-16) • Sector México
          </h3>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
            EN VIVO • NOAA
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={canalSeleccionado.urlOficialNOAA}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            Servidor NOAA <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={refrescarImagen}
            className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors border border-slate-600 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin text-amber-400' : ''}`} />
            {cargando ? 'Cargando...' : 'Refrescar'}
          </button>
        </div>
      </div>

      {/* Selector de Canales */}
      <div className="px-4 py-2.5 bg-slate-800/50 flex flex-wrap gap-2 border-b border-slate-700/60">
        {canales.map((canal) => (
          <button
            key={canal.id}
            onClick={() => {
              setCanalSeleccionado(canal);
              setUsarRespaldo(false);
              setErrorCarga(false);
              setCargando(true);
            }}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              canalSeleccionado.id === canal.id
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {canal.nombre}
          </button>
        ))}
      </div>

      {/* Contenedor de la Imagen Satelital */}
      <div className="relative aspect-video md:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
        
        {/* Spinner mientras descarga */}
        {cargando && !errorCarga && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-mono">Descargando última toma satelital de NOAA...</p>
          </div>
        )}

        {/* Mensaje en caso de bloqueo extremo de red */}
        {errorCarga ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-white">Conexión directa con el satélite demorada</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              El servidor de imágenes de NOAA está actualizando su última corrida. Puedes consultar la toma directa en el servidor oficial.
            </p>
            <a
              href={canalSeleccionado.urlOficialNOAA}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold"
            >
              Abrir satélite en portal NOAA <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <img
            key={urlActual}
            src={urlActual}
            alt={`Satélite GOES-16 ${canalSeleccionado.nombre}`}
            onLoad={() => setCargando(false)}
            onError={manejarErrorImagen}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              cargando ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}

        {/* Ficha explicativa flotante */}
        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-slate-700/80 flex items-start gap-2.5 text-xs text-slate-300">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white">{canalSeleccionado.nombre}</p>
            <p className="text-slate-300 text-[11px] leading-relaxed">{canalSeleccionado.descripcion}</p>
          </div>
        </div>
      </div>

    </div>
  );
}