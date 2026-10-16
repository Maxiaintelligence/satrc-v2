import React from 'react';
import { FileText, X } from 'lucide-react';
import ReporteCuerpo from './ReporteCuerpo.jsx';

/**
 * SatRC V2.0 — Modal del Reporte Diocesano (Vista Pública)
 * 
 * Uso exclusivo del Monitor Climático (público general).
 * 
 * DIFERENCIAS CON EL MODAL OPERATIVO:
 * - NO tiene botón "Enviar WhatsApp".
 * - NO tiene botón "Descargar Doc".
 * - NO tiene botón "Imprimir / PDF".
 * 
 * La razón es institucional: el reporte es un comunicado de condiciones,
 * NO un documento oficial. La difusión es competencia exclusiva de los
 * administradores de Cáritas. El público solo puede CONSULTAR el contenido.
 */
export default function ReporteModalPublico({
  abierto,
  alCerrar,
  reporteVigente
}) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[92vh] print:max-h-none print:border-0 print:shadow-none print:text-black print:bg-white">

        {/* Header sin botones de acción */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-wrap justify-between items-center gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Comunicado de Condiciones Meteorológicas</h3>
          </div>

          <div className="flex items-center gap-2">
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
            generandoOnDemand={false}
            zonasFallidasTemporal={null}
            onGenerarReporteParcial={null}
            onCancelar={alCerrar}
          />
        </div>

      </div>
    </div>
  );
}