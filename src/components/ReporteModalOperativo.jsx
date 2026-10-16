import React from 'react';
import { FileText, Share2, Download, Printer, X } from 'lucide-react';
import ReporteCuerpo from './ReporteCuerpo.jsx';

/**
 * SatRC V2.0 — Modal del Reporte Diocesano (Vista Operativa)
 * 
 * Uso exclusivo de SatRC Operativo (autenticado con clave de operador).
 * Contiene los 3 botones de acción: WhatsApp, Descargar, Imprimir.
 * 
 * Estos botones NO están disponibles en la vista pública.
 * La razón es institucional: la difusión del comunicado es competencia
 * exclusiva de los administradores de Cáritas.
 */
export default function ReporteModalOperativo({
  abierto,
  alCerrar,
  reporteVigente,
  generandoOnDemand = false,
  zonasFallidasTemporal = null,
  onGenerarReporteParcial = null,
  onCompartirWhatsApp = null,
  onDescargar = null
}) {
  if (!abierto) return null;

  const puedeAccionar = !generandoOnDemand && reporteVigente;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[92vh] print:max-h-none print:border-0 print:shadow-none print:text-black print:bg-white">

        {/* Header con botones */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-wrap justify-between items-center gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Reporte Diocesano Oficial • On-Demand (En Vivo)</h3>
          </div>

          <div className="flex items-center gap-2">
            {onCompartirWhatsApp && (
              <button
                onClick={onCompartirWhatsApp}
                disabled={!puedeAccionar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Enviar WhatsApp</span>
              </button>
            )}

            {onDescargar && (
              <button
                onClick={onDescargar}
                disabled={!puedeAccionar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all border border-slate-600"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Descargar Doc</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              disabled={!puedeAccionar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={alCerrar}
              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo del reporte */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed font-sans print:p-6 print:text-xs">
          <ReporteCuerpo
            reporteVigente={reporteVigente}
            generandoOnDemand={generandoOnDemand}
            zonasFallidasTemporal={zonasFallidasTemporal}
            onGenerarReporteParcial={onGenerarReporteParcial}
            onCancelar={alCerrar}
          />
        </div>

      </div>
    </div>
  );
}