import React, { useState } from 'react';
import { Eye, RefreshCw, Info } from 'lucide-react';

export default function SatelliteViewer() {
  const canales = [
    {
      id: 'GEOCOLOR',
      nombre: 'GeoColor (Visible / Color Real)',
      descripcion: 'Nubosidad real de día y luces urbanas de noche.',
      url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/GEOCOLOR/1200x1200.jpg'
    },
    {
      id: 'Band13',
      nombre: 'Infrarrojo Térmico (Banda 13 - Topes Fríos)',
      descripcion: 'Detecta tormentas severas. Rojo/Morado = convección violenta.',
      url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/13/1200x1200.jpg'
    },
    {
      id: 'Band09',
      nombre: 'Vapor de Agua (Niveles Medios)',
      descripcion: 'Flujo de humedad y corrientes en chorro sobre México.',
      url: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/mex/09/1200x1200.jpg'
    }
  ];

  const [canalSeleccionado, setCanalSeleccionado] = useState(canales[0]);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [cargando, setCargando] = useState(false);

  const refrescarImagen = () => {
    setCargando(true);
    setTimestamp(Date.now());
    setTimeout(() => setCargando(false), 800);
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-xl overflow-hidden border border-slate-700">
      <div className="p-4 bg-slate-800/90 flex flex-wrap justify-between items-center gap-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base md:text-lg tracking-wide">
            Satélite GOES-East (GOES-16) • Sector México
          </h3>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
            EN VIVO • NOAA
          </span>
        </div>

        <button
          onClick={refrescarImagen}
          disabled={cargando}
          className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors border border-slate-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin text-amber-400' : ''}`} />
          {cargando ? 'Actualizando...' : 'Refrescar'}
        </button>
      </div>

      <div className="px-4 py-2.5 bg-slate-800/50 flex flex-wrap gap-2 border-b border-slate-700/60">
        {canales.map((canal) => (
          <button
            key={canal.id}
            onClick={() => setCanalSeleccionado(canal)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              canalSeleccionado.id === canal.id
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {canal.nombre}
          </button>
        ))}
      </div>

      <div className="relative aspect-video md:aspect-[16/10] bg-black flex items-center justify-center overflow-hidden group">
        <img
          key={`${canalSeleccionado.id}-${timestamp}`}
          src={`${canalSeleccionado.url}?t=${timestamp}`}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          alt={`Satélite GOES-16 ${canalSeleccionado.nombre}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm p-2.5 rounded-lg border border-slate-700/80 flex items-start gap-2 text-xs text-slate-300">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">{canalSeleccionado.nombre}</p>
            <p>{canalSeleccionado.descripcion}</p>
          </div>
        </div>
      </div>
    </div>
  );
}