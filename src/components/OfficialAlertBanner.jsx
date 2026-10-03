import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  AlertTriangle, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  CloudLightning,
  Wind
} from 'lucide-react';

export default function OfficialAlertBanner() {
  const [datosSMN, setDatosSMN] = useState(null);
  const [desplegado, setDesplegado] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/smn')
      .then(res => res.json())
      .then(data => {
        if (data.exito && data.alerta) {
          setDatosSMN(data.alerta);
        }
        setCargando(false);
      })
      .catch(err => {
        console.error("Fallo al cargar SMN:", err);
        setCargando(false);
      });
  }, []);

  if (cargando || !datosSMN) return null;

  return (
    <div className="bg-orange-950/80 border-b-2 border-orange-500 text-orange-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        
        <div className="flex flex-wrap justify-between items-center gap-2">
          
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-orange-500/20 border border-orange-400 text-orange-300 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                  CONAGUA • SMN
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500 text-slate-950 border border-orange-400">
                  Nivel {datosSMN.nivel} • {datosSMN.severidad}
                </span>

                <span className="text-[10px] text-amber-300 font-bold bg-amber-900/60 px-2 py-0.5 rounded border border-amber-500/40">
                  Aviso Vigente: Lluvias Intensas ({datosSMN.rango_lluvia_min_mm} a {datosSMN.rango_lluvia_max_mm} mm) en Puebla e Hidalgo
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setDesplegado(!desplegado)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-200 hover:text-white transition-colors"
            >
              <span>{desplegado ? 'Ocultar Detalle' : 'Ver Aviso Oficial'}</span>
              {desplegado ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <a
              href={datosSMN.enlace_oficial}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
            >
              Portal SMN <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

        {/* Resumen Oficial sin caracteres corruptos */}
        {desplegado && (
          <div className="mt-2.5 pt-2.5 border-t border-orange-800/60 text-xs space-y-2 animate-fade-in">
            <p className="text-white font-semibold text-xs">
              {datosSMN.titulo}
            </p>
            <p className="text-orange-200 leading-relaxed font-normal">
              {datosSMN.descripcion}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-orange-300">
              <span className="font-semibold text-white">Estados en vigilancia federal:</span>
              <span className="bg-orange-900/40 px-2 py-0.5 rounded border border-orange-700/60 text-white font-mono">
                PUEBLA • HIDALGO • VERACRUZ • SAN LUIS POTOSÍ • TAMAULIPAS
              </span>
              <span className="ml-auto font-mono text-[10px] text-orange-400">
                Sincronización Oficial: {datosSMN.fecha_sincronizacion} hrs
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}