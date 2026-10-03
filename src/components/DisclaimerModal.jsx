import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, ExternalLink } from 'lucide-react';

/**
 * SatRC V2.0 - Disclaimer Profesional y Deslinde Institucional Obligatorio
 * Cáritas Pastoral Social - Arquidiócesis de Tulancingo
 */
export default function DisclaimerModal({ abierto, alCerrar }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Si se pasa la propiedad abierto o no ha sido aceptado previamente
    if (abierto !== undefined) {
      setVisible(abierto);
    } else {
      const aceptado = localStorage.getItem('satrc_disclaimer_aceptado');
      if (!aceptado) {
        setVisible(true);
      }
    }
  }, [abierto]);

  const aceptarTerminos = () => {
    localStorage.setItem('satrc_disclaimer_aceptado', 'true');
    setVisible(false);
    if (alCerrar) alCerrar();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        
        {/* Cabecera Institucional */}
        <div className="bg-slate-800 p-5 border-b border-slate-700 flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Aviso Institucional y Deslinde de Responsabilidad
            </h2>
            <p className="text-xs text-slate-400">
              Cáritas Pastoral Social • Arquidiócesis de Tulancingo
            </p>
          </div>
        </div>

        {/* Cuerpo del Mensaje */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-xs md:text-sm leading-relaxed text-slate-300">
          <p>
            Bienvenido al <strong>Sistema de Alerta Temprana y Riesgos Climáticos (SatRC V2.0)</strong>, 
            una herramienta de servicio comunitario y pastoral diseñada para salvaguardar vidas y medios de subsistencia.
          </p>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-semibold text-amber-400 text-xs uppercase tracking-wider">
              1. Naturaleza de los Datos (Sin Pronóstico Propio)
            </h4>
            <p className="text-xs text-slate-400">
              SatRC V2.0 <strong>no emite pronósticos meteorológicos propios</strong>. 
              La plataforma procesa y sintetiza datos numéricos abiertos de centros mundiales reconocidos 
              (ECMWF IFS de Europa, GFS de la NOAA, ICON del Servicio Alemán DWD) y del Servicio Meteorológico Nacional (SMN / CONAGUA) de México.
            </p>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="font-semibold text-amber-400 text-xs uppercase tracking-wider">
              2. Primacía de las Autoridades Oficiales
            </h4>
            <p className="text-xs text-slate-400">
              Ante cualquier situación de emergencia o riesgo inminente, las instrucciones, órdenes de evacuación y comunicados 
              de la <strong>Coordinación Nacional de Protección Civil (CNPC)</strong>, las Unidades Estatales y Municipales de Protección Civil, 
              así como los avisos de la <strong>CONAGUA</strong>, tienen carácter prioritario y obligatorio.
            </p>
          </div>

          <p className="text-xs text-slate-400 italic">
            El uso de esta plataforma implica el entendimiento de que la información se proporciona como guía orientativa de apoyo humanitario y prevención comunitaria.
          </p>
        </div>

        {/* Pie de Acción */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex flex-col sm:flex-row justify-end gap-3 items-center">
          <a
            href="https://smn.conagua.gob.mx/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            Portal Oficial SMN / CONAGUA <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={aceptarTerminos}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-lg shadow-amber-500/20"
          >
            <CheckCircle className="w-4 h-4" />
            Entendido y Aceptar
          </button>
        </div>

      </div>
    </div>
  );
}