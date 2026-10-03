import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  RefreshCw, 
  Info, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  X, 
  RotateCcw,
  Camera,
  Film,
  Clock
} from 'lucide-react';

export default function SatelliteViewer() {
  const canales = [
    {
      id: 'GEOCOLOR',
      nombre: 'GeoColor (Visible / Color Real)',
      descripcion: 'Evolución de la nubosidad real, bruma y sombras orográficas.',
      urlFija: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/GEOCOLOR/1000x1000.jpg',
      urlAnimada: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/GIFS/GOES16-MEX-GEOCOLOR-1000x1000.gif',
      urlOficialNOAA: 'https://www.star.nesdis.noaa.gov/goes/sector.php?sat=G16&sector=mex'
    },
    {
      id: 'Band13',
      nombre: 'Infrarrojo Térmico (Banda 13 - Topes Fríos)',
      descripcion: 'Animación de celdas severas. Rojo/Morado = tormentas convectivas en expansión.',
      urlFija: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/13/1000x1000.jpg',
      urlAnimada: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/GIFS/GOES16-MEX-13-1000x1000.gif',
      urlOficialNOAA: 'https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G16&sector=mex&band=13&length=12'
    },
    {
      id: 'Band09',
      nombre: 'Vapor de Agua (Niveles Medios)',
      descripcion: 'Dinámica de vientos y ríos atmosféricos en niveles medios sobre México.',
      urlFija: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/09/1000x1000.jpg',
      urlAnimada: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/GIFS/GOES16-MEX-09-1000x1000.gif',
      urlOficialNOAA: 'https://www.star.nesdis.noaa.gov/goes/sector_band.php?sat=G16&sector=mex&band=09&length=12'
    }
  ];

  const [canalSeleccionado, setCanalSeleccionado] = useState(canales[0]);
  const [modoAnimado, setModoAnimado] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [cargando, setCargando] = useState(true);
  const [horaSatelital, setHoraSatelital] = useState('');
  const [minutosAtras, setMinutosAtras] = useState(0);

  // Estados del Modo Pantalla Completa
  const [modalAbierto, setModalAbierto] = useState(false);
  const [zoomNivel, setZoomNivel] = useState(1.8);

  useEffect(() => {
    function calcularPasadaSatelite() {
      const ahora = new Date();
      const fechaToma = new Date(ahora.getTime() - 10 * 60000);
      const minutos = fechaToma.getMinutes();
      const residuo = minutos % 10;
      fechaToma.setMinutes(minutos - residuo + 1);
      fechaToma.setSeconds(0);

      const horaFormato = fechaToma.toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

      const difMin = Math.max(2, Math.round((ahora - fechaToma) / 60000));
      setHoraSatelital(horaFormato);
      setMinutosAtras(difMin);
    }

    calcularPasadaSatelite();
    const intervalo = setInterval(calcularPasadaSatelite, 60000);
    return () => clearInterval(intervalo);
  }, [timestamp]);

  const refrescarImagen = () => {
    setCargando(true);
    setTimestamp(Date.now());
  };

  const abrirModalZoom = () => {
    setZoomNivel(1.8);
    setModalAbierto(true);
  };

  const urlVisible = modoAnimado 
    ? `${canalSeleccionado.urlAnimada}?t=${timestamp}`
    : `${canalSeleccionado.urlFija}?t=${timestamp}`;

  return (
    <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
      
      {/* Cabecera del Visor */}
      <div className="p-4 bg-slate-800/90 flex flex-wrap justify-between items-center gap-3 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-950 rounded-xl border border-slate-700 text-amber-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm md:text-base tracking-wide text-white">
                Satélite GOES-East (GOES-16) • Sector México y Golfo
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                EN VIVO • NOAA
              </span>
            </div>
            
            <p className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Última toma satelital: <strong className="text-white">{horaSatelital}</strong> (hace {minutosAtras} min)</span>
            </p>
          </div>
        </div>

        {/* Conmutadores de Control */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Fija vs Animación */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => {
                setModoAnimado(false);
                setCargando(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !modoAnimado 
                  ? 'bg-slate-800 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-slate-400" />
              Toma Fija
            </button>

            <button
              onClick={() => {
                setModoAnimado(true);
                setCargando(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modoAnimado 
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-amber-300" />
              Animación (Loop)
            </button>
          </div>

          {/* Botón Ampliar */}
          <button
            onClick={abrirModalZoom}
            className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-xl transition-all shadow"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Ampliar Pantalla Completa
          </button>

          <button
            onClick={refrescarImagen}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
            title="Refrescar toma satelital"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin text-amber-400' : ''}`} />
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

      {/* Contenedor Principal */}
      <div 
        onClick={abrirModalZoom}
        className="relative aspect-video md:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden cursor-zoom-in group"
      >
        {cargando && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-mono">
              {modoAnimado ? 'Descargando bucle animado oficial NOAA...' : 'Sincronizando satélite NOAA...'}
            </p>
          </div>
        )}

        <img
          key={urlVisible}
          src={urlVisible}
          alt={`Satélite GOES-16 ${canalSeleccionado.nombre}`}
          onLoad={() => setCargando(false)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cargando ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {modoAnimado && (
          <div className="absolute top-3 left-3 bg-rose-600/90 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1.5 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            REPRODUCIENDO ÚLTIMAS HORAS (NOAA LOOP)
          </div>
        )}

        <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-amber-300 flex items-center gap-1.5 shadow-lg">
          <ZoomIn className="w-4 h-4" />
          <span>Clic para ampliar a pantalla completa</span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-slate-700/80 flex items-start gap-2.5 text-xs text-slate-300">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white">
              {canalSeleccionado.nombre} {modoAnimado && '• Bucle en Movimiento'}
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed">{canalSeleccionado.descripcion}</p>
          </div>
        </div>
      </div>

      {/* MODAL DE PANTALLA COMPLETA */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in text-white">
          
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="font-black text-sm md:text-base text-white">
                Visor Satelital NOAA GOES-16 • Sector México y Golfo
              </h3>
              <p className="text-[11px] text-slate-400">
                Toma satelital de las {horaSatelital} • {canalSeleccionado.nombre}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button
                  onClick={() => setZoomNivel(prev => Math.max(1.0, prev - 0.3))}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-xs font-mono font-bold text-amber-400 flex items-center">
                  {Math.round(zoomNivel * 100)}%
                </span>
                <button
                  onClick={() => setZoomNivel(prev => Math.min(4.0, prev + 0.3))}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomNivel(1.8)}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white border-l border-slate-700"
                  title="Restablecer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setModalAbierto(false)}
                className="p-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl transition-all"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-auto bg-black flex items-center justify-center p-4">
            <div 
              className="relative transition-transform duration-200"
              style={{
                transform: `scale(${zoomNivel})`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={`${canalSeleccionado.urlFija}?t=${timestamp}`}
                alt="Satélite GOES-16 Pantalla Completa"
                className="max-w-none w-[800px] md:w-[950px] h-auto select-none pointer-events-auto rounded shadow-2xl"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
                draggable={false}
              />
            </div>
          </div>

          <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400 flex justify-between items-center px-6">
            <span>Usa (+) y (-) para ajustar el tamaño. La imagen muestra la cobertura de nubes real sobre el país.</span>
            <a 
              href={canalSeleccionado.urlOficialNOAA} 
              target="_blank" 
              rel="noreferrer" 
              className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
            >
              Portal Oficial NOAA STAR <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>
      )}

    </div>
  );
}