import React, { useState, useEffect, useRef } from 'react';
import db from '../data/localidades.json';
import { consultarModelosDeterministas } from '../engine/meteoFetcher.js';
import { generarConsensoDeterminista } from '../engine/consensusEngine.js';
import SatelliteViewer from '../components/SatelliteViewer.jsx';
import DisclaimerModal from '../components/DisclaimerModal.jsx';
import ReporteModalPublico from '../components/ReporteModalPublico.jsx';
import { formatearTimestamp } from '../lib/compartido/fechas.js';
import { generarPronosticoComunitario } from '../lib/compartido/textoComunitario.js';
import {
  CloudRain,
  Thermometer,
  Wind,
  MapPin,
  ShieldCheck,
  Calendar,
  Info,
  Building2,
  Bot,
  Clock,
  RotateCw,
  ChevronRight
} from 'lucide-react';

const INTERVALO_REFRESCO_MS = 30 * 60 * 1000;

export default function MonitorPublico() {
  const listaZonas = Object.values(db.indices.zonas);

  const [zonaActiva, setZonaActiva] = useState(listaZonas[0] || null);
  const [evaluacionLocal, setEvaluacionLocal] = useState(null);
  const [dictamenGlobal, setDictamenGlobal] = useState(null);
  const [municipioActivo, setMunicipioActivo] = useState('');
  const [localidadActiva, setLocalidadActiva] = useState(null);
  const [reporteVigente, setReporteVigente] = useState(null);
  
  const [modalReportePublicoAbierto, setModalReportePublicoAbierto] = useState(false);
  const [modalUbicacionAbierto, setModalUbicacionAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [datosConsenso, setDatosConsenso] = useState([]);
  const [pestanaActiva, setPestanaActiva] = useState('hoy');
  const [mostrarDisclaimer, setMostrarDisclaimer] = useState(false);

  const [ultimaConsulta, setUltimaConsulta] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const listaMunicipios = zonaActiva ? Object.keys(zonaActiva.municipios || {}) : [];

  const localidadRef = useRef(null);
  useEffect(() => {
    localidadRef.current = localidadActiva;
  }, [localidadActiva]);

  useEffect(() => {
    if (zonaActiva && listaMunicipios.length > 0) {
      const primerMun = listaMunicipios[0];
      setMunicipioActivo(primerMun);
      const idsComunidades = zonaActiva.municipios[primerMun] || [];
      if (idsComunidades.length > 0) {
        const primerPueblo = db.localidades.find(l => l.id === idsComunidades[0]);
        setLocalidadActiva(primerPueblo || null);
      }
    }
  }, [zonaActiva]);

  // N28 / H6.6 — Cargar el reporte vigente y la evaluación de la localidad
  useEffect(() => {
    let cancelado = false;
    async function cargarEstadoSara() {
      try {
        const res = await fetch(`/api/sara?t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (!cancelado) {
          if (data.ultimo_reporte_ondemand) setReporteVigente(data.ultimo_reporte_ondemand);
          if (data.dictamen) setDictamenGlobal(data.dictamen);

          if (localidadActiva && data.evaluaciones) {
            const evaluacionEncontrada = data.evaluaciones.find(
              (ev) => ev.localidad_id === localidadActiva.id
            );
            setEvaluacionLocal(evaluacionEncontrada || null);
          } else {
            setEvaluacionLocal(null);
          }
        }
      } catch (e) {
        console.warn("[SARA] No se pudo cargar el estado en vivo:", e.message);
      }
    }
    cargarEstadoSara();
    const intervalo = setInterval(cargarEstadoSara, INTERVALO_REFRESCO_MS);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, [localidadActiva]); 

  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City', day: '2-digit', month: 'long', year: 'numeric'
  });
  const reporteEsDeHoy = reporteVigente && reporteVigente.fecha_dia_mexico === fechaHoy;
  const reporteMostrable = reporteEsDeHoy && !reporteVigente.es_parcial;

  const manejarCambioMunicipio = (e) => {
    const munSeleccionado = e.target.value;
    setMunicipioActivo(munSeleccionado);
    const idsComunidades = zonaActiva?.municipios[munSeleccionado] || [];
    if (idsComunidades.length > 0) {
      const primerPueblo = db.localidades.find(l => l.id === idsComunidades[0]);
      setLocalidadActiva(primerPueblo || null);
    }
  };

  const manejarCambioZona = (e) => {
    const nuevaZona = listaZonas.find(z => z.id === e.target.value);
    setZonaActiva(nuevaZona);
  };

  const manejarCambioLocalidad = (e) => {
    const loc = db.localidades.find(l => l.id === e.target.value);
    if (loc) setLocalidadActiva(loc);
  };

  const cargarPronostico = async (localidad, silencioso = false) => {
    if (!localidad) return;
    if (!silencioso) setCargando(true);
    if (silencioso) setRefrescando(true);

    try {
      const res = await consultarModelosDeterministas(localidad.coords.lat, localidad.coords.lon);
      if (res.exito) {
        const serie = generarConsensoDeterminista(res.datos_horarios);
        setDatosConsenso(serie);
        setUltimaConsulta(new Date().toISOString());
      }
    } catch (e) {
      console.warn("Fallo consultando Open-Meteo en MonitorPublico:", e.message);
    }

    if (!silencioso) setCargando(false);
    if (silencioso) setRefrescando(false);
  };

  useEffect(() => {
    if (localidadActiva) {
      cargarPronostico(localidadActiva, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localidadActiva]);

  // Lógica de auto-refresco
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible' && localidadRef.current) {
        cargarPronostico(localidadRef.current, true);
      }
    }, INTERVALO_REFRESCO_MS);

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible' && localidadRef.current) {
        cargarPronostico(localidadRef.current, true);
      }
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const obtenerHorasPestana = () => {
    if (!datosConsenso || datosConsenso.length < 240) return [];
    if (pestanaActiva === 'hoy') return datosConsenso.slice(168, 192);
    if (pestanaActiva === 'manana') return datosConsenso.slice(192, 216);
    return datosConsenso.slice(216, 240);
  };

  const horasMostradas = obtenerHorasPestana();
  const lluviaTotalDia = horasMostradas.reduce((acc, h) => acc + h.lluvia_mm, 0).toFixed(1);
  const tempMaxDia = horasMostradas.length > 0 ? Math.max(...horasMostradas.map(h => h.temperatura_c)).toFixed(1) : '--';
  const tempMinDia = horasMostradas.length > 0 ? Math.min(...horasMostradas.map(h => h.temperatura_c)).toFixed(1) : '--';
  const vientoMaxDia = horasMostradas.length > 0 ? Math.max(...horasMostradas.map(h => h.rafagas_kmh)).toFixed(1) : '--';

  const textoUltimaConsulta = formatearTimestamp(ultimaConsulta);
  const nivelAlerta = evaluacionLocal ? evaluacionLocal.nivel_alerta : (dictamenGlobal?.estado_situacion === 'SITUACION_CRITICA' ? 4 : 1);

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      <DisclaimerModal abierto={mostrarDisclaimer} alCerrar={() => setMostrarDisclaimer(false)} />
      <ReporteModalPublico abierto={modalReportePublicoAbierto} alCerrar={() => setModalReportePublicoAbierto(false)} reporteVigente={reporteVigente} />

      {/* 0. BARRA DE ESTADO (CON REFRESCO) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Monitor público · Datos en vivo</span>
        </div>
        <div className="flex items-center gap-2">
          {textoUltimaConsulta && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-900 text-amber-300 border-amber-500/30 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Actualizado: {textoUltimaConsulta}
            </span>
          )}
          <button
            onClick={() => localidadActiva && cargarPronostico(localidadActiva, true)}
            disabled={refrescando || !localidadActiva}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-all"
          >
            <RotateCw className={`w-3 h-3 ${refrescando ? 'animate-spin' : ''}`} />
            <span>{refrescando ? 'Refrescando...' : 'Refrescar'}</span>
          </button>
        </div>
      </div>

      {/* 1. Tarjeta de Ubicación Compacta */}
      <div 
        onClick={() => setModalUbicacionAbierto(true)}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-slate-600 transition-colors shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ubicación</p>
            <h2 className="text-lg font-black text-white leading-tight">{localidadActiva?.nombre || 'Seleccione'}</h2>
            <p className="text-xs text-slate-400">{localidadActiva?.municipio}, {localidadActiva?.estado}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
          Cambiar <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* 2. Alertas */}
      <div className="space-y-3">
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex gap-3 items-start">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">CONAGUA / SMN</span>
              <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-bold">Nivel {nivelAlerta}</span>
            </div>
            <h3 className="text-sm font-bold text-white">Sin aviso extraordinario</h3>
            <p className="text-xs text-slate-300 mt-1">Condiciones normales en el estado de Hidalgo.</p>
          </div>
        </div>

        <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-4 flex gap-3 items-start">
          <Bot className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">SARA · Orientación Comunitaria</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {cargando ? 'Generando recomendaciones...' : generarPronosticoComunitario(localidadActiva, evaluacionLocal, datosConsenso, null, pestanaActiva)}
            </p>
            {reporteMostrable && reporteVigente.reporte?.seccion_0_decision && (
              <button onClick={() => setModalReportePublicoAbierto(true)} className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 mt-2">
                Ver decisión operativa completa <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Selector Temporal */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 shadow-inner">
        <button onClick={() => setPestanaActiva('hoy')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${pestanaActiva === 'hoy' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>Hoy</button>
        <button onClick={() => setPestanaActiva('manana')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${pestanaActiva === 'manana' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>Mañana</button>
        <button onClick={() => setPestanaActiva('pasado')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${pestanaActiva === 'pasado' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}>Pasado Mañana</button>
      </div>

      {/* 4. Métricas Rápidas */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-lg">
          <CloudRain className="w-5 h-5 text-blue-400 mb-1" />
          <span className="text-[9px] text-slate-400 uppercase font-bold">Lluvia</span>
          <span className="text-base font-black text-white">{lluviaTotalDia} mm</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-lg">
          <Thermometer className="w-5 h-5 text-amber-400 mb-1" />
          <span className="text-[9px] text-slate-400 uppercase font-bold">Temp</span>
          <span className="text-base font-black text-white">{tempMaxDia}° / {tempMinDia}°</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-lg">
          <Wind className="w-5 h-5 text-cyan-400 mb-1" />
          <span className="text-[9px] text-slate-400 uppercase font-bold">Ráfaga</span>
          <span className="text-base font-black text-white">{vientoMaxDia} km/h</span>
        </div>
      </div>

      {/* 5. Satélite Protagónico */}
      <div className="mt-6">
        <SatelliteViewer />
      </div>

      {/* Footer Deslinde */}
      <div className="pt-4 flex justify-center pb-8">
        <button onClick={() => setMostrarDisclaimer(true)} className="text-[11px] font-bold text-slate-500 hover:text-amber-400 flex items-center gap-1.5 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800 transition-colors">
          <Info className="w-3.5 h-3.5" /> Deslinde Institucional
        </button>
      </div>

      {/* Modal de Ubicación */}
      {modalUbicacionAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 max-w-sm w-full rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-white">Seleccionar Ubicación</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">Zona</label>
                <select value={zonaActiva?.id || ''} onChange={manejarCambioZona} className="w-full bg-slate-800 text-white text-sm rounded-xl p-3 border border-slate-700 focus:border-amber-500 outline-none">
                  {listaZonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">Municipio</label>
                <select value={municipioActivo} onChange={manejarCambioMunicipio} className="w-full bg-slate-800 text-white text-sm rounded-xl p-3 border border-slate-700 focus:border-emerald-500 outline-none">
                  {listaMunicipios.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block mb-1">Localidad</label>
                <select value={localidadActiva?.id || ''} onChange={manejarCambioLocalidad} className="w-full bg-slate-800 text-white text-sm rounded-xl p-3 border border-slate-700 focus:border-slate-400 outline-none">
                  {municipioActivo && zonaActiva?.municipios[municipioActivo]?.map(id => {
                    const loc = db.localidades.find(l => l.id === id);
                    return loc ? <option key={loc.id} value={loc.id}>{loc.nombre}</option> : null;
                  })}
                </select>
              </div>
            </div>

            <button onClick={() => setModalUbicacionAbierto(false)} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl transition-colors shadow-lg mt-2">
              Confirmar y Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}