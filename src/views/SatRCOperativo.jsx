import React, { useState, useEffect } from 'react';
import db from '../data/localidades.json';
import { consultarModelosDeterministas } from '../engine/meteoFetcher.js';
import { generarConsensoDeterminista } from '../engine/consensusEngine.js';
import { evaluarLocalidad } from '../engine/riskEvaluator.js';
import RiskMap from '../components/RiskMap.jsx';
import SatelliteViewer from '../components/SatelliteViewer.jsx';
import { 
  Radio, 
  Power, 
  Send, 
  Bot, 
  ScrollText, 
  Clock, 
  AlertOctagon, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ExternalLink, 
  Mountain, 
  Waves, 
  Truck, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Download, 
  Layers, 
  RotateCw, 
  ShieldAlert, 
  FileText, 
  Printer,
  Sparkles,
  Share2,
  Check,
  Calendar
} from 'lucide-react';

export default function SatRCOperativo({ alCerrarSesion }) {
  const todasLocalidades = db.localidades || [];

  const [evaluaciones, setEvaluaciones] = useState([]);
  const [comunidadFoco, setComunidadFoco] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Filtros del Semáforo
  const [filtroSemaforo, setFiltroSemaforo] = useState('NIVEL4');
  const [bandejaAbierta, setBandejaAbierta] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  // Estados de SARA
  const [dictamenSARA, setDictamenSARA] = useState(null);
  const [bitacoraSARA, setBitacoraSARA] = useState([]);
  const [modalBitacoraAbierto, setModalBitacoraAbierto] = useState(false);
  const [disparandoManual, setDisparandoManual] = useState(false);
  const [comunidadDetalle, setComunidadDetalle] = useState(null);

  // Estados del Reporte On-Demand
  const [modalReporteOnDemandAbierto, setModalReporteOnDemandAbierto] = useState(false);
  const [generandoOnDemand, setGenerandoOnDemand] = useState(false);
  const [reporteVigente, setReporteVigente] = useState(null);

  // Evaluación Local de Respaldo en Vivo
  const ejecutarEvaluacionRealEnVivo = async (alertaSMN = null) => {
    const nodoSierra = todasLocalidades.find(l => l.nombre.toLowerCase().includes('huauchinango')) || todasLocalidades[0];
    let serieConsenso = [];

    try {
      const resM = await consultarModelosDeterministas(nodoSierra.coords.lat, nodoSierra.coords.lon);
      if (resM?.exito && resM?.datos_horarios) {
        serieConsenso = generarConsensoDeterminista(resM.datos_horarios);
      }
    } catch (e) {}

    const resEvaluadas = todasLocalidades.map(loc => {
      try {
        return evaluarLocalidad(loc, serieConsenso, { alertaSMN });
      } catch (err) {
        return null;
      }
    }).filter(Boolean);

    resEvaluadas.sort((a, b) => b.nivel_alerta - a.nivel_alerta);
    setEvaluaciones(resEvaluadas);
    setComunidadFoco(resEvaluadas[0] || null);
  };

  // Cargar Estado desde el Servidor Vercel Blob
  const cargarEstadoServidor = async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/sara?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.dictamen) setDictamenSARA(data.dictamen);
        if (data.bitacora) setBitacoraSARA(data.bitacora);
        if (data.ultimo_reporte_ondemand) setReporteVigente(data.ultimo_reporte_ondemand);

        if (data.evaluaciones && data.evaluaciones.length > 0) {
          setEvaluaciones(data.evaluaciones);
          setComunidadFoco(data.evaluaciones[0] || null);
        } else {
          await ejecutarEvaluacionRealEnVivo(data.dictamen);
        }
      } else {
        await ejecutarEvaluacionRealEnVivo();
      }
    } catch (e) {
      await ejecutarEvaluacionRealEnVivo();
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarEstadoServidor();
  }, []);

  // Generar Nuevo Reporte On-Demand (Llamada a Groq y guardado en Blob)
  const generarReporteOnDemand = async () => {
    setGenerandoOnDemand(true);
    setModalReporteOnDemandAbierto(true);

    const n4 = evaluaciones.filter(e => e?.nivel_alerta === 4).length;
    const n3 = evaluaciones.filter(e => e?.nivel_alerta === 3).length;
    const n1 = evaluaciones.filter(e => e?.nivel_alerta === 1).length;
    const focos = evaluaciones.filter(e => (e?.nivel_alerta ?? 1) >= 3).slice(0, 8).map(c => ({
      nombre: c.nombre,
      municipio: c.municipio,
      nivel: c.nivel_alerta,
      causa: c.diagnostico?.titulo,
      pendiente: `${c.geografia?.pendienteMax}°`,
      acceso: c.impactoSistemico?.accesoVial
    }));

    try {
      const res = await fetch('/api/reporte-ondemand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumenSeveridad: { totalNivel4: n4, totalNivel3: n3, totalNivel1: n1 },
          focosCriticos: focos
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reporte_guardado) {
          setReporteVigente(data.reporte_guardado);
        }
        if (data.bitacora_actualizada) {
          setBitacoraSARA(data.bitacora_actualizada);
        }
      }
    } catch (e) {
      console.error("Error al generar reporte On-Demand:", e);
    }
    setGenerandoOnDemand(false);
  };

  // Botón Compartir Directo en WhatsApp (Protocolo wa.me infalible)
  const compartirPorWhatsApp = () => {
    if (!reporteVigente) return;
    const r = reporteVigente.reporte;
    const textoMensaje = `🏛️ *REPORTE DIOCESANO DE SITUACIÓN • CÁRITAS TULANCINGO*\n` +
      `📅 *Emisión:* ${reporteVigente.fecha_dia_mexico} (${reporteVigente.hora_exacta_mexico} hrs)\n\n` +
      `*I. ATMÓSFERA REGIONAL:*\n${r.seccion_I_atmosfera}\n\n` +
      `*II. FOCOS CRÍTICOS EN SIERRA:*\n${r.seccion_II_focos_sierra}\n\n` +
      `*III. RECOMENDACIONES TÁCTICAS:*\n${r.seccion_V_recomendaciones_pastorales}\n\n` +
      `⛪ _Consulte al coordinador de Cáritas Diocesana._`;

    const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoMensaje)}`;
    window.open(urlWhatsApp, '_blank');
  };

  // Botón Descargar Documento Oficial Formateado (.txt)
  const descargarDocumentoOficial = () => {
    if (!reporteVigente) return;
    const r = reporteVigente.reporte;
    const contenidoDoc = `================================================================================
CÁRITAS PASTORAL SOCIAL • ARQUIDIÓCESIS DE TULANCINGO
SISTEMA DE ALERTA TEMPRANA Y RIESGOS CLIMÁTICOS (SatRC V2.0) • AGENTE SARA
================================================================================
REPORTE DIOCESANO DE SITUACIÓN METEOROLÓGICA (ON-DEMAND)
Folio de Auditoría: ${reporteVigente.id_reporte}
Fecha de Emisión: ${reporteVigente.fecha_dia_mexico}
Hora Exacta de Emisión: ${reporteVigente.hora_exacta_mexico} (Hora del Centro de México)
Consenso de Modelos: ${reporteVigente.consenso_modelos}
--------------------------------------------------------------------------------

I. DINÁMICA ATMOSFÉRICA REGIONAL:
${r.seccion_I_atmosfera}

II. FOCOS PRIORITARIOS DE TENSIÓN EN LA SIERRA (NIVEL 4 Y NIVEL 3):
${r.seccion_II_focos_sierra}

III. CONDICIONES EN EL ALTIPLANO Y VALLES (ZONAS EN ESTABILIDAD):
${r.seccion_III_altiplano_calma}

IV. PRONÓSTICO DE EVOLUCIÓN (PRÓXIMAS 12 A 24 HORAS):
${r.seccion_IV_evolucion}

V. RECOMENDACIONES TÁCTICAS SEGÚN CONDICIONES ACTIVAS:
${r.seccion_V_recomendaciones_pastorales}

VI. AVISO INSTITUCIONAL Y COORDINACIÓN CON PROTECCIÓN CIVIL:
${r.seccion_VI_deslinde}

--------------------------------------------------------------------------------
Instrucción Diocesana: "Consulte al coordinador de Cáritas"
Documento oficial para párrocos, brigadistas y autoridades de auxilio.
================================================================================`;

    const blob = new Blob([contenidoDoc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Diocesano_Caritas_${reporteVigente.fecha_dia_mexico.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Conteos
  const totalNivel4 = evaluaciones.filter(e => e?.nivel_alerta === 4).length;
  const totalNivel3 = evaluaciones.filter(e => e?.nivel_alerta === 3).length;
  const totalNivel2 = evaluaciones.filter(e => e?.nivel_alerta === 2).length;
  const totalNivel1 = evaluaciones.filter(e => e?.nivel_alerta === 1).length;

  const comunidadesFiltradas = evaluaciones.filter(item => {
    if (!item) return false;
    if (filtroSemaforo === 'NIVEL4') return item.nivel_alerta === 4;
    if (filtroSemaforo === 'NIVEL3') return item.nivel_alerta === 3;
    if (filtroSemaforo === 'NIVEL2') return item.nivel_alerta === 2;
    if (filtroSemaforo === 'NIVEL1') return item.nivel_alerta === 1;
    return true;
  });

  const totalPaginas = Math.ceil(comunidadesFiltradas.length / itemsPorPagina) || 1;
  const itemsPaginados = comunidadesFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina
  );

  const obtenerTendencia = (item) => {
    const sat = item?.impactoSistemico?.saturacionTotalSueloMm ?? 0;
    const nivel = item?.nivel_alerta ?? 1;
    if (nivel >= 3 && sat >= 70) {
      return { texto: "Empeorando", icono: TrendingUp, color: "text-rose-400" };
    }
    if (nivel >= 2) {
      return { texto: "Estacionario", icono: Minus, color: "text-amber-400" };
    }
    return { texto: "Mejorando", icono: TrendingDown, color: "text-emerald-400" };
  };

  return (
    <div className="space-y-6">
      
      {/* 1. BARRA SUPERIOR DE MANDO */}
      <div className="bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-white tracking-wide">
                Cuarto de Situación Diocesano
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                CRON AUTÓNOMO :21 (ACTIVO)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cáritas Pastoral Social • Arquidiócesis de Tulancingo (405 Localidades)
            </p>
          </div>
        </div>

        {/* Acciones de Mando con Botón ON-DEMAND */}
        <div className="flex flex-wrap items-center gap-2">
          {/* BOTÓN REPORTE DIOCESANO ON-DEMAND */}
          <button
            onClick={generarReporteOnDemand}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/25 border border-amber-400"
            title="Generar reporte diocesano en tiempo real con Groq Llama-3.3"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>Generar Reporte On-Demand</span>
          </button>

          <button
            onClick={() => setModalBitacoraAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs border border-amber-500/30 transition-all shadow"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-400" />
            Bitácora SARA ({bitacoraSARA.length})
          </button>

          <button
            onClick={alCerrarSesion}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-medium border border-slate-700"
          >
            Salir
          </button>
        </div>
      </div>

      {/* 2. TARJETA PERMANENTE DEL ÚLTIMO REPORTE DIOCESANO GUARDADO EN BLOB */}
      {reporteVigente && (
        <div className="bg-slate-900 border-2 border-amber-500/40 p-4 rounded-2xl shadow-xl flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider block">
                Último Reporte Diocesano Emitido en el Servidor
              </span>
              <p className="text-xs md:text-sm font-bold text-white">
                Emitido el {reporteVigente.fecha_dia_mexico} a las {reporteVigente.hora_exacta_mexico} hrs
              </p>
              <p className="text-[11px] text-slate-300 truncate max-w-xl">
                {reporteVigente.reporte?.seccion_I_atmosfera?.slice(0, 110)}...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModalReporteOnDemandAbierto(true);
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow"
            >
              Consultar / Exportar
            </button>
          </div>
        </div>
      )}

      {/* 3. SEMÁFORO INTERACTIVO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div onClick={() => { setFiltroSemaforo('NIVEL4'); setPaginaActual(1); }} className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${filtroSemaforo === 'NIVEL4' ? 'bg-rose-950/90 border-rose-500 scale-[1.02]' : 'bg-slate-900 border-rose-500/40 hover:border-rose-500'}`}>
          <div>
            <span className="text-xs font-black text-rose-400 uppercase flex items-center gap-1"><AlertOctagon className="w-3.5 h-3.5" /> Emergencia (N4)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Laderas ≥ 45°</p>
          </div>
          <span className="text-2xl font-black text-rose-400">{totalNivel4}</span>
        </div>

        <div onClick={() => { setFiltroSemaforo('NIVEL3'); setPaginaActual(1); }} className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${filtroSemaforo === 'NIVEL3' ? 'bg-orange-950/90 border-orange-500 scale-[1.02]' : 'bg-slate-900 border-orange-500/40 hover:border-orange-500'}`}>
          <div>
            <span className="text-xs font-black text-orange-400 uppercase flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Alerta Temprana (N3)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Laderas 25° a 44°</p>
          </div>
          <span className="text-2xl font-black text-orange-400">{totalNivel3}</span>
        </div>

        <div onClick={() => { setFiltroSemaforo('NIVEL2'); setPaginaActual(1); }} className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${filtroSemaforo === 'NIVEL2' ? 'bg-amber-950/90 border-amber-500 scale-[1.02]' : 'bg-slate-900 border-slate-800 hover:border-amber-500/60'}`}>
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase">Vigilancia (N2)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Valles / Niebla</p>
          </div>
          <span className="text-2xl font-bold text-amber-400">{totalNivel2}</span>
        </div>

        <div onClick={() => { setFiltroSemaforo('NIVEL1'); setPaginaActual(1); }} className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${filtroSemaforo === 'NIVEL1' ? 'bg-emerald-950/90 border-emerald-500 scale-[1.02]' : 'bg-slate-900 border-slate-800 hover:border-emerald-500/60'}`}>
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase">Estables (N1)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Altiplano en paz</p>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{totalNivel1}</span>
        </div>
      </div>

      {/* 4. DÚO TÁCTICO */}
      <div className="space-y-6">
        <RiskMap evaluaciones={evaluaciones} localidadFoco={comunidadFoco} alSeleccionarLocalidad={(item) => { setComunidadFoco(item); setComunidadDetalle(item); }} />
        <SatelliteViewer />
      </div>

      {/* 5. BANDEJA DE COMUNIDADES */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <button onClick={() => setBandejaAbierta(!bandejaAbierta)} className="w-full p-4 bg-slate-800/90 hover:bg-slate-800 flex justify-between items-center transition-colors text-left">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            Comunidades en: <strong className="text-amber-300">{filtroSemaforo}</strong> ({comunidadesFiltradas.length} encontradas)
          </span>
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
            {bandejaAbierta ? 'Contraer' : 'Desplegar Listado'}
            {bandejaAbierta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {bandejaAbierta && (
          <div className="border-t border-slate-800 animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Severidad</th>
                    <th className="py-3 px-3">Evolución</th>
                    <th className="py-3 px-3">Comunidad</th>
                    <th className="py-3 px-3">Municipio</th>
                    <th className="py-3 px-3">Saturación Suelo</th>
                    <th className="py-3 px-3">Vector Dominante</th>
                    <th className="py-3 px-3">Acceso Vial</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {itemsPaginados.map((item) => {
                    const tendencia = obtenerTendencia(item);
                    const IconoTendencia = tendencia.icono;

                    return (
                      <tr key={item?.localidad_id || Math.random()} onClick={() => setComunidadFoco(item)} className="hover:bg-slate-800/40 cursor-pointer transition-colors">
                        <td className="py-2.5 px-4"><span className="text-[10px] font-black px-2 py-0.5 rounded text-white shadow" style={{ backgroundColor: item?.color_alerta }}>Nivel {item?.nivel_alerta}</span></td>
                        <td className="py-2.5 px-3"><span className={`flex items-center gap-1 font-bold text-[10px] ${tendencia.color}`}><IconoTendencia className="w-3.5 h-3.5" />{tendencia.texto}</span></td>
                        <td className="py-2.5 px-3 font-extrabold text-white">{item?.nombre}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item?.municipio}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">{item?.impactoSistemico?.saturacionTotalSueloMm ?? 0} mm</td>
                        <td className="py-2.5 px-3 text-cyan-400 font-semibold">{item?.vector_dominante || item?.diagnostico?.titulo}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item?.impactoSistemico?.accesoVial}</td>
                        <td className="py-2.5 px-4 text-center">
                          <button onClick={(e) => { e.stopPropagation(); setComunidadFoco(item); setComunidadDetalle(item); }} className="text-[11px] font-bold text-amber-400 hover:text-white bg-slate-800 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 transition-all">Auditar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Mostrando <strong className="text-white">{(paginaActual - 1) * itemsPorPagina + 1}</strong> a <strong className="text-white">{Math.min(paginaActual * itemsPorPagina, comunidadesFiltradas.length)}</strong> de <strong className="text-white">{comunidadesFiltradas.length}</strong></span>
              <div className="flex items-center gap-2">
                <button disabled={paginaActual === 1} onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-300"><ChevronLeft className="w-4 h-4" /> Anterior</button>
                <span className="font-mono text-slate-300 px-2 font-bold">{paginaActual} / {totalPaginas}</span>
                <button disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-300">Siguiente <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* 6. MODAL DE REPORTE DIOCESANO ON-DEMAND FORMAL             */}
      {/* ========================================================== */}
      {modalReporteOnDemandAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[92vh] print:max-h-none print:border-0 print:shadow-none print:text-black print:bg-white">
            
            {/* Cabecera del Reporte On-Demand */}
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-wrap justify-between items-center gap-2 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Reporte Diocesano Oficial • On-Demand (En Vivo)</h3>
              </div>

              {/* Botones de Exportación Operativos */}
              <div className="flex items-center gap-2">
                {/* 1. WHATSAPP DIRECTO */}
                <button
                  onClick={compartirPorWhatsApp}
                  disabled={generandoOnDemand || !reporteVigente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow"
                  title="Abrir WhatsApp para enviar"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Enviar WhatsApp</span>
                </button>

                {/* 2. DESCARGAR DOCUMENTO (.TXT) */}
                <button
                  onClick={descargarDocumentoOficial}
                  disabled={generandoOnDemand || !reporteVigente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all border border-slate-600"
                  title="Descargar archivo oficial de texto"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descargar Doc</span>
                </button>

                {/* 3. IMPRIMIR / PDF */}
                <button
                  onClick={() => window.print()}
                  disabled={generandoOnDemand || !reporteVigente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>

                <button onClick={() => setModalReporteOnDemandAbierto(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenido Formal del Documento */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed font-sans print:p-6 print:text-xs">
              {generandoOnDemand ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-bold text-white text-sm">SARA (Groq Llama-3.3-70B) redactando reporte en tiempo real...</p>
                  <p className="text-[11px] text-slate-400">Analizando cuencas y sellando entrada en la bitácora de Vercel Blob.</p>
                </div>
              ) : reporteVigente ? (
                <>
                  {/* Membrete Oficial */}
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

                  {/* I. Dinámica Atmosférica Regional */}
                  <div className="space-y-1">
                    <h4 className="font-black text-amber-400 uppercase tracking-wider text-[11px] print:text-amber-900">
                      I. Dinámica Atmosférica Regional
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_I_atmosfera}
                    </div>
                  </div>

                  {/* II. Focos de Tensión en la Sierra */}
                  <div className="space-y-1">
                    <h4 className="font-black text-rose-400 uppercase tracking-wider text-[11px] print:text-rose-900">
                      II. Focos Prioritarios de Tensión en la Sierra (Nivel 4 y Nivel 3)
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_II_focos_sierra}
                    </div>
                  </div>

                  {/* III. Condiciones en Altiplano */}
                  <div className="space-y-1">
                    <h4 className="font-black text-emerald-400 uppercase tracking-wider text-[11px] print:text-emerald-900">
                      III. Condiciones en el Altiplano y Valles (Zonas en Estabilidad)
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_III_altiplano_calma}
                    </div>
                  </div>

                  {/* IV. Pronóstico de Evolución */}
                  <div className="space-y-1">
                    <h4 className="font-black text-cyan-400 uppercase tracking-wider text-[11px] print:text-cyan-900">
                      IV. Pronóstico de Evolución (Próximas 12 a 24 Horas)
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_IV_evolucion}
                    </div>
                  </div>

                  {/* V. Recomendaciones Tácticas Comunitarias */}
                  <div className="space-y-1">
                    <h4 className="font-black text-amber-300 uppercase tracking-wider text-[11px] print:text-amber-900">
                      V. Recomendaciones Tácticas según Condiciones Activas
                    </h4>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-slate-100 print:bg-amber-50 print:border-amber-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_V_recomendaciones_pastorales}
                    </div>
                  </div>

                  {/* VI. Deslinde Oficial */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 space-y-1 print:bg-gray-50 print:border-gray-200 print:text-gray-600">
                    <p className="font-bold text-slate-300 print:text-black">VI. Aviso Institucional y Coordinación con Protección Civil:</p>
                    <p>{reporteVigente.reporte?.seccion_VI_deslinde}</p>
                  </div>

                  {/* Pie de Firma */}
                  <div className="pt-3 border-t border-slate-800 flex justify-between items-end text-[10px] text-slate-500 print:border-gray-300 print:text-gray-600">
                    <p className="font-semibold text-amber-400 print:text-amber-900">Instrucción diocesana: "Consulte al coordinador de Cáritas"</p>
                    <div className="text-center font-mono">
                      <div className="w-36 border-b border-slate-600 mb-1 print:border-gray-400"></div>
                      <span>Sello de Guardia SatRC</span>
                    </div>
                  </div>
                </>
              ) : null}

            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE BITÁCORA */}
      {modalBitacoraAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[85vh]">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <ScrollText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm md:text-base text-white">Bitácora Auditable de Operaciones • Agente SARA</h3>
                  <p className="text-[11px] text-slate-400">Almacén en Vercel Blob • Hash SHA-256 encadenado</p>
                </div>
              </div>
              <button onClick={() => setModalBitacoraAbierto(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 font-mono text-xs">
              {bitacoraSARA.map((entry) => (
                <div key={entry.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-amber-400 font-bold">{entry.fecha_dia_mexico ? `${entry.fecha_dia_mexico} • ${entry.hora_exacta_mexico}` : entry.timestamp_local} ({entry.id})</span>
                    <span className="text-slate-400 text-[10px]">Hash: <strong className="text-emerald-400">{entry.hash}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded font-bold">
                      {entry.origen_evento || "PROGRAMADO_CRON_21"}
                    </span>
                    <p className="text-white font-bold text-xs">{entry.titulo}</p>
                  </div>
                  <p className="text-slate-300 text-[11px] font-sans leading-relaxed">{entry.resumen}</p>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 px-4">
              <span>Preservación permanente en Vercel Blob • Inmune a redeploys.</span>
              <button onClick={() => setModalBitacoraAbierto(false)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL AUDITORÍA */}
      {comunidadDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-start" style={{ backgroundColor: `${comunidadDetalle?.color_alerta || '#10B981'}20` }}>
              <div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded text-white" style={{ backgroundColor: comunidadDetalle?.color_alerta }}>
                  NIVEL {comunidadDetalle?.nivel_alerta} • {comunidadDetalle?.estado_alerta}
                </span>
                <h2 className="text-xl font-black text-white mt-1">{comunidadDetalle?.nombre}</h2>
                <p className="text-xs text-slate-300">{comunidadDetalle?.municipio}, {comunidadDetalle?.estado} • Cuenca: {comunidadDetalle?.geografia?.cuenca}</p>
              </div>
              <button onClick={() => setComunidadDetalle(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Diagnóstico Físico</p>
                <p className="text-sm font-bold text-white">{comunidadDetalle?.diagnostico?.titulo}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{comunidadDetalle?.diagnostico?.causa}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60"><span className="text-[10px] text-slate-400 uppercase font-semibold block">Pendiente Máx</span><span className="text-base font-bold text-white">{comunidadDetalle?.geografia?.pendienteMax ?? 0}°</span></div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60"><span className="text-[10px] text-slate-400 uppercase font-semibold block">Acceso Vial</span><span className="text-xs font-bold text-amber-300 block truncate">{comunidadDetalle?.impactoSistemico?.accesoVial}</span></div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60"><span className="text-[10px] text-slate-400 uppercase font-semibold block">Hospital Cercano</span><span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.distanciaHospitalKm ?? 0} km</span></div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60"><span className="text-[10px] text-slate-400 uppercase font-semibold block">Ventana Acción</span><span className="text-base font-bold text-emerald-400">{comunidadDetalle?.tiempos?.ventanaAccionHoras ?? 6} hrs</span></div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                <p className="text-xs font-bold text-amber-300 italic">{comunidadDetalle?.protocolo || "Consulte al coordinador de Cáritas"}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center text-xs">
              <span className="text-slate-400">Población directa: <strong className="text-white">{comunidadDetalle?.impactoSistemico?.poblacionDirecta?.toLocaleString() ?? 0}</strong> habitantes</span>
              <button onClick={() => setComunidadDetalle(null)} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}