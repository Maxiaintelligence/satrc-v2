import React, { useState, useEffect } from 'react';
import { NOAA_PRODUCTS } from '../config/noaa-goes.js';
import { 
  Eye, 
  RefreshCw, 
  Clock, 
  ExternalLink, 
  Maximize2, 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Zap,
  Flame,
  CloudSun,
  Wind,
  Layers,
  AlertCircle
} from 'lucide-react';

export default function SatelliteViewer() {
  const listaProductos = [
    { ...NOAA_PRODUCTS.geocolor, icono: CloudSun },
    { ...NOAA_PRODUCTS.glmFed, icono: Zap },
    { ...NOAA_PRODUCTS.fireTemperature, icono: Flame },
    { ...NOAA_PRODUCTS.sandwich, icono: Layers },
    { ...NOAA_PRODUCTS.airMass, icono: Wind }
  ];

  const [productoActivo, setProductoActivo] = useState(listaProductos[0]);
  const [urlAnimacion, setUrlAnimacion] = useState('');
  const [versionCache, setVersionCache] = useState(Date.now());
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);

  const [horaSatelital, setHoraSatelital] = useState('--:--');
  const [minutosAtras, setMinutosAtras] = useState(0);

  // Estados de Zoom Pantalla Completa
  const [modalZoomAbierto, setModalZoomAbierto] = useState(false);
  const [zoomNivel, setZoomNivel] = useState(1.6);

  // Decodificador de la marca de tiempo de NOAA: AAAADDDHHMM en UTC a Hora Local de México
  function parseNoaaStamp(s) {
    if (!s || s.length < 11) return new Date();
    const anio = parseInt(s.slice(0, 4), 10);
    const diaJuliano = parseInt(s.slice(4, 7), 10);
    const horas = parseInt(s.slice(7, 9), 10);
    const minutos = parseInt(s.slice(9, 11), 10);

    // Enero 1 del año en UTC + días julianos
    const fecha = new Date(Date.UTC(anio, 0, 1, horas, minutos));
    fecha.setUTCDate(fecha.getUTCDate() + (diaJuliano - 1));
    return fecha;
  }

  // Consulta dinámica del GIF más reciente
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setErrorCarga(false);

    fetch(`/api/latest-gif?p=${productoActivo.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(({ url, fin }) => {
        if (cancelado) return;
        const fechaRealToma = parseNoaaStamp(fin);
        setUrlAnimacion(url);
        
        setHoraSatelital(
          fechaRealToma.toLocaleTimeString('es-MX', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
          })
        );
        setMinutosAtras(Math.max(0, Math.round((Date.now() - fechaRealToma.getTime()) / 60000)));
      })
      .catch((err) => {
        console.error("Error al obtener último GIF de NOAA:", err);
        if (!cancelado) {
          setCargando(false);
          setErrorCarga(true);
        }
      });

    return () => { cancelado = true; };
  }, [productoActivo.id, versionCache]);

  // Auto-refresco de la pasada cada 10 minutos
  useEffect(() => {
    const timer = setInterval(() => setVersionCache(Date.now()), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const refrescarManualmente = () => {
    setCargando(true);
    setErrorCarga(false);
    setVersionCache(Date.now());
  };

  const IconoProducto = productoActivo.icono;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      
      {/* 1. CABECERA: Título y Controles */}
      <div className="p-3.5 bg-slate-800/90 border-b border-slate-700 flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="font-bold text-xs md:text-sm text-white tracking-wide">
            Satélite GOES-19 • Sector México
          </h3>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
            EN VIVO • NOAA
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalZoomAbierto(true)}
            className="flex items-center gap-1 text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg transition-all shadow"
            title="Ampliar a pantalla completa"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ampliar</span>
          </button>

          <button
            onClick={refrescarManualmente}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors border border-slate-600"
            title="Refrescar última pasada satelital"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. SELECTOR DE LOS 5 CANALES OFICIALES (Sin Texto Encima) */}
      <div className="p-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center gap-1.5">
        {listaProductos.map((p) => {
          const Icon = p.icono;
          const activo = productoActivo.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                if (productoActivo.id !== p.id) {
                  setProductoActivo(p);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activo
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-[1.02]'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{p.shortName}</span>
            </button>
          );
        })}
      </div>

      {/* 3. LIENZO SATELITAL ANIMADO: 100% LIMPIO • CERO OBSTRUCCIÓN */}
      <div 
        onClick={() => setModalZoomAbierto(true)}
        className="relative bg-black flex items-center justify-center overflow-hidden cursor-zoom-in aspect-square sm:aspect-video w-full"
      >
        {cargando && !errorCarga && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 gap-2">
            <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[11px] text-slate-400 font-mono">Sincronizando última corrida de NOAA...</p>
          </div>
        )}

        {errorCarga ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-xs font-bold text-white">Actualizando catálogo dinámico de NOAA</p>
            <button
              onClick={refrescarManualmente}
              className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold shadow"
            >
              Reintentar Conexión
            </button>
          </div>
        ) : (
          urlAnimacion && (
            <img
              key={urlAnimacion}
              src={urlAnimacion}
              alt={productoActivo.name}
              onLoad={() => setCargando(false)}
              onError={() => {
                setCargando(false);
                setErrorCarga(true);
              }}
              className={`w-full h-full object-contain transition-opacity duration-200 ${
                cargando ? 'opacity-0' : 'opacity-100'
              }`}
            />
          )
        )}
      </div>

      {/* 4. METADATOS Y DIAGNÓSTICO EXTERIOR (Fuera de la Imagen) */}
      <div className="p-3.5 bg-slate-950/95 border-t border-slate-800 space-y-2 text-xs">
        
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <IconoProducto className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white text-xs md:text-sm">{productoActivo.name}</p>
              <p className="text-[10px] text-slate-400">Instrumento {productoActivo.type} • NOAA STAR GOES-19</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Última pasada real: <strong className="text-white">{horaSatelital}</strong> (hace {minutosAtras} min)</span>
          </div>
        </div>

        <p className="text-slate-300 text-[11px] leading-relaxed pl-8">
          {productoActivo.description}
        </p>

        <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-[10px] text-slate-500 pl-8">
          <span>Toca la animación para ampliar en pantalla completa.</span>
          <a
            href={productoActivo.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
          >
            Portal Oficial NOAA <ExternalLink className="w-3 h-3" />
          </a>
        </div>

      </div>

      {/* 5. MODAL DE ZOOM A PANTALLA COMPLETA DIRECTO EN LA ANIMACIÓN */}
      {modalZoomAbierto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/98 backdrop-blur-md animate-fade-in text-white">
          
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-xs md:text-sm text-white">{productoActivo.name}</h4>
              <p className="text-[10px] text-slate-400">Bucle inmutable de las {horaSatelital} (Sector México)</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                <button
                  onClick={() => setZoomNivel(prev => Math.max(1.0, prev - 0.3))}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-2 py-1 text-xs font-mono font-bold text-amber-400 flex items-center">
                  {Math.round(zoomNivel * 100)}%
                </span>
                <button
                  onClick={() => setZoomNivel(prev => Math.min(3.5, prev + 0.3))}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomNivel(1.6)}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 border-l border-slate-700"
                  title="Restablecer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setModalZoomAbierto(false)}
                className="p-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl transition-all"
                title="Cerrar visor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-auto bg-black flex items-center justify-center p-2">
            <div 
              className="relative transition-transform duration-200 origin-center"
              style={{ transform: `scale(${zoomNivel})` }}
            >
              {urlAnimacion && (
                <img
                  src={urlAnimacion}
                  alt={productoActivo.name}
                  className="max-w-none w-[700px] md:w-[950px] h-auto rounded shadow-2xl select-none"
                  draggable={false}
                />
              )}
            </div>
          </div>

          <div className="p-2.5 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 text-center">
            Inspección animada GOES-19 en alta definición.
          </div>

        </div>
      )}

    </div>
  );
}