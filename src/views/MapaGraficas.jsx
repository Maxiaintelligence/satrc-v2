import React from 'react';
import RiskMap from '../components/RiskMap.jsx';
import WeatherChart from '../components/WeatherChart.jsx';
import { MapPin, AlertCircle } from 'lucide-react';

export default function MapaGraficas({ localidadActiva, datosConsenso }) {
  if (!localidadActiva || !datosConsenso || datosConsenso.length < 240) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <AlertCircle className="w-10 h-10 text-slate-500" />
        <p className="text-slate-400 text-sm">Selecciona una localidad en el Monitor para ver sus gráficas.</p>
      </div>
    );
  }

  const ventanaHoy = datosConsenso.slice(168, 192);

  const datosTemp = ventanaHoy.map((h, i) => ({ hora: `${i}:00`, valor: h.temperatura_c }));
  const datosLluvia = ventanaHoy.map((h, i) => ({ hora: `${i}:00`, valor: h.lluvia_mm }));
  const datosViento = ventanaHoy.map((h, i) => ({ hora: `${i}:00`, valor: h.rafagas_kmh }));
  const datosHumedad = ventanaHoy.map((h, i) => ({ hora: `${i}:00`, valor: h.humedad_relativa_pct }));

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3 px-2 border-b border-slate-800 pb-4">
        <div className="p-2.5 bg-slate-800 text-slate-300 rounded-xl">
          <MapPin className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white leading-tight">{localidadActiva.nombre}</h2>
          <p className="text-xs text-slate-400">Mapa y Gráficas · Datos de Open-Meteo</p>
        </div>
      </div>

      <RiskMap evaluaciones={[localidadActiva]} localidadFoco={localidadActiva} alSeleccionarLocalidad={() => {}} />
      
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Variables Meteorológicas (Hoy)</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WeatherChart titulo="Temperatura (°C)" datos={datosTemp} unidad="°C" colorLinea="#f59e0b" />
          <WeatherChart titulo="Lluvia (mm)" datos={datosLluvia} unidad="mm" colorLinea="#3b82f6" />
          <WeatherChart titulo="Viento (km/h)" datos={datosViento} unidad="km/h" colorLinea="#06b6d4" />
          <WeatherChart titulo="Humedad (%)" datos={datosHumedad} unidad="%" colorLinea="#a855f7" />
        </div>
      </div>
    </div>
  );
}
