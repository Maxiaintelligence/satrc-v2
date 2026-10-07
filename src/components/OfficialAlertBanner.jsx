import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  AlertTriangle, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2
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
        console.error("Fallo al consultar SMN:", err);
        setCargando(false);
      });
  }, []);

  if (cargando || !datosSMN) return null;

  // Si no hay alerta activa (nivel 1), muestra cinta verde sobria de tranquilidad
  const esAlertaActiva = datosSMN.activo && datosSMN.nivel >= 2;

  return (
    <div className={`border-b transition-colors ${
      esAlertaActiva 
        ? (datosSMN.nivel >= 3 ? 'bg-orange-950/80 border-orange-500 text-orange-100 shadow-md' : 'bg-amber-950/80 border-amber-500 text-amber-100')
        : 'bg-slate-900 border-slate-800 text-slate-300'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-2">
        
        <div className="flex flex-wrap justify-between items-center gap-2">
          
          <div className="flex items-center gap-2.5">
            <div className={`p-1 rounded-lg border flex items-center justify-center ${
              esAlertaActiva 
                ? 'bg-orange-500/20 border-orange-400 text-orange-300 animate-pulse' 
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}>
              {esAlertaActiva ? <AlertTriangle className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                CONAGUA • SMN
              </span>

              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                esAlertaActiva 
                  ? 'bg-orange-500 text-slate-950 border-orange-400' 
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {esAlertaActiva ? `Nivel ${datosSMN.nivel} • ${datosSMN.severidad}` : 'Nivel 1 • Condiciones Normales'}
              </span>

              <span className="text-[11px] text-slate-200 font-medium">
                {datosSMN.titulo}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setDesplegado(!desplegado)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
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

        {/* Resumen Oficial Dinámico */}
        {desplegado && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-xs space-y-2 animate-fade-in">
            <p className="text-slate-200 leading-relaxed font-normal">
              {datosSMN.descripcion}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Monitoreo federal oficial:</span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-200 font-mono">
                {datosSMN.estados_afectados?.length > 0 ? datosSMN.estados_afectados.join(' • ') : 'Monitoreo Nacional Rutinario'}
              </span>
              <span className="ml-auto font-mono text-[10px] text-slate-500">
                Sincronización en vivo: {datosSMN.fecha_sincronizacion} hrs
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}