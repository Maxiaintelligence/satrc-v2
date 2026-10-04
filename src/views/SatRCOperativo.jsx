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
  TrendingUp, 
  TrendingDown, 
  Minus,
  Download,
  Layers
} from 'lucide-react';

export default function SatRCOperativo({ alCerrarSesion }) {
  const todasLocalidades = db.localidades || [];

  // Estados del Cuarto de Situación
  const [killSwitchActivo, setKillSwitchActivo] = useState(false);
  const [cargandoEvaluacion, setCargandoEvaluacion] = useState(true);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [comunidadFoco, setComunidadFoco] = useState(null);

  // Filtro activo del Semáforo
  const [filtroSemaforo, setFiltroSemaforo] = useState('NIVEL4');
  const [bandejaAbierta, setBandejaAbierta] = useState(true);
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
      .then(d => { if (d?.exito && d?.alerta) setAlertaSMN(d.alerta); })
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

      const nodoSierra = todasLocalidades.find(l => l.nombre.toLowerCase().includes('huauchinango')) || todasLocalidades[0];
      if (!nodoSierra?.coords) {
        setCargandoEvaluacion(false);
        return;
      }

      const resMeteo = await consultarModelosDeterministas(nodoSierra.coords.lat, nodoSierra.coords.lon);

      if (cancelado) return;

      let serieConsenso = [];
      if (resMeteo?.exito && resMeteo?.datos_horarios) {
        serieConsenso = generarConsensoDeterminista(resMeteo.datos_horarios);
      }

      // Evaluación individualizada segura
      const resultados = todasLocalidades.map(loc => {
        try {
          return evaluarLocalidad(loc, serieConsenso, { alertaSMN: alertaSMN });
        } catch (e) {
          console.error("Error evaluando:", loc?.nombre, e);
          return null;
        }
      }).filter(Boolean);

      // Ordenar con protección contra nulos
      resultados.sort((a, b) => {
        const nivelA = a?.nivel_alerta ?? 1;
        const nivelB = b?.nivel_alerta ?? 1;
        if (nivelB !== nivelA) return nivelB - nivelA;

        const satA = a?.impactoSistemico?.saturacionTotalSueloMm ?? 0;
        const satB = b?.impactoSistemico?.saturacionTotalSueloMm ?? 0;
        return satB - satA;
      });

      if (!cancelado) {
        setEvaluaciones(resultados);
        setComunidadFoco(resultados[0] || null);
        setCargandoEvaluacion(false);

        // Llamar a SARA
        const n4 = resultados.filter(e => e?.nivel_alerta === 4).length;
        const n3 = resultados.filter(e => e?.nivel_alerta === 3).length;
        const n1 = resultados.filter(e => e?.nivel_alerta === 1).length;
        const criticas = resultados.filter(e => (e?.nivel_alerta ?? 1) >= 3).slice(0, 6).map(c => `${c?.nombre} (${c?.municipio})`);

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
            if (data?.exito && data?.dictamen) {
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

  // Conteos seguros
  const totalNivel4 = evaluaciones.filter(e => e?.nivel_alerta === 4).length;
  const totalNivel3 = evaluaciones.filter(e => e?.nivel_alerta === 3).length;
  const totalNivel2 = evaluaciones.filter(e => e?.nivel_alerta === 2).length;
  const totalNivel1 = evaluaciones.filter(e => e?.nivel_alerta === 1).length;

  // Filtrado Seguro del Semáforo
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

  // Cálculo Seguro de Tendencia
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

  const descargarBitacora = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bitacoraSARA, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bitacora_sara_caritas_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

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

      {/* Alerta Manual */}
      {alertaManualEmitida && (
        <div className="bg-rose-950/40 border-2 border-rose-500 p-4 rounded-2xl flex justify-between items-start gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-rose-500 text-white px-2 py-0.5 rounded">
                  AVISO DIOCESANO EMITIDO • NIVEL {alertaManualEmitida.nivel}
                </span>
                <span className="text-xs text-rose-300 font-semibold">{alertaManualEmitida.zona}</span>
                <span className="text-[11px] text-slate-400">• {alertaManualEmitida.timestamp}</span>
              </div>
              <p className="text-sm font-medium text-white mt-1.5">{alertaManualEmitida.mensaje}</p>
            </div>
          </div>
          <button onClick={() => setAlertaManualEmitida(null)} className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg">
            Retirar
          </button>
        </div>
      )}

      {/* Formulario Manual */}
      {modoManual && (
        <div className="bg-slate-900 border border-amber-500/50 p-5 rounded-2xl shadow-2xl space-y-3">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <Send className="w-4 h-4" /> Formulario de Comunicación de Crisis Cáritas
          </h3>
          <form onSubmit={emitirAlertaManual} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Zona Pastoral</label>
                <input
                  type="text"
                  value={zonaManual}
                  onChange={(e) => setZonaManual(e.target.value)}
                  placeholder="Sierra de Pahuatlán y Huauchinango"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Nivel de Gravedad</label>
                <select
                  value={nivelManual}
                  onChange={(e) => setNivelManual(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value={4} className="text-rose-400 font-bold">Nivel 4 — Emergencia Crítica (Rojo)</option>
                  <option value={3} className="text-orange-400 font-bold">Nivel 3 — Alerta Temprana (Naranja)</option>
                  <option value={2} className="text-amber-400 font-bold">Nivel 2 — Vigilancia Preventiva (Amarillo)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Instrucciones Operativas</label>
              <textarea
                rows={3}
                placeholder="Instrucciones para párrocos y brigadistas..."
                value={mensajeManual}
                onChange={(e) => setMensajeManual(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModoManual(false)} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg">
                Transmitir Aviso Oficial
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dictamen Sinóptico de SARA */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex items-start gap-3.5">
        <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl shrink-0 mt-0.5">
          <Bot className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                Informe de Situación • Agente SARA
              </span>
              {dictamenSARA?.color && (
                <span 
                  className="text-[10px] font-black px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: dictamenSARA.color }}
                >
                  {dictamenSARA.estado_situacion || "SITUACION_DIOCESANA"}
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

      {/* 2. SEMÁFORO INTERACTIVO CON BOTONES FILTRANTES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div 
          onClick={() => {
            setFiltroSemaforo('NIVEL4');
            setPaginaActual(1);
          }}
          className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${
            filtroSemaforo === 'NIVEL4'
              ? 'bg-rose-950/90 border-rose-500 scale-[1.02] shadow-rose-900/30'
              : 'bg-slate-900 border-rose-500/40 hover:border-rose-500'
          }`}
        >
          <div>
            <span className="text-xs font-black text-rose-400 uppercase flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" /> Emergencia (N4)
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Filtrar tabla</p>
          </div>
          <span className="text-2xl font-black text-rose-400">{totalNivel4}</span>
        </div>

        <div 
          onClick={() => {
            setFiltroSemaforo('NIVEL3');
            setPaginaActual(1);
          }}
          className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${
            filtroSemaforo === 'NIVEL3'
              ? 'bg-orange-950/90 border-orange-500 scale-[1.02] shadow-orange-900/30'
              : 'bg-slate-900 border-orange-500/40 hover:border-orange-500'
          }`}
        >
          <div>
            <span className="text-xs font-black text-orange-400 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Alerta Temprana (N3)
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Filtrar tabla</p>
          </div>
          <span className="text-2xl font-black text-orange-400">{totalNivel3}</span>
        </div>

        <div 
          onClick={() => {
            setFiltroSemaforo('NIVEL2');
            setPaginaActual(1);
          }}
          className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${
            filtroSemaforo === 'NIVEL2'
              ? 'bg-amber-950/90 border-amber-500 scale-[1.02]'
              : 'bg-slate-900 border-slate-800 hover:border-amber-500/60'
          }`}
        >
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase">Vigilancia (N2)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Filtrar tabla</p>
          </div>
          <span className="text-2xl font-bold text-amber-400">{totalNivel2}</span>
        </div>

        <div 
          onClick={() => {
            setFiltroSemaforo('NIVEL1');
            setPaginaActual(1);
          }}
          className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all shadow flex justify-between items-center ${
            filtroSemaforo === 'NIVEL1'
              ? 'bg-emerald-950/90 border-emerald-500 scale-[1.02]'
              : 'bg-slate-900 border-slate-800 hover:border-emerald-500/60'
          }`}
        >
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase">Estables (N1)</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Altiplano en paz</p>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{totalNivel1}</span>
        </div>
      </div>

      {/* 3. DÚO TÁCTICO: MAPA Y SATÉLITE */}
      <div className="space-y-6">
        <RiskMap 
          evaluaciones={evaluaciones}
          localidadFoco={comunidadFoco}
          alSeleccionarLocalidad={(item) => {
            setComunidadFoco(item);
            setComunidadDetalle(item);
          }}
        />

        <SatelliteViewer />
      </div>

      {/* 4. BANDEJA DE COMUNIDADES CON COLUMNA DE EVOLUCIÓN / TENDENCIA Y PAGINACIÓN */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <button
          onClick={() => setBandejaAbierta(!bandejaAbierta)}
          className="w-full p-4 bg-slate-800/90 hover:bg-slate-800 flex justify-between items-center transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Listado de Comunidades en: <strong className="text-amber-300">{filtroSemaforo}</strong> ({comunidadesFiltradas.length} encontradas)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <span>{bandejaAbierta ? 'Ocultar Listado' : 'Desplegar Listado'}</span>
            {bandejaAbierta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {bandejaAbierta && (
          <div className="border-t border-slate-800 animate-fade-in">
            {cargandoEvaluacion ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs">Sincronizando comunidades diocesanas...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Severidad</th>
                        <th className="py-3 px-3">Evolución</th>
                        <th className="py-3 px-3">Comunidad</th>
                        <th className="py-3 px-3">Municipio</th>
                        <th className="py-3 px-3">Saturación Suelo</th>
                        <th className="py-3 px-3">Relieve / Pendiente</th>
                        <th className="py-3 px-3">Acceso Vial</th>
                        <th className="py-3 px-3">Diagnóstico Físico</th>
                        <th className="py-3 px-4 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {itemsPaginados.map((item) => {
                        const tendencia = obtenerTendencia(item);
                        const IconoTendencia = tendencia.icono;

                        return (
                          <tr 
                            key={item?.localidad_id || Math.random()}
                            onClick={() => setComunidadFoco(item)}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-4">
                              <span 
                                className="text-[10px] font-black px-2 py-0.5 rounded text-white shadow"
                                style={{ backgroundColor: item?.color_alerta || '#10B981' }}
                              >
                                Nivel {item?.nivel_alerta || 1}
                              </span>
                            </td>

                            <td className="py-2.5 px-3">
                              <span className={`flex items-center gap-1 font-bold text-[10px] ${tendencia.color}`}>
                                <IconoTendencia className="w-3.5 h-3.5" />
                                {tendencia.texto}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 font-extrabold text-white">{item?.nombre}</td>
                            <td className="py-2.5 px-3 text-slate-400">{item?.municipio}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                              {item?.impactoSistemico?.saturacionTotalSueloMm ?? 0} mm
                            </td>
                            <td className="py-2.5 px-3">
                              {item?.geografia?.relieve || 'MESETA'} ({item?.geografia?.pendienteMax ?? 0}°)
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                item?.impactoSistemico?.accesoVial?.includes('TERRACERIA') || item?.impactoSistemico?.accesoVial?.includes('BRECHA')
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'text-slate-400'
                              }`}>
                                {item?.impactoSistemico?.accesoVial || 'PAVIMENTADO'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-200 truncate max-w-[200px]">
                              {item?.diagnostico?.titulo || 'Normal'}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Controles de Paginación */}
                <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">
                    Mostrando <strong className="text-white">{(paginaActual - 1) * itemsPorPagina + 1}</strong> a <strong className="text-white">{Math.min(paginaActual * itemsPorPagina, comunidadesFiltradas.length)}</strong> de <strong className="text-white">{comunidadesFiltradas.length}</strong>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* 5. MODAL DE AUDITORÍA PROFUNDA */}
      {comunidadDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div 
              className="p-4 border-b border-slate-800 flex justify-between items-start"
              style={{ backgroundColor: `${comunidadDetalle?.color_alerta || '#10B981'}20` }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span 
                    className="text-xs font-black px-2.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: comunidadDetalle?.color_alerta || '#10B981' }}
                  >
                    NIVEL {comunidadDetalle?.nivel_alerta || 1} • {comunidadDetalle?.estado_alerta || 'NORMAL'}
                  </span>
                  <span className="text-xs text-slate-400">Auditoría Diocesana de Campo</span>
                </div>
                <h2 className="text-xl font-black text-white">{comunidadDetalle?.nombre}</h2>
                <p className="text-xs text-slate-300">{comunidadDetalle?.municipio}, {comunidadDetalle?.estado} • Cuenca: {comunidadDetalle?.geografia?.cuenca || 'Cuenca Regional'}</p>
              </div>
              <button onClick={() => setComunidadDetalle(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Diagnóstico Físico</p>
                <p className="text-sm font-bold text-white">{comunidadDetalle?.diagnostico?.titulo}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{comunidadDetalle?.diagnostico?.causa}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pendiente Máx</span>
                  <span className="text-base font-bold text-white">{comunidadDetalle?.geografia?.pendienteMax ?? 0}°</span>
                  <span className="text-[10px] text-slate-400 block">{comunidadDetalle?.geografia?.relieve}</span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Acceso Vial</span>
                  <span className="text-xs font-bold text-amber-300 block truncate">{comunidadDetalle?.impactoSistemico?.accesoVial}</span>
                  <span className="text-[10px] text-slate-400 block">Riesgo corte</span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hospital Cercano</span>
                  <span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.distanciaHospitalKm ?? 0} km</span>
                  <span className="text-[10px] text-slate-400 block">Vía terrestre</span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ventana Acción</span>
                  <span className="text-base font-bold text-emerald-400">{comunidadDetalle?.tiempos?.ventanaAccionHoras ?? 6} hrs</span>
                  <span className="text-[10px] text-slate-400 block">Tiempo concentración</span>
                </div>
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

      {/* 6. MODAL DE BITÁCORA PERMANENTE DE SARA */}
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
                    Almacén permanente en Vercel Blob • Hash SHA-256 encadenado
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={descargarBitacora}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-amber-300 rounded-lg text-xs font-bold transition-colors"
                  title="Descargar historial forense"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar Historial
                </button>

                <button onClick={() => setModalBitacoraAbierto(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
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
              <span>Preservación permanente en Vercel Blob • Inmune a redeploys.</span>
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