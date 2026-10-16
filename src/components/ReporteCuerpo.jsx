import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * SatRC V2.0 — Cuerpo del Reporte Diocesano
 * 
 * Componente compartido entre:
 * - ReporteModalOperativo (SatRC Operativo, autenticado)
 * - ReporteModalPublico (Monitor Climático, público)
 * 
 * NO contiene botones de acción. Solo el contenido del reporte.
 * Las acciones (WhatsApp, Descargar, Imprimir) son responsabilidad
 * del modal que lo contiene.
 */

/**
 * Componente para renderizar texto con viñetas y negritas desde Groq.
 */
function TextoEnriquecido({ texto, className = "" }) {
  if (!texto || typeof texto !== 'string') return null;

  const lineas = texto.split('\n').filter(l => l.trim().length > 0);

  const renderizarNegritas = (linea) => {
    const partes = linea.split(/(\*\*[^*]+\*\*)/g);
    return partes.map((parte, i) => {
      if (parte.startsWith('**') && parte.endsWith('**')) {
        return <strong key={i} className="font-bold text-white">{parte.slice(2, -2)}</strong>;
      }
      return <span key={i}>{parte}</span>;
    });
  };

  const esVineta = (linea) => /^\s*[-•*]\s+/.test(linea);

  const parrafos = [];
  let listaActual = [];

  lineas.forEach((linea, idx) => {
    if (esVineta(linea)) {
      const contenido = linea.replace(/^\s*[-•*]\s+/, '');
      listaActual.push(<li key={idx} className="ml-4 list-disc">{renderizarNegritas(contenido)}</li>);
    } else {
      if (listaActual.length > 0) {
        parrafos.push(<ul key={`ul-${idx}`} className="space-y-1 my-1">{listaActual}</ul>);
        listaActual = [];
      }
      parrafos.push(<p key={`p-${idx}`} className="my-1">{renderizarNegritas(linea)}</p>);
    }
  });

  if (listaActual.length > 0) {
    parrafos.push(<ul key="ul-final" className="space-y-1 my-1">{listaActual}</ul>);
  }

  return <div className={className}>{parrafos}</div>;
}

export default function ReporteCuerpo({
  reporteVigente,
  generandoOnDemand = false,
  zonasFallidasTemporal = null,
  onGenerarReporteParcial = null,
  onCancelar = null
}) {
  // Bloque: generando reporte
  if (generandoOnDemand) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-white text-sm">SARA redactando reporte en tiempo real...</p>
        <p className="text-[11px] text-slate-400">Consultando 14 zonas regionales. Esto puede tardar hasta 30 segundos en conexiones lentas.</p>
      </div>
    );
  }

  // Bloque: zonas fallidas (modo emergencia)
  if (zonasFallidasTemporal) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/20 rounded-full">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white">Reporte no generado</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            El reporte requiere las 14 zonas completas, pero <strong className="text-amber-400">{zonasFallidasTemporal.length} zonas no respondieron</strong>:
          </p>
          <p className="text-xs text-slate-400 font-mono">{zonasFallidasTemporal.join(', ')}</p>
          <p className="text-xs text-slate-400 leading-relaxed pt-2">
            Esto puede deberse a la calidad de su conexión a internet. Si necesita el reporte ahora, puede generarlo en <strong className="text-amber-300">modo emergencia</strong> (parcial) e intentar de nuevo más tarde para obtener el completo.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            onClick={onCancelar}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
          >
            Cancelar
          </button>
          {onGenerarReporteParcial && (
            <button
              onClick={onGenerarReporteParcial}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg"
            >
              Generar reporte parcial (modo emergencia)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Bloque: reporte completo
  if (!reporteVigente) return null;

  return (
    <>
      <div className="border-b-2 border-amber-500 pb-3 flex justify-between items-start">
        <div>
          <h1 className="text-base md:text-lg font-black text-white uppercase tracking-tight print:text-black">
            Cáritas Pastoral Social • Arquidiócesis de Tulancingo
          </h1>
          <p className="text-xs text-amber-400 font-semibold print:text-amber-800">
            Sistema de Alerta Temprana y Riesgos Climáticos (SatRC V2.0) • Agente SARA
          </p>
        </div>
        <div className="text-right font-mono text-[11px] text-slate-400 print:text-gray-600">
          <p>Sello de Emisión: <strong>{reporteVigente.fecha_dia_mexico} a las {reporteVigente.hora_exacta_mexico} hrs</strong></p>
          <p>Consenso: {reporteVigente.consenso_modelos}</p>
        </div>
      </div>

      {/* Sección 0 — Decisión Operativa destacada */}
      {reporteVigente.reporte?.seccion_0_decision && (
        <div
          className="p-4 rounded-xl border-l-4"
          style={{
            borderColor: reporteVigente.dictamen?.color || '#10B981',
            backgroundColor: `${reporteVigente.dictamen?.color || '#10B981'}15`
          }}
        >
          <span
            className="text-[10px] font-black uppercase tracking-widest opacity-90"
            style={{ color: reporteVigente.dictamen?.color || '#10B981' }}
          >
            Decisión Operativa
          </span>
          <p className="text-sm md:text-base font-bold text-white mt-1.5 leading-snug print:text-black">
            {reporteVigente.reporte.seccion_0_decision}
          </p>
        </div>
      )}

      <div className="space-y-1">
        <h4 className="font-black text-amber-400 uppercase tracking-wider text-[11px] print:text-amber-900">
          I. Estado General
        </h4>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
          <TextoEnriquecido texto={reporteVigente.reporte?.seccion_I_atmosfera} />
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="font-black text-rose-400 uppercase tracking-wider text-[11px] print:text-rose-900">
          II. Zonas que Requieren Atención
        </h4>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
          <TextoEnriquecido texto={reporteVigente.reporte?.seccion_II_focos_sierra} />
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="font-black text-emerald-400 uppercase tracking-wider text-[11px] print:text-emerald-900">
          III. Evolución de las Condiciones
        </h4>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
          <TextoEnriquecido texto={reporteVigente.reporte?.seccion_III_condiciones_altiplano} />
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="font-black text-cyan-400 uppercase tracking-wider text-[11px] print:text-cyan-900">
          IV. Perspectiva y Aviso Oficial
        </h4>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
          <TextoEnriquecido texto={reporteVigente.reporte?.seccion_IV_evolucion} />
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="font-black text-amber-300 uppercase tracking-wider text-[11px] print:text-amber-900">
          V. Recomendaciones Tácticas
        </h4>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-slate-100 print:bg-amber-50 print:border-amber-300 print:text-gray-900">
          <TextoEnriquecido texto={reporteVigente.reporte?.seccion_V_recomendaciones_pastorales} />
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 space-y-1 print:bg-gray-50 print:border-gray-200 print:text-gray-600">
        <p className="font-bold text-slate-300 print:text-black">VI. Aviso Institucional:</p>
        <p>{reporteVigente.reporte?.seccion_VI_deslinde}</p>
      </div>

      <div className="pt-3 border-t border-slate-800 flex justify-between items-end text-[10px] text-slate-500 print:border-gray-300 print:text-gray-600">
        <p className="font-semibold text-amber-400 print:text-amber-900">Instrucción diocesana: "Consulte al coordinador de Cáritas"</p>
        <div className="text-center font-mono">
          <div className="w-36 border-b border-slate-600 mb-1 print:border-gray-400"></div>
          <span>Sello de Guardia SatRC</span>
        </div>
      </div>
    </>
  );
}