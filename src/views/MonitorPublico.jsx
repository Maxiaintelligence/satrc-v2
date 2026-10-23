import React, { useState, useEffect, useRef } from 'react';
import db from '../data/localidades.json';
import { consultarModelosDeterministas } from '../engine/meteoFetcher.js';
import { generarConsensoDeterminista } from '../engine/consensusEngine.js';
import SatelliteViewer from '../components/SatelliteViewer.jsx';
import DisclaimerModal from '../components/DisclaimerModal.jsx';
import ReporteModalPublico from '../components/ReporteModalPublico.jsx';
import VectorBar from '../components/VectorBar.jsx'; // 👈 NUEVO (H6.6)
import { formatearTimestamp } from '../lib/compartido/fechas.js';
import {
  CloudRain,
  Thermometer,
  Wind,
  MapPin,
  ShieldCheck,
  Calendar,
  Info,
  Droplets,
  TrendingUp,
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

  // N28 / H6.6 — Cargar el reporte vigente y la evaluación de la localidad en una sola llamada
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

          // Buscar la evaluación específica de la localidad seleccionada
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

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [localidadActiva]); // Se vuelve a ejecutar si el usuario cambia de localidad

  // Determinar si el reporte vigente es de hoy y NO es parcial
  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
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

  // CAMBIO 5 — Geometría adaptativa para móvil
  const anchoGrafica = 500;
  const altoGrafica = 240;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 40;
  const padBottom = 50;

  const coordX = (i) => padLeft + (i / 23) * (anchoGrafica - padLeft - padRight);

  const temps = horasMostradas.flatMap(h => [
    h.detalle_modelos?.temp?.ecmwf ?? h.temperatura_c,
    h.detalle_modelos?.temp?.gfs ?? h.temperatura_c,
    h.detalle_modelos?.temp?.icon ?? h.temperatura_c
  ]);
  const minT = temps.length ? Math.floor(Math.min(...temps) - 1) : 10;
  const maxT = temps.length ? Math.ceil(Math.max(...temps) + 1) : 30;
  const coordYTemp = (t) => altoGrafica - padBottom - ((t - minT) / Math.max(1, maxT - minT)) * (altoGrafica - padTop - padBottom);

  const crearRutaLinea = (clave) => {
    if (!horasMostradas.length) return '';
    return horasMostradas.map((h, i) => {
      const v = h.detalle_modelos?.temp?.[clave] ?? h.temperatura_c;
      return `${i === 0 ? 'M' : 'L'} ${coordX(i)} ${coordYTemp(v)}`;
    }).join(' ');
  };

  const maxLl = Math.max(2, ...horasMostradas.map(h => h.lluvia_mm));
  const escalaYBarra = (mm) => ((mm / maxLl) * (altoGrafica - padTop - padBottom));

  const maxV = Math.max(15, ...horasMostradas.map(h => Math.max(h.viento_kmh, h.rafagas_kmh)));
  const coordYV = (v) => altoGrafica - padBottom - (v / maxV) * (altoGrafica - padTop - padBottom);

  const esHoraReferencia = (i) => i % 4 === 0 || i === 23;

  const textoUltimaConsulta = formatearTimestamp(ultimaConsulta);

  return (
    <div className="space-y-6">
      <DisclaimerModal abierto={mostrarDisclaimer} alCerrar={() => setMostrarDisclaimer(false)} />

      {/* ========================================================== */}
      {/* 0.bis. BLOQUE DE DECISIÓN OPERATIVA DEL DÍA                 */}
      {/* ========================================================== */}
      {reporteMostrable && reporteVigente.reporte?.seccion_0_decision && (
        <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-4 md:p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider">
                  Decisión Operativa del Día
                </span>
                <span className="text-[10px] text-slate-400">
                  {reporteVigente.fecha_dia_mexico} • {reporteVigente.hora_exacta_mexico} hrs
                </span>
              </div>
              <p className="text-sm md:text-base font-bold text-white leading-snug">
                {reporteVigente.reporte.seccion_0_decision}
              </p>
              <button
                onClick={() => setModalReportePublicoAbierto(true)}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-all"
              >
                Ver reporte completo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 0. BARRA DE ESTADO — N9-Public                              */}
      {/* ========================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Monitor público de consulta · Datos en vivo desde Open-Meteo</span>
        </div>
        <div className="flex items-center gap-2">
          {textoUltimaConsulta && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-slate-900 text-amber-300 border-amber-500/30 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Actualizado: {textoUltimaConsulta}
            </span>
          )}
          <button
            onClick={() => localidadActiva && cargarPronostico(localidadActiva, true)}
            disabled={refrescando || !localidadActiva}
            title="Refrescar datos meteorológicos"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-all"
          >
            <RotateCw className={`w-3 h-3 ${refrescando ? 'animate-spin' : ''}`} />
            <span>{refrescando ? 'Refrescando...' : 'Refrescar'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. SELECTOR EN CASCADA DE 3 NIVELES                        */}
      {/* ========================================================== */}
      <div className="bg-slate-900 border-2 border-slate-700 p-5 rounded-2xl shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-3.5 items-end">

          <div className="md:col-span-1 lg:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              1. Zona de Resguardo / Cuenca
            </label>
            <select
              value={zonaActiva?.id || ''}
              onChange={manejarCambioZona}
              className="w-full bg-slate-800 text-white font-bold text-xs md:text-sm rounded-xl px-3 py-3 border-2 border-slate-600 focus:border-amber-400 focus:outline-none transition-all shadow-inner cursor-pointer"
            >
              {listaZonas.map((z) => (
                <option key={z.id} value={z.id} className="bg-slate-900 text-white">
                  {z.nombre} ({Object.keys(z.municipios || {}).length} municipios)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 lg:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
              2. Municipio
            </label>
            <select
              value={municipioActivo}
              onChange={manejarCambioMunicipio}
              className="w-full bg-slate-800 text-white font-bold text-xs md:text-sm rounded-xl px-3 py-3 border-2 border-slate-600 focus:border-emerald-400 focus:outline-none transition-all shadow-inner cursor-pointer"
            >
              {listaMunicipios.map((mun) => (
                <option key={mun} value={mun} className="bg-slate-900 text-white">
                  {mun} ({zonaActiva?.municipios[mun]?.length || 0} loc.)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 lg:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              3. Comunidad / Localidad
            </label>
            <select
              value={localidadActiva?.id || ''}
              onChange={manejarCambioLocalidad}
              className="w-full bg-slate-800 text-white font-bold text-xs md:text-sm rounded-xl px-3 py-3 border-2 border-slate-600 focus:border-amber-400 focus:outline-none transition-all shadow-inner cursor-pointer"
            >
              {municipioActivo && zonaActiva?.municipios[municipioActivo]?.map((idLoc) => {
                const loc = db.localidades.find(l => l.id === idLoc);
                if (!loc) return null;
                return (
                  <option key={loc.id} value={loc.id} className="bg-slate-900 text-white">
                    {loc.nombre} ({loc.topografia.altitud_msnm} msnm)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="md:col-span-3 lg:col-span-2">
            <button
              onClick={() => setMostrarDisclaimer(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 border-2 border-slate-700 rounded-xl text-xs font-bold transition-all shadow"
            >
              <Info className="w-4 h-4 text-amber-400" />
              Deslinde
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================== */}
      {/* 2.bis. SEMÁFORO Y DESGLOSE MULTIAMENAZA (H6.6)             */}
      {/* ========================================================== */}
      {localidadActiva && evaluacionLocal && (
        <div className="bg-slate-900 border-2 border-slate-700 p-5 rounded-2xl shadow-xl space-y-4">
          
          {/* Semáforo de Nivel Global */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                Estado de Alerta para {localidadActiva.nombre}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {evaluacionLocal.diagnostico?.titulo || 'Evaluación en curso'}
              </p>
            </div>
            <div 
              className="px-4 py-2 rounded-xl text-center shadow-lg"
              style={{ backgroundColor: evaluacionLocal.color_alerta }}
            >
              <span className="block text-xs font-bold text-white/80 uppercase">Nivel</span>
              <span className="block text-2xl font-black text-white">{evaluacionLocal.nivel_alerta}</span>
            </div>
          </div>

          {/* Desglose por Vector */}
          {evaluacionLocal.niveles_por_vector && (
            <div>
              <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">
                Desglose por Amenaza
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <VectorBar nombre="Hidrológico" valor={evaluacionLocal.niveles_por_vector.hidrologico} />
                <VectorBar nombre="Viento" valor={evaluacionLocal.niveles_por_vector.viento} />
                <VectorBar nombre="Térmico" valor={evaluacionLocal.niveles_por_vector.termico} />
                <VectorBar nombre="Convectivo" valor={evaluacionLocal.niveles_por_vector.convectivo} />
              </div>
            </div>
          )}

          {/* Acciones Operativas */}
          {evaluacionLocal.acciones_operativas && evaluacionLocal.acciones_operativas.length > 0 && (
            <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-xl">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">
                Acciones Sugeridas
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-200 text-xs">
                {evaluacionLocal.acciones_operativas.map((accion, idx) => (
                  <li key={idx}>{accion}</li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}

      {/* ========================================================== */}
      {/* 2. SÍNTESIS DE SITUACIÓN COMUNITARIA EMITIDA POR SARA      */}
      {/* ========================================================== */}
      {localidadActiva && (
        <div className="bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl shadow-xl flex items-start gap-3.5">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-xl shrink-0 mt-0.5">
            <Bot className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                Diagnóstico de Situación • Agente SARA
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Orientación Comunitaria</span>
            </div>
            <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-normal">
              {Number(lluviaTotalDia) >= 20.0
                ? `Vigilancia activa en ${localidadActiva.nombre} (${localidadActiva.municipio}): Previsión de ${lluviaTotalDia} mm acumulados con bancos de niebla densa en carreteras de montaña. Se recomienda extrema precaución en traslados hacia caminos de ${localidadActiva.vulnerabilidad?.acceso_vial?.toLowerCase() || 'terracería'} por reducción de adherencia.`
                : `Condiciones de estabilidad en ${localidadActiva.nombre} (${localidadActiva.municipio}). Lluvia prevista de ${lluviaTotalDia} mm en el período de 24 horas, dentro de parámetros ordinarios para la cuenca. Actividades comunitarias y traslados sin restricciones de seguridad.`}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 3. BOTONES TEMPORALES                                      */}
      {/* ========================================================== */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setPestanaActiva('hoy')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all ${
            pestanaActiva === 'hoy'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Hoy (00:00 a 23:00)
        </button>

        <button
          onClick={() => setPestanaActiva('manana')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all ${
            pestanaActiva === 'manana'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Mañana (00:00 a 23:00)
        </button>

        <button
          onClick={() => setPestanaActiva('pasado')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all ${
            pestanaActiva === 'pasado'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 scale-[1.02]'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Pasado Mañana (00:00 a 23:00)
        </button>
      </div>

      {/* ========================================================== */}
      {/* 4. RESUMEN MÉTRICO DE LA COMUNIDAD SELECCIONADA            */}
      {/* ========================================================== */}
      {localidadActiva && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-2 border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">

            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                <span>{localidadActiva.municipio}, {localidadActiva.estado}</span>
                <span>•</span>
                <span>Subcuenca {localidadActiva.hidrologia.subcuenca_nom}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white">
                {localidadActiva.nombre}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Relieve: <strong className="text-slate-200">{localidadActiva.topografia.relieve}</strong> ({localidadActiva.topografia.pendiente_max_deg}°) • Posición: <strong className="text-slate-200">{localidadActiva.hidrologia.posicion}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl flex items-center gap-2.5">
                <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Lluvia 24h</p>
                  <p className="text-sm font-black text-white">{lluviaTotalDia} mm</p>
                </div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl flex items-center gap-2.5">
                <Thermometer className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Temp Máx / Mín</p>
                  <p className="text-sm font-black text-white">{tempMaxDia}° / {tempMinDia}°</p>
                </div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl flex items-center gap-2.5">
                <Wind className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Ráfaga Máx</p>
                  <p className="text-sm font-black text-white">{vientoMaxDia} km/h</p>
                </div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Consenso Oficial</p>
                  <p className="text-[11px] font-black text-emerald-300">GFS • ICON • GEM</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 5. EVOLUCIÓN HORARIA                                       */}
      {/* ========================================================== */}
      <div className="space-y-4 pt-1">

        <div className="flex flex-wrap justify-between items-center gap-2 px-1">
          <div>
            <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Evolución Horaria y Comparativa Multi-Modelo (24 Horas)
            </h2>
            <p className="text-xs text-slate-400">
              Cronograma continuo de 00:00 a 23:00 hrs para análisis por hora
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold bg-slate-900 p-2 rounded-xl border border-slate-800">
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-3.5 h-1.5 bg-sky-400 rounded-full inline-block"></span> GFS (EE.UU.)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3.5 h-1.5 bg-emerald-400 rounded-full inline-block"></span> ICON (Alemania)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3.5 h-1.5 bg-amber-400 rounded-full inline-block"></span> GEM (Canadá)
            </span>
          </div>
        </div>

        {cargando ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-mono">Calculando curvas multi-modelo para las 24 horas...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* CUADRANTE 1: TEMPERATURA */}
            <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 shadow-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-amber-600" /> Curva de Temperatura Comparativa (°C)
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  Límites día: <strong className="text-rose-600">{maxT}°C</strong> máx / <strong className="text-sky-700">{minT}°C</strong> mín
                </span>
              </div>

              <div className="relative w-full overflow-x-auto">
                <svg viewBox={`0 0 ${anchoGrafica} ${altoGrafica}`} className="w-full h-64 select-none">
                  {[minT, Math.round((minT + maxT) / 2), maxT].map((valY, idx) => {
                    const y = coordYTemp(valY);
                    return (
                      <g key={idx}>
                        <line x1={padLeft} y1={y} x2={anchoGrafica - padRight} y2={y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={padLeft - 8} y={y + 5} fill="#475569" fontSize="14" textAnchor="end" fontFamily="monospace" fontWeight="700">
                          {valY}°
                        </text>
                      </g>
                    );
                  })}

                  <path d={crearRutaLinea('ecmwf')} fill="none" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={crearRutaLinea('gfs')} fill="none" stroke="#059669" strokeWidth="4" strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={crearRutaLinea('icon')} fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

                  {horasMostradas.map((h, i) => {
                    const x = coordX(i);
                    const y = coordYTemp(h.temperatura_c);
                    const horaStr = h.fecha_hora.split('T')[1];

                    return (
                      <g key={i}>
                        {esHoraReferencia(i) && (
                          <line x1={x} y1={padTop} x2={x} y2={altoGrafica - padBottom} stroke="#e2e8f0" strokeWidth="1" />
                        )}
                        <circle cx={x} cy={y} r="5" fill="#d97706" stroke="#ffffff" strokeWidth="2" />
                        {esHoraReferencia(i) && (
                          <text x={x} y={altoGrafica - 14} fill="#475569" fontSize="14" textAnchor="middle" fontFamily="monospace" fontWeight="700">
                            {horaStr}
                          </text>
                        )}
                        {esHoraReferencia(i) && (
                          <g>
                            <rect x={x - 20} y={y - 28} width="40" height="20" rx="4" fill="#ffffff" fillOpacity="0.95" stroke="#94a3b8" strokeWidth="0.5" />
                            <text x={x} y={y - 14} fill="#0f172a" fontSize="13" textAnchor="middle" fontWeight="bold">
                              {h.temperatura_c}°
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* CUADRANTE 2: LLUVIA */}
            <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 shadow-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-blue-700" /> Intensidad de Lluvia Horaria (mm/h)
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  Total 24h: <strong className="text-blue-800 font-bold">{lluviaTotalDia} mm</strong>
                </span>
              </div>

              <div className="relative w-full overflow-x-auto">
                <svg viewBox={`0 0 ${anchoGrafica} ${altoGrafica}`} className="w-full h-64 select-none">
                  {[0, (maxLl / 2).toFixed(1), maxLl.toFixed(1)].map((valY, idx) => {
                    const y = altoGrafica - padBottom - ((valY / maxLl) * (altoGrafica - padTop - padBottom));
                    return (
                      <g key={idx}>
                        <line x1={padLeft} y1={y} x2={anchoGrafica - padRight} y2={y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={padLeft - 8} y={y + 5} fill="#475569" fontSize="14" textAnchor="end" fontFamily="monospace" fontWeight="700">
                          {valY}
                        </text>
                      </g>
                    );
                  })}

                  {horasMostradas.map((h, i) => {
                    const x = coordX(i);
                    const altBarra = escalaYBarra(h.lluvia_mm);
                    const y = altoGrafica - padBottom - altBarra;
                    const horaStr = h.fecha_hora.split('T')[1];

                    return (
                      <g key={i}>
                        <rect
                          x={x - 9}
                          y={y}
                          width="18"
                          height={Math.max(2, altBarra)}
                          rx="3"
                          fill={h.lluvia_mm > 3 ? '#1e3a8a' : (h.lluvia_mm > 0.4 ? '#3b82f6' : '#e2e8f0')}
                          stroke={h.lluvia_mm > 0.4 ? '#1e40af' : 'none'}
                          strokeWidth="1"
                        />
                        {esHoraReferencia(i) && (
                          <text x={x} y={altoGrafica - 14} fill="#475569" fontSize="14" textAnchor="middle" fontFamily="monospace" fontWeight="700">
                            {horaStr}
                          </text>
                        )}
                        {h.lluvia_mm > 0 && (
                          <text x={x} y={y - 6} fill="#1e3a8a" fontSize="12" textAnchor="middle" fontWeight="bold">
                            {h.lluvia_mm}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* CUADRANTE 3: HUMEDAD */}
            <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 shadow-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-cyan-700" /> Humedad Relativa (%)
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  Saturación ambiental en superficie
                </span>
              </div>

              <div className="relative w-full overflow-x-auto">
                <svg viewBox={`0 0 ${anchoGrafica} ${altoGrafica}`} className="w-full h-64 select-none">
                  {[50, 75, 100].map((pct, idx) => {
                    const y = altoGrafica - padBottom - (pct / 100) * (altoGrafica - padTop - padBottom);
                    return (
                      <g key={idx}>
                        <line x1={padLeft} y1={y} x2={anchoGrafica - padRight} y2={y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={padLeft - 8} y={y + 5} fill="#475569" fontSize="14" textAnchor="end" fontFamily="monospace" fontWeight="700">
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  <path
                    d={horasMostradas.map((h, i) => {
                      const x = coordX(i);
                      const y = altoGrafica - padBottom - (h.humedad_relativa_pct / 100) * (altoGrafica - padTop - padBottom);
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    fill="none" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                  />

                  {horasMostradas.map((h, i) => {
                    const x = coordX(i);
                    const y = altoGrafica - padBottom - (h.humedad_relativa_pct / 100) * (altoGrafica - padTop - padBottom);
                    const horaStr = h.fecha_hora.split('T')[1];

                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4.5" fill="#0e7490" stroke="#ffffff" strokeWidth="2" />
                        {esHoraReferencia(i) && (
                          <text x={x} y={altoGrafica - 14} fill="#475569" fontSize="14" textAnchor="middle" fontFamily="monospace" fontWeight="700">
                            {horaStr}
                          </text>
                        )}
                        {esHoraReferencia(i) && (
                          <g>
                            <rect x={x - 22} y={y - 28} width="44" height="20" rx="4" fill="#ffffff" fillOpacity="0.95" stroke="#94a3b8" strokeWidth="0.5" />
                            <text x={x} y={y - 14} fill="#0f172a" fontSize="13" textAnchor="middle" fontWeight="bold">
                              {h.humedad_relativa_pct}%
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* CUADRANTE 4: VIENTO */}
            <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 shadow-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-teal-700" /> Viento Sostenido vs. Ráfagas Máximas (km/h)
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  <span className="text-teal-700 font-bold">─ Sostenido</span> | <span className="text-orange-700 font-bold">- - Ráfaga</span>
                </span>
              </div>

              <div className="relative w-full overflow-x-auto">
                <svg viewBox={`0 0 ${anchoGrafica} ${altoGrafica}`} className="w-full h-64 select-none">
                  {[0, Math.round(maxV / 2), Math.round(maxV)].map((valY, idx) => {
                    const y = coordYV(valY);
                    return (
                      <g key={idx}>
                        <line x1={padLeft} y1={y} x2={anchoGrafica - padRight} y2={y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
                        <text x={padLeft - 8} y={y + 5} fill="#475569" fontSize="14" textAnchor="end" fontFamily="monospace" fontWeight="700">
                          {valY}
                        </text>
                      </g>
                    );
                  })}

                  <path
                    d={horasMostradas.map((h, i) => `${i === 0 ? 'M' : 'L'} ${coordX(i)} ${coordYV(h.rafagas_kmh)}`).join(' ')}
                    fill="none" stroke="#ea580c" strokeWidth="3.5" strokeDasharray="7 4" strokeLinecap="round" strokeLinejoin="round"
                  />
                  <path
                    d={horasMostradas.map((h, i) => `${i === 0 ? 'M' : 'L'} ${coordX(i)} ${coordYV(h.viento_kmh)}`).join(' ')}
                    fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                  />

                  {horasMostradas.map((h, i) => {
                    const x = coordX(i);
                    const yR = coordYV(h.rafagas_kmh);
                    const horaStr = h.fecha_hora.split('T')[1];

                    return (
                      <g key={i}>
                        <circle cx={x} cy={yR} r="4" fill="#c2410c" stroke="#ffffff" strokeWidth="1.5" />
                        {esHoraReferencia(i) && (
                          <text x={x} y={altoGrafica - 14} fill="#475569" fontSize="14" textAnchor="middle" fontFamily="monospace" fontWeight="700">
                            {horaStr}
                          </text>
                        )}
                        {esHoraReferencia(i) && (
                          <g>
                            <rect x={x - 20} y={yR - 28} width="40" height="20" rx="4" fill="#ffffff" fillOpacity="0.95" stroke="#94a3b8" strokeWidth="0.5" />
                            <text x={x} y={yR - 14} fill="#0f172a" fontSize="13" textAnchor="middle" fontWeight="bold">
                              {h.rafagas_kmh}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ========================================================== */}
      {/* 6. SECCIÓN DE SATÉLITE GOES-19                             */}
      {/* ========================================================== */}
      <div className="pt-2">
        <SatelliteViewer />
      </div>

      {/* ========================================================== */}
      {/* MODAL DEL REPORTE COMPLETO (vista pública)                 */}
      {/* ========================================================== */}
      <ReporteModalPublico
        abierto={modalReportePublicoAbierto}
        alCerrar={() => setModalReportePublicoAbierto(false)}
        reporteVigente={reporteVigente}
      />

    </div>
  );
}