import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  CloudLightning,
  Wind,
  Snowflake
} from 'lucide-react';

export default function OfficialAlertBanner() {
  const [datosSMN, setDatosSMN] = useState(null);
  const [desplegado, setDesplegado] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/smn')
      .then(res => res.json())
      .then(data => {
        setDatosSMN(data);
        setCargando(false);
      })
      .catch(err => {
        console.error("No se pudo cargar aviso SMN:", err);
        setCargando(false);
      });
  }, []);

  if (cargando || !datosSMN) return null;

  const esAlertaActiva = datosSMN.nivel >= 2;

  return (
    <div className={`border-b transition-colors ${
      datosSMN.nivel === 4
        ? 'bg-rose-950/80 border-rose-500 text-rose-100'
        : datosSMN.nivel === 3
        ? 'bg-orange-950/80 border-orange-500 text-orange-100'
        : datosSMN.nivel === 2
        ? 'bg-amber-950/70 border-amber-500/80 text-amber-100'
        : 'bg-slate-900 border-slate-800 text-slate-300'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        
        {/* Barra Principal de Alerta */}
        <div className="flex flex-wrap justify-between items-center gap-2">
          
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border flex items-center justify-center ${
              esAlertaActiva 
                ? 'bg-rose-500/20 border-rose-400 text-rose-300 animate-pulse' 
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}>
              {esAlertaActiva ? <AlertTriangle className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                  CONAGUA • SMN
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  datosSMN.nivel >= 3 
                    ? 'bg-rose-500 text-white border-rose-400' 
                    : datosSMN.nivel === 2
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  Nivel {datosSMN.nivel} • {datosSMN.estado}
                </span>

                {/* Etiquetas de Entidades bajo aviso */}
                {(datosSMN.region_afectada.hidalgo || datosSMN.region_afectada.puebla) && (
                  <span className="text-[10px] text-amber-300 font-bold bg-amber-900/40 px-2 py-0.5 rounded border border-amber-500/30">
                    Aviso vigente para: {datosSMN.region_afectada.hidalgo && 'Hidalgo'} {datosSMN.region_afectada.puebla && '• Puebla'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controles de la barra */}
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setDesplegado(!desplegado)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
            >
              <span>{desplegado ? 'Ocultar Resumen' : 'Ver Boletín Oficial'}</span>
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

        {/* Panel Desplegable con el Resumen Oficial del Gobierno */}
        {desplegado && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-xs space-y-2 animate-fade-in">
            <p className="text-slate-200 leading-relaxed font-normal">
              {datosSMN.resumen}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Fenómenos bajo seguimiento federal:</span>
              {datosSMN.sistemas_activos.tormentas && (
                <span className="flex items-center gap-1 text-blue-300 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800">
                  <CloudLightning className="w-3 h-3" /> Tormentas y Chubascos
                </span>
              )}
              {datosSMN.sistemas_activos.frente_frio && (
                <span className="flex items-center gap-1 text-sky-300 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800">
                  <Snowflake className="w-3 h-3" /> Frente Frío / Descenso Térmico
                </span>
              )}
              {datosSMN.sistemas_activos.norte && (
                <span className="flex items-center gap-1 text-teal-300 bg-teal-950/50 px-2 py-0.5 rounded border border-teal-800">
                  <Wind className="w-3 h-3" /> Evento de Norte / Vientos
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] text-slate-500">
                Sincronizado: {datosSMN.fecha_consulta} hrs
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}