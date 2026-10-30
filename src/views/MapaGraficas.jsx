import React from 'react';
import RiskMap from '../components/RiskMap.jsx';

export default function MapaGraficas() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-white">Mapa y Gráficas</h2>
      <RiskMap evaluaciones={[]} localidadFoco={null} alSeleccionarLocalidad={() => {}} />
      <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-xl border-dashed">
        Gráficas detalladas en construcción (Próximo Commit)
      </div>
    </div>
  );
}