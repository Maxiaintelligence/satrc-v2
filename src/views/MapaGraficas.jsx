import React from 'react';
import RiskMap from '../components/RiskMap.jsx';
import WeatherChart from '../components/WeatherChart.jsx';

// Datos de prueba para el diseño visual (en el siguiente commit se conectarán al backend)
const mockDataTemp = Array.from({ length: 24 }, (_, i) => ({ hora: `${i}:00`, valor: 15 + Math.sin(i / 3) * 5 }));
const mockDataLluvia = Array.from({ length: 24 }, (_, i) => ({ hora: `${i}:00`, valor: i > 12 && i < 18 ? 2.5 : 0 }));
const mockDataViento = Array.from({ length: 24 }, (_, i) => ({ hora: `${i}:00`, valor: 20 + Math.cos(i / 4) * 15 }));
const mockDataHumedad = Array.from({ length: 24 }, (_, i) => ({ hora: `${i}:00`, valor: 60 + Math.sin(i / 2) * 15 }));

export default function MapaGraficas() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-white px-2">Mapa y Gráficas</h2>
      
      {/* Mapa de Riesgos */}
      <RiskMap evaluaciones={[]} localidadFoco={null} alSeleccionarLocalidad={() => {}} />
      
      {/* Gráficas Detalladas */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Variables Meteorológicas</h3>
          <select className="bg-slate-800 text-xs text-white border border-slate-700 rounded-lg px-2 py-1 outline-none">
            <option>24 horas</option>
            <option>48 horas</option>
            <option>7 días</option>
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WeatherChart titulo="Temperatura (°C)" datos={mockDataTemp} unidad="°C" colorLinea="#f59e0b" />
          <WeatherChart titulo="Lluvia (mm)" datos={mockDataLluvia} unidad="mm" colorLinea="#3b82f6" />
          <WeatherChart titulo="Viento (km/h)" datos={mockDataViento} unidad="km/h" colorLinea="#06b6d4" />
          <WeatherChart titulo="Humedad (%)" datos={mockDataHumedad} unidad="%" colorLinea="#a855f7" />
        </div>
      </div>
    </div>
  );
}