import React, { useState, useEffect } from 'react';
import ReporteCuerpo from '../components/ReporteCuerpo.jsx';
import { Bot, AlertCircle } from 'lucide-react';

export default function ReporteSara() {
  const [reporteVigente, setReporteVigente] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function cargarReporte() {
      try {
        const res = await fetch(`/api/sara?t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) throw new Error("Error de red");
        const data = await res.json();
        
        if (!cancelado && data.ultimo_reporte_ondemand) {
          setReporteVigente(data.ultimo_reporte_ondemand);
        }
      } catch (e) {
        console.warn("[SARA] No se pudo cargar el reporte:", e.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarReporte();
    return () => { cancelado = true; };
  }, []);

  // Validar si el reporte es del día de hoy
  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const esDeHoy = reporteVigente && reporteVigente.fecha_dia_mexico === fechaHoy;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3 px-2 border-b border-slate-800 pb-4">
        <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white leading-tight">Reporte Diario SARA</h2>
          <p className="text-xs text-slate-400">Orientación comunitaria oficial</p>
        </div>
      </div>

      {cargando ? (
        <div className="p-16 flex flex-col items-center justify-center gap-4 text-slate-400">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-mono">Cargando reporte vigente...</p>
        </div>
      ) : !esDeHoy ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4">
          <AlertCircle className="w-12 h-12 text-slate-500" />
          <div>
            <h3 className="text-lg font-bold text-white">Sin reporte vigente hoy</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-md">
              Aún no se ha generado el reporte oficial para el día de hoy. El sistema se actualiza automáticamente cada mañana a las 6:00 AM.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 p-5 md:p-8 rounded-2xl shadow-xl text-slate-200">
          <ReporteCuerpo 
            reporteVigente={reporteVigente} 
            generandoOnDemand={false} 
            zonasFallidasTemporal={null} 
            onGenerarReporteParcial={null} 
            onCancelar={null} 
          />
        </div>
      )}
    </div>
  );
}