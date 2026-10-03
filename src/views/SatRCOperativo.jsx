import React, { useState, useEffect } from 'react';
import db from '../data/localidades.json';
import { consultarModelosDeterministas } from '../engine/meteoFetcher.js';
import { generarConsensoDeterminista } from '../engine/consensusEngine.js';
import { evaluarLocalidad } from '../engine/riskEvaluator.js';
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
  CloudRain,
  Hospital,
  Compass,
  ArrowRight
} from 'lucide-react';

export default function SatRCOperativo({ alCerrarSesion }) {
  const listaZonas = Object.values(db.indices.zonas);

  const [killSwitchActivo, setKillSwitchActivo] = useState(false);
  const [zonaSeleccionada, setZonaSeleccionada] = useState(listaZonas[0] || null);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargandoEvaluacion, setCargandoEvaluacion] = useState(false);
  const [localidadFoco, setLocalidadFoco] = useState(null);

  // Modal de Detalle Profundo Comunitario
  const [comunidadDetalle, setComunidadDetalle] = useState(null);
  const [detalleMeteoLocal, setDetalleMeteoLocal] = useState(null);
  const [cargandoDetalleLocal, setCargandoDetalleLocal] = useState(false);

  // Estados de Emisión Manual
  const [modoManual, setModoManual] = useState(false);
  const [nivelManual, setNivelManual] = useState(3);
  const [vectorManual, setVectorManual] = useState('HIDROMETEOROLOGICO');
  const [mensajeManual, setMensajeManual] = useState('');
  const [alertaManualEmitida, setAlertaManualEmitida] = useState(null);

  useEffect(() => {
    if (killSwitchActivo || !zonaSeleccionada) return;

    let cancelado = false;
    async function correrEvaluacionZona() {
      setCargandoEvaluacion(true);
      
      const nodoCentral = db.localidades.find(l => l.id === zonaSeleccionada.localidades_ids[0]);
      if (!nodoCentral) return;

      const resMeteo = await consultarModelosDeterministas(nodoCentral.coords.lat, nodoCentral.coords.lon);
      if (cancelado || !resMeteo.exito) {
        setCargandoEvaluacion(false);
        return;
      }

      const serieConsenso = generarConsensoDeterminista(resMeteo.datos_horarios);
      const lluviaCabecera = serieConsenso.slice(0, 24).reduce((acc, h) => acc + h.lluvia_mm, 0);

      const resultados = zonaSeleccionada.localidades_ids.map(idLoc => {
        const loc = db.localidades.find(l => l.id === idLoc);
        return evaluarLocalidad(loc, serieConsenso, { lluvia_cabecera_mm: lluviaCabecera });
      });

      resultados.sort((a, b) => b.nivel_alerta - a.nivel_alerta);

      if (!cancelado) {
        setEvaluaciones(resultados);
        setLocalidadFoco(resultados[0] || null);
        setCargandoEvaluacion(false);
      }
    }

    correrEvaluacionZona();
    return () => { cancelado = true; };
  }, [zonaSeleccionada, killSwitchActivo]);

  // Al abrir el detalle de una comunidad específica, consultamos su coordenada precisa
  const abrirDetalleComunidad = async (itemEvaluado) => {
    setComunidadDetalle(itemEvaluado);
    setCargandoDetalleLocal(true);

    const res = await consultarModelosDeterministas(
      itemEvaluado.donde.coordenadas.lat,
      itemEvaluado.donde.coordenadas.lon
    );

    if (res.exito) {
      const serie = generarConsensoDeterminista(res.datos_horarios);
      setDetalleMeteoLocal(serie.slice(0, 12)); // Primeras 12 horas críticas
    }
    setCargandoDetalleLocal(false);
  };

  const emitirAlertaManual = (e) => {
    e.preventDefault();
    if (!mensajeManual.trim()) return;

    setAlertaManualEmitida({
      timestamp: new Date().toLocaleTimeString(),
      zona: zonaSeleccionada.nombre,
      nivel: nivelManual,
      vector: vectorManual,
      mensaje: mensajeManual
    });
    setModoManual(false);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Barra de Control Maestro */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-white tracking-wide">
                Consola Operativa SatRC V2.0
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                killSwitchActivo 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {killSwitchActivo ? 'PARADO (MODO MANUAL)' : 'MOTOR AUTOMÁTICO ACTIVO'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Detección de Tormentas Severas y Cascada Hidrológica
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setKillSwitchActivo(!killSwitchActivo)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              killSwitchActivo
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                : 'bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-500/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {killSwitchActivo ? 'Reanudar Automático' : 'Paro General (Kill-Switch)'}
          </button>

          <button
            onClick={() => setModoManual(!modoManual)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow"
          >
            <Send className="w-3.5 h-3.5" />
            {modoManual ? 'Cancelar Emisión' : 'Emitir Alerta Manual'}
          </button>

          <button
            onClick={alCerrarSesion}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-medium border border-slate-700"
          >
            Salir
          </button>
        </div>

      </div>

      {/* Alerta Manual Emitida */}
      {alertaManualEmitida && (
        <div className="bg-rose-950/40 border border-rose-500 p-4 rounded-2xl flex justify-between items-start gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-rose-500 text-white px-2 py-0.5 rounded">
                  ALERTA EMITIDA (NIVEL {alertaManualEmitida.nivel})
                </span>
                <span className="text-xs text-rose-300 font-semibold">{alertaManualEmitida.zona}</span>
                <span className="text-[11px] text-slate-400">• {alertaManualEmitida.timestamp}</span>
              </div>
              <p className="text-sm font-medium text-white mt-1.5">{alertaManualEmitida.mensaje}</p>
            </div>
          </div>
          <button 
            onClick={() => setAlertaManualEmitida(null)}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg"
          >
            Retirar
          </button>
        </div>
      )}

      {/* Formulario Manual */}
      {modoManual && (
        <div className="bg-slate-900 border border-amber-500/50 p-5 rounded-2xl shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <Send className="w-4 h-4" /> Formulario de Emisión Manual Cáritas
          </h3>
          <form onSubmit={emitirAlertaManual} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Zona Objetivo</label>
                <select
                  value={zonaSeleccionada?.id || ''}
                  onChange={(e) => setZonaSeleccionada(listaZonas.find(z => z.id === e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                >
                  {listaZonas.map(z => (
                    <option key={z.id} value={z.id}>{z.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Vector de Amenaza</label>
                <select
                  value={vectorManual}
                  onChange={(e) => setVectorManual(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                >
                  <option value="HIDROMETEOROLOGICO">A — Hidrometeorológico (Lluvia / Deslave / Inundación)</option>
                  <option value="FRIO_Y_HELADAS">B — Frío Extremo y Heladas</option>
                  <option value="CALOR_INCENDIOS">C — Calor / Sequía / Incendios</option>
                  <option value="CALIDAD_AIRE">D — Calidad del Aire</option>
                  <option value="CICLONES_NORTES">E — Ciclones y Eventos de Norte</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Nivel de Severidad</label>
                <select
                  value={nivelManual}
                  onChange={(e) => setNivelManual(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value={1} className="text-emerald-400">Nivel 1 — Normalidad (Verde)</option>
                  <option value={2} className="text-amber-400">Nivel 2 — Vigilancia (Amarillo)</option>
                  <option value={3} className="text-orange-400">Nivel 3 — Alerta Temprana (Naranja)</option>
                  <option value={4} className="text-rose-400">Nivel 4 — Emergencia (Rojo)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Instrucciones Operativas / Comunicado Pastoral para la Comunidad
              </label>
              <textarea
                rows={3}
                placeholder="Ejemplo: Habilitar salones parroquiales como albergues preventivos..."
                value={mensajeManual}
                onChange={(e) => setMensajeManual(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModoManual(false)}
                className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg"
              >
                Transmitir Alerta Oficial
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Selector de Zona */}
      <div className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Zona de Resguardo Bajo Monitoreo
          </label>
          <select
            value={zonaSeleccionada?.id || ''}
            onChange={(e) => setZonaSeleccionada(listaZonas.find(z => z.id === e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
          >
            {listaZonas.map(z => (
              <option key={z.id} value={z.id}>
                {z.nombre} ({z.localidades_ids.length} comunidades)
              </option>
            ))}
          </select>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-slate-400 uppercase font-semibold">Comunidades</p>
          <p className="text-xl font-black text-white">{evaluaciones.length} / 444</p>
        </div>
      </div>

      {/* 3. Panel Foco de las 4 Preguntas */}
      {localidadFoco && (
        <div className="bg-slate-900 border-2 rounded-2xl shadow-2xl overflow-hidden transition-all"
             style={{ borderColor: localidadFoco.color_alerta }}>
          
          <div className="p-4 flex flex-wrap justify-between items-center gap-3"
               style={{ backgroundColor: `${localidadFoco.color_alerta}15` }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black px-2.5 py-1 rounded-lg text-white"
                    style={{ backgroundColor: localidadFoco.color_alerta }}>
                NIVEL {localidadFoco.nivel_alerta} • {localidadFoco.estado_alerta}
              </span>
              <span className="text-sm font-bold text-white">
                {localidadFoco.nombre}, {localidadFoco.municipio} ({localidadFoco.estado})
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Cuenca: {localidadFoco.donde.subcuenca_nom}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            
            {/* QUÉ y CUÁNDO */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-4 h-4" /> 1. ¿QUÉ VA A SUCEDER?
                </h4>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <p className="text-sm font-bold text-white">{localidadFoco.que.evento}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{localidadFoco.que.descripcion}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-4 h-4" /> 2. ¿CUÁNDO VA A SUCEDER?
                </h4>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Inicio Amenaza</span>
                    <span className="font-mono font-bold text-slate-200">
                      {localidadFoco.cuando.inicio_amenaza !== 'En curso o no prevista' ? localidadFoco.cuando.inicio_amenaza.split('T')[1] + ' hrs' : 'En curso'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Intensidad Pico</span>
                    <span className="font-mono font-bold text-amber-300">
                      {localidadFoco.cuando.intensidad_pico_horaria_mm} mm/h
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] text-amber-400 uppercase block font-bold">Ventana de Evacuación Preventiva</span>
                    <span className="text-sm font-extrabold text-white">
                      {localidadFoco.cuando.ventana_evacuacion_horas} horas antes del impacto
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* DÓNDE y TAMAÑO */}
            <div className="space-y-4 md:pl-6 pt-4 md:pt-0">
              <div>
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-4 h-4" /> 3. ¿DÓNDE VA A SUCEDER?
                </h4>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
                  <p>• <strong>Relieve:</strong> {localidadFoco.donde.tipo_relieve} (Pendiente máx: {localidadFoco.donde.pendiente_max_grados}°)</p>
                  <p>• <strong>Posición:</strong> Tramo {localidadFoco.donde.posicion_hidrologica} a {localidadFoco.donde.distancia_cauce_km} km del río</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Users className="w-4 h-4" /> 4. ¿DE QUÉ TAMAÑO SERÁ EL IMPACTO?
                </h4>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Población directa:</span>
                    <span className="font-extrabold text-white">{localidadFoco.tamano_impacto.poblacion_directa.toLocaleString()} hab.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Aportantes aguas arriba:</span>
                    <span className="font-mono text-slate-300">{localidadFoco.tamano_impacto.poblacion_aguas_arriba.toLocaleString()} hab.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Acceso vial:</span>
                    <span className="font-bold text-amber-300">{localidadFoco.tamano_impacto.tipo_acceso}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hospital más cercano:</span>
                    <span className="font-mono text-slate-200">{localidadFoco.tamano_impacto.distancia_hospital_km} km</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. Matriz de Localidades */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Matriz de Amenazas por Localidad ({evaluaciones.length} Comunidades)
          </h3>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Haz clic en "Ver Detalle" para auditar una comunidad
          </span>
        </div>

        {cargandoEvaluacion ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm">Evaluando pendientes e hidrología en tiempo real...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Alerta</th>
                  <th className="py-3 px-3">Comunidad</th>
                  <th className="py-3 px-3">Municipio</th>
                  <th className="py-3 px-3">Relieve / Pendiente</th>
                  <th className="py-3 px-3">Población</th>
                  <th className="py-3 px-3">Acceso Vial</th>
                  <th className="py-3 px-3">Amenaza Activa</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {evaluaciones.map((item) => (
                  <tr key={item.localidad_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: item.color_alerta }}>
                        Nivel {item.nivel_alerta}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {item.nombre}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {item.municipio}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.donde.tipo_relieve} ({item.donde.pendiente_max_grados}°)
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {item.tamano_impacto.poblacion_directa.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        item.tamano_impacto.tipo_acceso === 'BRECHA' || item.tamano_impacto.tipo_acceso === 'CAMINO_TERRACERIA'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'text-slate-400'
                      }`}>
                        {item.tamano_impacto.tipo_acceso}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {item.que.evento}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => abrirDetalleComunidad(item)}
                        className="flex items-center gap-1 mx-auto text-[11px] font-bold text-amber-400 hover:text-white bg-slate-800 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg transition-all border border-slate-700"
                      >
                        Auditar <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL DE DETALLE PROFUNDO COMUNITARIO */}
      {comunidadDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
            
            {/* Cabecera del Detalle */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-start"
                 style={{ backgroundColor: `${comunidadDetalle.color_alerta}20` }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black px-2.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: comunidadDetalle.color_alerta }}>
                    NIVEL {comunidadDetalle.nivel_alerta} • {comunidadDetalle.estado_alerta}
                  </span>
                  <span className="text-xs text-slate-400">Auditoría Comunitaria Cáritas</span>
                </div>
                <h2 className="text-2xl font-black text-white">{comunidadDetalle.nombre}</h2>
                <p className="text-xs text-slate-300">
                  {comunidadDetalle.municipio}, {comunidadDetalle.estado} • Subcuenca: {comunidadDetalle.donde.subcuenca_nom}
                </p>
              </div>

              <button
                onClick={() => setComunidadDetalle(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Detalle */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              
              {/* Desglose de Amenaza */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-1">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Diagnóstico de Amenaza</p>
                <p className="text-base font-bold text-white">{comunidadDetalle.que.evento}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{comunidadDetalle.que.descripcion}</p>
              </div>

              {/* Métricas Críticas del Terreno */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pendiente Máx</span>
                  <span className="text-base font-bold text-white">{comunidadDetalle.donde.pendiente_max_grados}°</span>
                  <span className="text-[10px] text-slate-400 block">{comunidadDetalle.donde.tipo_relieve}</span>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Acceso Vial</span>
                  <span className="text-xs font-bold text-amber-300 block truncate">{comunidadDetalle.tamano_impacto.tipo_acceso}</span>
                  <span className="text-[10px] text-slate-400 block">Riesgo corte</span>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hospital Cercano</span>
                  <span className="text-base font-bold text-white">{comunidadDetalle.tamano_impacto.distancia_hospital_km} km</span>
                  <span className="text-[10px] text-slate-400 block">Vía terrestre</span>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Ventana Acción</span>
                  <span className="text-base font-bold text-emerald-400">{comunidadDetalle.cuando.ventana_evacuacion_horas} hrs</span>
                  <span className="text-[10px] text-slate-400 block">Tiempo conc.</span>
                </div>
              </div>

              {/* Pronóstico Horario Específico de las Coordenadas de ESTA Localidad */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" /> Curva Horaria Específica de esta Comunidad (Próximas 12h)
                </h4>

                {cargandoDetalleLocal ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    Sincronizando coordenadas exactas...
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {detalleMeteoLocal?.map((h, i) => (
                      <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] font-mono text-slate-400 block">{h.fecha_hora.split('T')[1]}</span>
                        <span className={`text-xs font-bold block my-0.5 ${h.lluvia_mm > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                          {h.lluvia_mm} mm
                        </span>
                        <span className="text-[10px] text-slate-300 block">{h.temperatura_c}°C</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Pie del Modal */}
            <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">
                Población protegida: <strong>{comunidadDetalle.tamano_impacto.poblacion_directa.toLocaleString()}</strong> habitantes
              </span>
              <button
                onClick={() => setComunidadDetalle(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. Visor Satelital */}
      <div className="pt-2">
        <SatelliteViewer />
      </div>

    </div>
  );
}