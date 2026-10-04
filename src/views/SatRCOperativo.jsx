import React, { useState, useEffect } from 'react';
import db from '../data/localidades.json';
import { consultarModelosDeterministas } from '../engine/meteoFetcher.js';
import { generarConsensoDeterminista } from '../engine/consensusEngine.js';
import { evaluarLocalidad } from '../engine/riskEvaluator.js';
import RiskMap from '../components/RiskMap.jsx';
import SatelliteViewer from '../components/SatelliteViewer.jsx';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Power, 
  Radio, 
  Send, 
  Layers, 
  Users, 
  Clock, 
  MapPin, 
  FileText, 
  X,
  ArrowRight,
  Building2,
  Filter,
  CheckCircle2,
  AlertOctagon,
  Mountain,
  Waves,
  Truck,
  Bot,
  ScrollText,
  Hash,
  ShieldCheck
} from 'lucide-react';

export default function SatRCOperativo({ alCerrarSesion }) {
  const todasLocalidades = db.localidades;

  // Estados del Cuarto de Situación
  const [killSwitchActivo, setKillSwitchActivo] = useState(false);
  const [cargandoEvaluacion, setCargandoEvaluacion] = useState(true);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [comunidadFoco, setComunidadFoco] = useState(null);
  const [filtroCrisis, setFiltroCrisis] = useState('CRISIS');

  // Estados de SARA
  const [dictamenSARA, setDictamenSARA] = useState(null);
  const [bitacoraSARA, setBitacoraSARA] = useState([]);
  const [modalBitacoraAbierto, setModalBitacoraAbierto] = useState(false);
  const [cargandoSARA, setCargandoSARA] = useState(true);

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

  // 2. Ejecutar Escaneo Geofísico de las 405 Comunidades
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

      // Evaluación individual objetiva
      const resultados = todasLocalidades.map(loc => {
        return evaluarLocalidad(loc, serieConsenso, {
          alertaSMN: alertaSMN,
          lluvia_cabecera_mm: alertaSMN ? 85.0 : 45.0
        });
      });

      resultados.sort((a, b) => {
        if (b.nivel_alerta !== a.nivel_alerta) return b.nivel_alerta - a.nivel_alerta;
        return b.impactoSistemico.saturacionTotalSueloMm - a.impactoSistemico.saturacionTotalSueloMm;
      });

      if (!cancelado) {
        setEvaluaciones(resultados);
        setComunidadFoco(resultados[0] || null);
        setCargandoEvaluacion(false);

        // 3. Consultar a SARA (Groq Llama-3.3) con los resultados para generar el Dictamen de Crisis
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
            if (data.exito) {
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

  const comunidadesFiltradas = evaluaciones.filter(item => {
    if (filtroCrisis === 'CRISIS') return item.nivel_alerta >= 3;
    if (filtroCrisis === 'NIVEL4') return item.nivel_alerta === 4;
    return true;
  });

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
      
      {/* 1. BARRA SUPERIOR DE MANDO DIOCESANO */}
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

        {/* Acciones de la Mesa de Crisis */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Bitácora Auditable */}
          <button
            onClick={() => setModalBitacoraAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs border border-amber-500/30 transition-all shadow"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-400" />
            Bitácora de SARA ({bitacoraSARA.length})
          </button>

          {/* Kill Switch */}
          <button
            onClick={() => setKillSwitchActivo(!killSwitchActivo)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              killSwitchActivo
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {killSwitchActivo ? 'Reanudar Automático' : 'Paro General'}
          </button>

          {/* Emisión Pastoral */}
          <button
            onClick={() => setModoManual(!modoManual)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow"
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

      {/* 2. INFORME DE SITUACIÓN OFICIAL DE SARA (EL CEREBRO DEL CUARTO) */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-black text-sm md:text-base text-white flex items-center gap-2">
                Informe de Situación • Agente SARA
                {dictamenSARA && (
                  <span 
                    className="text-[10px] font-black px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: dictamenSARA.color }}
                  >
                    {dictamenSARA.estado_situacion}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Oficial Meteoróloga de Guardia • Groq Llama-3.3-70B • Ciclo de 3 Horas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Última corrida: <strong className="text-white">{dictamenSARA?.hora_evaluacion || '--:--'}</strong></span>
            <span>•</span>
            <span>Próxima: <strong className="text-slate-300">{dictamenSARA?.proxima_evaluacion || '--:--'}</strong></span>
          </div>
        </div>

        {cargandoSARA ? (
          <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span>SARA analizando consistencia orográfica y memoria de saturación...</span>
          </div>
        ) : (
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-1.5">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              {dictamenSARA?.titulo || "Dictamen de Guardia"}
            </p>
            <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-normal">
              {dictamenSARA?.comentario_oficial}
            </p>
          </div>
        )}
      </div>

      {/* 3. SEMÁFORO EJECUTIVO DE LAS 405 COMUNIDADES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div 
          onClick={() => setFiltroCrisis('NIVEL4')}
          className={`cursor-pointer p-4 rounded-2xl border-2 transition-all shadow-lg ${
            filtroCrisis === 'NIVEL4' ? 'bg-rose-950/80 border-rose-500 scale-[1.02]' : 'bg-slate-900 border-slate-800 hover:border-rose-500/50'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4" /> Emergencia (N4)
            </span>
            <span className="text-2xl font-black text-rose-400">{totalNivel4}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Laderas al límite o desbordamiento inminente</p>
        </div>

        <div 
          onClick={() => setFiltroCrisis('CRISIS')}
          className={`cursor-pointer p-4 rounded-2xl border-2 transition-all shadow-lg ${
            filtroCrisis === 'CRISIS' ? 'bg-orange-950/70 border-orange-500 scale-[1.02]' : 'bg-slate-900 border-slate-800 hover:border-orange-500/50'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Alerta Temprana (N3)
            </span>
            <span className="text-2xl font-black text-orange-400">{totalNivel3}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Lluvia continua sobre laderas y caminos</p>
        </div>

        <div onClick={() => setFiltroCrisis('TODOS')} className="cursor-pointer p-4 rounded-2xl border-2 bg-slate-900 border-slate-800 hover:border-amber-500/40">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Vigilancia (N2)</span>
            <span className="text-2xl font-bold text-amber-400">{totalNivel2}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Precipitación activa sin peligro geofísico</p>
        </div>

        <div onClick={() => setFiltroCrisis('TODOS')} className="cursor-pointer p-4 rounded-2xl border-2 bg-slate-900 border-slate-800 hover:border-emerald-500/40">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Estables (N1)</span>
            <span className="text-2xl font-bold text-emerald-400">{totalNivel1}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Normalidad atmosférica (Altiplano y valles)</p>
        </div>
      </div>

      {/* 4. FICHA EJECUTIVA DE LA COMUNIDAD EN FOCO */}
      {comunidadFoco && (
        <div 
          className="bg-slate-900 border-2 rounded-2xl shadow-2xl overflow-hidden transition-all"
          style={{ borderColor: comunidadFoco.color_alerta }}
        >
          <div 
            className="p-4 flex flex-wrap justify-between items-center gap-3"
            style={{ backgroundColor: `${comunidadFoco.color_alerta}20` }}
          >
            <div className="flex items-center gap-2.5">
              <span 
                className="text-xs font-black px-2.5 py-1 rounded-lg text-white shadow"
                style={{ backgroundColor: comunidadFoco.color_alerta }}
              >
                NIVEL {comunidadFoco.nivel_alerta} • {comunidadFoco.estado_alerta}
              </span>
              <div>
                <h3 className="text-lg font-black text-white">
                  {comunidadFoco.nombre}, {comunidadFoco.municipio} ({comunidadFoco.estado})
                </h3>
                <p className="text-xs text-slate-300 font-semibold mt-0.5">
                  {comunidadFoco.diagnostico?.titulo}
                </p>
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="font-mono text-slate-300 font-bold block">
                Cuenca: {comunidadFoco.geografia?.cuenca || comunidadFoco.donde?.subcuenca_nom}
              </span>
              <span className="text-[11px] text-amber-300 font-semibold italic">
                {comunidadFoco.protocolo}
              </span>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5" /> Dinámica del Terreno
              </span>
              <p className="text-slate-200 text-[11px] leading-relaxed">
                {comunidadFoco.diagnostico?.causa}
              </p>
              <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>Relieve: <strong className="text-white">{comunidadFoco.geografia?.relieve}</strong></span>
                <span>Pendiente: <strong className="text-rose-400">{comunidadFoco.geografia?.pendienteMax}°</strong></span>
              </div>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block flex items-center gap-1">
                <Waves className="w-3.5 h-3.5" /> Memoria Hídrica
              </span>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Previa (7 días):</span>
                  <span className="font-mono font-bold text-white">{comunidadFoco.impactoSistemico?.apiPrevio7DiasMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Evento Actual:</span>
                  <span className="font-mono font-bold text-amber-300">{comunidadFoco.impactoSistemico?.lluviaEvento24hMm} mm</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800 text-xs">
                  <span className="text-slate-300 font-bold">Saturación Total:</span>
                  <span className="font-mono font-black text-rose-400">{comunidadFoco.impactoSistemico?.saturacionTotalSueloMm} mm</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                Umbral falla talud: {comunidadFoco.impactoSistemico?.umbralFisicoDeslaveMm} mm
              </p>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Cronograma Operativo
              </span>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Inicio:</span>
                  <span className="font-mono text-slate-200">{comunidadFoco.tiempos?.inicio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pico:</span>
                  <span className="font-mono text-slate-200">{comunidadFoco.tiempos?.picoMaximo}</span>
                </div>
                <div className="pt-1 border-t border-slate-800">
                  <span className="text-[10px] text-amber-400 uppercase block font-bold">Ventana de Acción</span>
                  <span className="text-sm font-extrabold text-white">
                    {comunidadFoco.tiempos?.ventanaAccionHoras} horas antes de la cresta
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Aislamiento y Logística
              </span>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Población directa:</span>
                  <span className="font-extrabold text-white">{comunidadFoco.impactoSistemico?.poblacionDirecta?.toLocaleString()} hab.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Acceso vial:</span>
                  <span className="font-bold text-amber-300 truncate max-w-[120px]">{comunidadFoco.impactoSistemico?.accesoVial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hospital cercano:</span>
                  <span className="font-mono text-slate-200">{comunidadFoco.impactoSistemico?.distanciaHospitalKm} km</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Marginación social:</span>
                  <span className="font-bold text-slate-300">{comunidadFoco.impactoSistemico?.marginacion}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. BANDEJA DISCRIMINANTE DE INCIDENTES CRÍTICOS */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">
              Bandeja de Incidentes Críticos ({comunidadesFiltradas.length} encontradas)
            </h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFiltroCrisis('CRISIS')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filtroCrisis === 'CRISIS' ? 'bg-orange-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Comunidades en Peligro (N3 y N4)
            </button>
            <button
              onClick={() => setFiltroCrisis('NIVEL4')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filtroCrisis === 'NIVEL4' ? 'bg-rose-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Solo Emergencias (Nivel 4)
            </button>
            <button
              onClick={() => setFiltroCrisis('TODOS')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filtroCrisis === 'TODOS' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Censo Diocesano (405)
            </button>
          </div>
        </div>

        {cargandoEvaluacion ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-mono">Ejecutando escaneo geofísico de laderas y cuencas...</p>
          </div>
        ) : (
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
                  <th className="py-3 px-3">Diagnóstico</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {comunidadesFiltradas.slice(0, 30).map((item) => {
                  const esFoco = comunidadFoco?.localidad_id === item.localidad_id;
                  return (
                    <tr 
                      key={item.localidad_id}
                      onClick={() => setComunidadFoco(item)}
                      className={`cursor-pointer transition-colors ${
                        esFoco ? 'bg-slate-800/80 border-l-4 border-rose-500' : 'hover:bg-slate-800/40'
                      }`}
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
                          }}
                          className="text-[11px] font-bold text-amber-400 hover:text-white bg-slate-800 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 transition-all"
                        >
                          Enfocar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. MAPA TÁCTICO */}
      <RiskMap 
        evaluaciones={comunidadesFiltradas}
        localidadFoco={comunidadFoco}
        alSeleccionarLocalidad={(item) => setComunidadFoco(item)}
      />

      {/* 7. VISOR SATELITAL AL FINAL */}
      <div className="pt-2">
        <SatelliteViewer />
      </div>

      {/* ========================================================== */}
      {/* 8. MODAL DE BITÁCORA AUDITABLE DE SARA (R3 CON HASH SHA-256) */}
      {/* ========================================================== */}
      {modalBitacoraAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[85vh]">
            
            {/* Cabecera Bitácora */}
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <ScrollText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm md:text-base text-white">
                    Bitácora Auditable de Operaciones • Agente SARA
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Registro inmutable con Hash SHA-256 encadenado • Artículo 5, Regla 3
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalBitacoraAbierto(false)}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de Entradas Auditables */}
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

            {/* Pie Bitácora */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500 px-4">
              <span>Cadena de bloques criptográfica interna de Cáritas Tulancingo.</span>
              <button
                onClick={() => setModalBitacoraAbierto(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}