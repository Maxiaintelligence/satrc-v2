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
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function SatRCOperativo({ alCerrarSesion }) {
  const todasLocalidades = db.localidades;

  // Estados del Cuarto de Situación
  const [killSwitchActivo, setKillSwitchActivo] = useState(false);
  const [cargandoEvaluacion, setCargandoEvaluacion] = useState(true);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [comunidadFoco, setComunidadFoco] = useState(null);

  // Estados de la Bandeja Colapsable y Paginada
  const [bandejaAbierta, setBandejaAbierta] = useState(false); // Contraída por defecto
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  // Estados de SARA
  const [dictamenSARA, setDictamenSARA] = useState(null);
  const [bitacoraSARA, setBitacoraSARA] = useState([]);
  const [modalBitacoraAbierto, setModalBitacoraAbierto] = useState(false);
  const [cargandoSARA, setCargandoSARA] = useState(true);

  // Modal de Detalle Profundo
  const [comunidadDetalle, setComunidadDetalle] = useState(null);

  // Alerta SMN
  const [alertaSMN, setAlertaSMN] = useState(null);

  // Emisión Manual Pastoral
  const [modoManual, setModoManual] = useState(false);
  const [nivelManual, setNivelManual] = useState(4);
  const [zonaManual, setZonaManual] = useState(todasLocalidades[0]?.zona_nombre || '');
  const [mensajeManual, setMensajeManual] = useState('');
  const [alertaManualEmitida, setAlertaManualEmitida] = useState(null);

  // 1. Cargar Aviso del SMN
  useEffect(() => {
    fetch('/api/smn')
      .then(r => r.json())
      .then(d => { if (d.exito && d.alerta) setAlertaSMN(d.alerta); })
      .catch(() => null);
  }, []);

  // 2. Escaneo Geofísico de las 405 Comunidades
  useEffect(() => {
    if (killSwitchActivo) {
      setCargandoEvaluacion(false);
      return;
    }

    let cancelado = false;
    async function correrEscaneo() {
      setCargandoEvaluacion(true);

      const nodoSierra = db.localidades.find(l => l.nombre.toLowerCase().includes('huauchinango')) || db.localidades[0];
      const resMeteo = await consultarModelosDeterministas(nodoSierra.coords.lat, nodoSierra.coords.lon);

      if (cancelado) return;

      let serieConsenso = [];
      if (resMeteo.exito) {
        serieConsenso = generarConsensoDeterminista(resMeteo.datos_horarios);
      }

      // Evaluación individualizada sin inyecciones arbitrarias
      const resultados = todasLocalidades.map(loc => {
        return evaluarLocalidad(loc, serieConsenso, { alertaSMN: alertaSMN });
      });

      resultados.sort((a, b) => {
        if (b.nivel_alerta !== a.nivel_alerta) return b.nivel_alerta - a.nivel_alerta;
        return b.impactoSistemico.saturacionTotalSueloMm - a.impactoSistemico.saturacionTotalSueloMm;
      });

      if (!cancelado) {
        setEvaluaciones(resultados);
        setComunidadFoco(resultados[0] || null);
        setCargandoEvaluacion(false);

        // Llamada a SARA
        const n4 = resultados.filter(e => e.nivel_alerta === 4).length;
        const n3 = resultados.filter(e => e.nivel_alerta === 3).length;
        const n1 = resultados.filter(e => e.nivel_alerta === 1).length;
        const criticas = resultados.filter(e => e.nivel_alerta >= 3).slice(0, 6).map(c => `${c.nombre} (${c.municipio})`);

        fetch('/api/sara', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertaSMN: alertaSMN,
            resumenSeveridad: { totalNivel4: n4, totalNivel3: n3, totalNivel1: n1, criticasNombres: criticas }
          })
        })
          .then(r => r.json())
          .then(data => {
            if (data.exito && data.dictamen) {
              setDictamenSARA(data.dictamen);
              setBitacoraSARA(data.bitacora || []);
            }
            setCargandoSARA(false);
          })
          .catch(() => setCargandoSARA(false));
      }
    }

    correrEscaneo();
    return () => { cancelado = true; };
  }, [killSwitchActivo, alertaSMN]);

  // Conteos
  const totalNivel4 = evaluaciones.filter(e => e.nivel_alerta === 4).length;
  const totalNivel3 = evaluaciones.filter(e => e.nivel_alerta === 3).length;
  const totalNivel2 = evaluaciones.filter(e => e.nivel_alerta === 2).length;
  const totalNivel1 = evaluaciones.filter(e => e.nivel_alerta === 1).length;

  // Comunidades en riesgo real (Nivel 3 y 4) para la bandeja
  const incidentesCriticos = evaluaciones.filter(e => e.nivel_alerta >= 3);
  const totalPaginas = Math.ceil(incidentesCriticos.length / itemsPorPagina) || 1;
  const incidentesPaginados = incidentesCriticos.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina
  );

  const emitirAlertaManual = (e) => {
    e.preventDefault();
    if (!mensajeManual.trim()) return;

    setAlertaManualEmitida({
      timestamp: new Date().toLocaleTimeString(),
      zona: zonaManual,
      nivel: nivelManual,
      mensaje: mensajeManual
    });
    setModoManual(false);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. CABECERA LIMPIA: ESTADO DEL CUARTO + SARA (3 LÍNEAS) */}
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
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                killSwitchActivo 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {killSwitchActivo ? 'PARADO (MODO MANUAL)' : 'VIGILANCIA SISTÉMICA ACTIVA'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cáritas Pastoral Social • Arquidiócesis de Tulancingo (405 Localidades)
            </p>
          </div>
        </div>

        {/* Acciones del Coordinador */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setModalBitacoraAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs border border-amber-500/30 transition-all shadow"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-400" />
            Bitácora de SARA ({bitacoraSARA.length})
          </button>

          <button
            onClick={() => setKillSwitchActivo(!killSwitchActivo)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              killSwitchActivo
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {killSwitchActivo ? 'Reanudar' : 'Paro General'}
          </button>

          <button
            onClick={() => setModoManual(!modoManual)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow"
          >
            <Send className="w-3.5 h-3.5" />
            {modoManual ? 'Cerrar Aviso' : 'Emitir Aviso'}
          </button>

          <button
            onClick={alCerrarSesion}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-medium border border-slate-700"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Dictamen Sinóptico de SARA (3 Líneas Claras y Sobrias) */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-start gap-3.5">
        <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl shrink-0 mt-0.5">
          <Bot className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                Informe de Guardia • Agente SARA
              </span>
              {dictamenSARA && (
                <span 
                  className="text-[10px] font-black px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: dictamenSARA.color }}
                >
                  {dictamenSARA.estado_situacion}
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Corrida: <strong className="text-white">{dictamenSARA?.hora_evaluacion || '--:--'}</strong> • Próxima: {dictamenSARA?.proxima_evaluacion || '--:--'}
            </span>
          </div>

          <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-normal">
            {dictamenSARA?.comentario_oficial || "Monitoreo diocesano activo. Evaluaciones físicas ejecutadas sobre las 405 comunidades."}
          </p>
        </div>
      </div>

      {/* Semáforo Compacto de las 405 Localidades */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border bg-slate-900 border-rose-500/60 shadow flex justify-between items-center">
          <div>
            <span className="text-xs font-black text-rose-400 uppercase flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" /> Emergencia (N4)
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Laderas al límite</p>
          </div>
          <span className="text-2xl font-black text-rose-400">{totalNivel4}</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-slate-900 border-orange-500/60 shadow flex justify-between items-center">
          <div>
            <span className="text-xs font-black text-orange-400 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Alerta Temprana (N3)
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Lluvia en laderas/caminos</p>
          </div>
          <span className="text-2xl font-black text-orange-400">{totalNivel3}</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-slate-900 border-slate-800 shadow flex justify-between items-center opacity-80">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase">Vigilancia (N2)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Precipitación activa</p>
          </div>
          <span className="text-2xl font-bold text-amber-400">{totalNivel2}</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-slate-900 border-slate-800 shadow flex justify-between items-center opacity-80">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase">Estables (N1)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Altiplano y valles</p>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{totalNivel1}</span>
        </div>
      </div>

      {/* 2. DÚO TÁCTICO OPERATIVO: EL MAPA Y EL SATÉLITE LADO A LADO */}
      <div className="space-y-6">
        
        {/* A) Cartografía Táctica de Comunidades */}
        <RiskMap 
          evaluaciones={evaluaciones}
          localidadFoco={comunidadFoco}
          alSeleccionarLocalidad={(item) => {
            setComunidadFoco(item);
            setComunidadDetalle(item); // Abre la auditoría profunda
          }}
        />

        {/* B) Visor Satelital GOES-19 en Vivo (Los 5 Canales Limpios) */}
        <SatelliteViewer />

      </div>

      {/* 3. BANDEJA DE INCIDENTES CRÍTICOS (COLAPSABLE Y CON PAGINACIÓN DE 10 EN 10) */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        
        {/* Barra de Expansión / Contracción */}
        <button
          onClick={() => setBandejaAbierta(!bandejaAbierta)}
          className="w-full p-4 bg-slate-800/90 hover:bg-slate-800 flex justify-between items-center transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              Bandeja de Incidentes Prioritarios ({incidentesCriticos.length} comunidades en Nivel 3 y 4)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <span>{bandejaAbierta ? 'Ocultar Bandeja' : 'Desplegar Listado'}</span>
            {bandejaAbierta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Contenido Plegable con Paginación */}
        {bandejaAbierta && (
          <div className="border-t border-slate-800 animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Severidad</th>
                    <th className="py-3 px-3">Comunidad</th>
                    <th className="py-3 px-3">Municipio</th>
                    <th className="py-3 px-3">Saturación Suelo</th>
                    <th className="py-3 px-3">Relieve / Pendiente</th>
                    <th className="py-3 px-3">Acceso Vial</th>
                    <th className="py-3 px-3">Amenaza Activa</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {incidentesPaginados.map((item) => (
                    <tr 
                      key={item.localidad_id}
                      onClick={() => setComunidadFoco(item)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <span 
                          className="text-[10px] font-black px-2 py-0.5 rounded text-white shadow"
                          style={{ backgroundColor: item.color_alerta }}
                        >
                          Nivel {item.nivel_alerta}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-white">{item.nombre}</td>
                      <td className="py-2.5 px-3 text-slate-400">{item.municipio}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                        {item.impactoSistemico?.saturacionTotalSueloMm} mm
                      </td>
                      <td className="py-2.5 px-3">
                        {item.geografia?.relieve} ({item.geografia?.pendienteMax}°)
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          item.impactoSistemico?.accesoVial?.includes('TERRACERIA') || item.impactoSistemico?.accesoVial?.includes('BRECHA')
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'text-slate-400'
                        }`}>
                          {item.impactoSistemico?.accesoVial}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 truncate max-w-[200px]">
                        {item.diagnostico?.titulo}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setComunidadFoco(item);
                            setComunidadDetalle(item);
                          }}
                          className="text-[11px] font-bold text-amber-400 hover:text-white bg-slate-800 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 transition-all"
                        >
                          Auditar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Controles de Paginación */}
            <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                Mostrando <strong className="text-white">{(paginaActual - 1) * itemsPorPagina + 1}</strong> a <strong className="text-white">{Math.min(paginaActual * itemsPorPagina, incidentesCriticos.length)}</strong> de <strong className="text-white">{incidentesCriticos.length}</strong> incidentes
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={paginaActual === 1}
                  onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>

                <span className="font-mono text-slate-300 px-2 font-bold">
                  {paginaActual} / {totalPaginas}
                </span>

                <button
                  disabled={paginaActual === totalPaginas}
                  onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-300"
                >
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 4. MODAL DE AUDITORÍA PROFUNDA COMUNITARIA */}
      {comunidadDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div 
              className="p-4 border-b border-slate-800 flex justify-between items-start"
              style={{ backgroundColor: `${comunidadDetalle.color_alerta}20` }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span 
                    className="text-xs font-black px-2.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: comunidadDetalle.color_alerta }}
                  >
                    NIVEL {comunidadDetalle.nivel_alerta} • {comunidadDetalle.estado_alerta}
                  </span>
                  <span className="text-xs text-slate-400">Auditoría Diocesana de Campo</span>
                </div>
                <h2 className="text-xl font-black text-white">{comunidadDetalle.nombre}</h2>
                <p className="text-xs text-slate-300">{comunidadDetalle.municipio}, {comunidadDetalle.estado} • Cuenca: {comunidadDetalle.geografia?.cuenca}</p>
              </div>
              <button onClick={() => setComunidadDetalle(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Diagnóstico Físico</p>
                <p className="text-sm font-bold text-white">{comunidadDetalle.diagnostico?.titulo}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{comunidadDetalle.diagnostico?.causa}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pendiente Máx</span>
                  <span className="text-base font-bold text-white">{comunidadDetalle.geografia?.pendienteMax}°</span>
                  <span className="text-[10px] text-slate-400 block">{comunidadDetalle.geografia?.relieve}</span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Acceso Vial</span>
                  <span className="text-xs font-bold text-amber-300 block truncate">{comunidadDetalle.impactoSistemico?.accesoVial}</span>
                  <span className="text-[10px] text-slate-400 block">Riesgo corte</span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hospital Cercano</span>
                  <span className="text-base font-bold text-white">{comunidadDetalle.impactoSistemico?.distanciaHospitalKm} km</span>
                  <span className="text-[10px] text-slate-400 block">Vía terrestre</span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ventana Acción</span>
                  <span className="text-base font-bold text-emerald-400">{comunidadDetalle.tiempos?.ventanaAccionHoras} hrs</span>
                  <span className="text-[10px] text-slate-400 block">Tiempo concentración</span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                <p className="text-xs font-bold text-amber-300 italic">{comunidadDetalle.protocolo}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center text-xs">
              <span className="text-slate-400">Población directa: <strong className="text-white">{comunidadDetalle.impactoSistemico?.poblacionDirecta?.toLocaleString()}</strong> habitantes</span>
              <button onClick={() => setComunidadDetalle(null)} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL DE BITÁCORA DE SARA */}
      {modalBitacoraAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[85vh]">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <ScrollText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm md:text-base text-white">
                    Bitácora Auditable de Operaciones • Agente SARA
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Registro inmutable con Hash SHA-256 encadenado
                  </p>
                </div>
              </div>
              <button onClick={() => setModalBitacoraAbierto(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 font-mono text-xs">
              {bitacoraSARA.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p>Iniciando registro de auditoría en la primera corrida sinóptica...</p>
                </div>
              ) : (
                bitacoraSARA.map((entry) => (
                  <div key={entry.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-amber-400 font-bold">{entry.timestamp_local} ({entry.id})</span>
                      <span className="text-slate-400 text-[10px]">Hash: <strong className="text-emerald-400">{entry.hash}</strong></span>
                    </div>
                    <p className="text-white font-bold text-xs">{entry.titulo}</p>
                    <p className="text-slate-300 text-[11px] font-sans leading-relaxed">{entry.resumen}</p>
                    <div className="pt-1 border-t border-slate-900 text-[10px] text-slate-600 flex justify-between">
                      <span>Prev Hash: {entry.prev_hash}</span>
                      <span className="text-slate-500">Inmutable SHA-256</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500 px-4">
              <span>Trazabilidad garantizada para Cáritas Pastoral Social y Protección Civil.</span>
              <button onClick={() => setModalBitacoraAbierto(false)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}