import React, { useState, useEffect } from 'react';
import db from '../data/localidades.json';
import { consultarModelosDeterministas } from '../engine/meteoFetcher.js';
import { generarConsensoDeterminista } from '../engine/consensusEngine.js';
import SatelliteViewer from '../components/SatelliteViewer.jsx';
import DisclaimerModal from '../components/DisclaimerModal.jsx';
import { 
  CloudRain, 
  Thermometer, 
  Wind, 
  MapPin, 
  ShieldCheck, 
  Calendar, 
  Info,
  Clock
} from 'lucide-react';

export default function MonitorPublico() {
  const listaZonas = Object.values(db.indices.zonas);

  const [zonaActiva, setZonaActiva] = useState(listaZonas[0] || null);
  const [localidadActiva, setLocalidadActiva] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [datosConsenso, setDatosConsenso] = useState([]);
  const [pestanaActiva, setPestanaActiva] = useState('hoy');
  const [mostrarDisclaimer, setMostrarDisclaimer] = useState(false);

  useEffect(() => {
    if (zonaActiva && zonaActiva.localidades_ids?.length > 0) {
      const primerPueblo = db.localidades.find(l => l.id === zonaActiva.localidades_ids[0]);
      setLocalidadActiva(primerPueblo || null);
    }
  }, [zonaActiva]);

  useEffect(() => {
    if (!localidadActiva) return;

    let cancelado = false;
    async function cargarPronostico() {
      setCargando(true);
      const res = await consultarModelosDeterministas(
        localidadActiva.coords.lat,
        localidadActiva.coords.lon
      );

      if (!cancelado && res.exito) {
        const serie = generarConsensoDeterminista(res.datos_horarios);
        setDatosConsenso(serie);
      }
      if (!cancelado) setCargando(false);
    }

    cargarPronostico();
    return () => { cancelado = true; };
  }, [localidadActiva]);

  const manejarCambioZona = (e) => {
    const nuevaZona = listaZonas.find(z => z.id === e.target.value);
    setZonaActiva(nuevaZona);
    if (nuevaZona && nuevaZona.localidades_ids?.length > 0) {
      const primerPueblo = db.localidades.find(l => l.id === nuevaZona.localidades_ids[0]);
      setLocalidadActiva(primerPueblo);
    }
  };

  const manejarCambioLocalidad = (e) => {
    const loc = db.localidades.find(l => l.id === e.target.value);
    if (loc) {
      setLocalidadActiva(loc);
    }
  };

  const obtenerHorasPestana = () => {
    if (!datosConsenso || datosConsenso.length === 0) return [];
    if (pestanaActiva === 'hoy') return datosConsenso.slice(0, 24);
    if (pestanaActiva === 'manana') return datosConsenso.slice(24, 48);
    return datosConsenso.slice(48, 72);
  };

  const horasMostradas = obtenerHorasPestana();

  const lluviaTotalDia = horasMostradas.reduce((acc, h) => acc + h.lluvia_mm, 0).toFixed(1);
  const tempMaxDia = horasMostradas.length > 0 ? Math.max(...horasMostradas.map(h => h.temperatura_c)).toFixed(1) : '--';
  const tempMinDia = horasMostradas.length > 0 ? Math.min(...horasMostradas.map(h => h.temperatura_c)).toFixed(1) : '--';
  const vientoMaxDia = horasMostradas.length > 0 ? Math.max(...horasMostradas.map(h => h.rafagas_kmh)).toFixed(1) : '--';

  return (
    <div className="space-y-6">
      <DisclaimerModal abierto={mostrarDisclaimer} alCerrar={() => setMostrarDisclaimer(false)} />

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Zona de Resguardo (16 Zonas Cáritas)
          </label>
          <select
            value={zonaActiva?.id || ''}
            onChange={manejarCambioZona}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            {listaZonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre} ({z.localidades_ids.length} comunidades)
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Comunidad Específica
          </label>
          <select
            value={localidadActiva?.id || ''}
            onChange={manejarCambioLocalidad}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            {zonaActiva?.localidades_ids.map((idLoc) => {
              const loc = db.localidades.find(l => l.id === idLoc);
              if (!loc) return null;
              return (
                <option key={loc.id} value={loc.id}>
                  {loc.nombre} — {loc.municipio} ({loc.topografia.altitud_msnm} msnm)
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => setMostrarDisclaimer(true)}
            className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            <Info className="w-4 h-4 text-amber-400" />
            Deslinde Oficial
          </button>
        </div>
      </div>

      {localidadActiva && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                <MapPin className="w-4 h-4" />
                <span>{localidadActiva.municipio}, {localidadActiva.estado}</span>
                <span>•</span>
                <span>Subcuenca {localidadActiva.hidrologia.subcuenca_nom}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">
                {localidadActiva.nombre}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Relieve: <strong className="text-slate-200">{localidadActiva.topografia.relieve}</strong> (Pendiente máx: {localidadActiva.topografia.pendiente_max_deg}°) • Posición: <strong className="text-slate-200">{localidadActiva.hidrologia.posicion}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-xl flex items-center gap-2.5">
                <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Lluvia 24h</p>
                  <p className="text-sm font-bold text-white">{lluviaTotalDia} mm</p>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-xl flex items-center gap-2.5">
                <Thermometer className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Temp Máx/Mín</p>
                  <p className="text-sm font-bold text-white">{tempMaxDia}° / {tempMinDia}°</p>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-xl flex items-center gap-2.5">
                <Wind className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Ráfaga Máx</p>
                  <p className="text-sm font-bold text-white">{vientoMaxDia} km/h</p>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-xl flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Modelos</p>
                  <p className="text-xs font-bold text-emerald-300">ECMWF•GFS•ICON</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setPestanaActiva('hoy')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${
            pestanaActiva === 'hoy'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Hoy (Primeras 24h)
        </button>

        <button
          onClick={() => setPestanaActiva('manana')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${
            pestanaActiva === 'manana'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Mañana (24h a 48h)
        </button>

        <button
          onClick={() => setPestanaActiva('pasado')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${
            pestanaActiva === 'pasado'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Pasado Mañana (48h a 72h)
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-800/80 border-b border-slate-700/80 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm md:text-base text-white">
              Evolución Horaria y Comparativa Multi-Modelo
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Filtro de Ceros Espurios Activo • Mediana Robusta
          </span>
        </div>

        {cargando ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Sincronizando con ECMWF, GFS e ICON...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-3">Lluvia Consenso</th>
                  <th className="py-3 px-3">Multi-Modelo (ECMWF | GFS | ICON)</th>
                  <th className="py-3 px-3">Temp</th>
                  <th className="py-3 px-3">Viento / Ráfagas</th>
                  <th className="py-3 px-3">Humedad</th>
                  <th className="py-3 px-3 text-center">Confiabilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {horasMostradas.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-white">
                      {h.fecha_hora.split('T')[1]} hrs
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        h.lluvia_mm > 5 
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                          : h.lluvia_mm > 0.5 
                          ? 'text-blue-400 font-semibold' 
                          : 'text-slate-500'
                      }`}>
                        {h.lluvia_mm} mm/h
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      <span className="text-blue-400">{h.detalle_modelos.lluvia.ecmwf}</span>
                      <span className="mx-1 text-slate-600">|</span>
                      <span className="text-emerald-400">{h.detalle_modelos.lluvia.gfs}</span>
                      <span className="mx-1 text-slate-600">|</span>
                      <span className="text-amber-400">{h.detalle_modelos.lluvia.icon}</span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {h.temperatura_c}°C
                    </td>
                    <td className="py-2.5 px-3">
                      {h.viento_kmh} <span className="text-slate-500 text-[10px]">({h.rafagas_kmh} max)</span> km/h
                    </td>
                    <td className="py-2.5 px-3">
                      {h.humedad_relativa_pct}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        h.confiabilidad === 'ALTA'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : h.confiabilidad === 'MODERADA'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {h.confiabilidad}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-2">
        <SatelliteViewer />
      </div>
    </div>
  );
}