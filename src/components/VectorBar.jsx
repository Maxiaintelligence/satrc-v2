import React from 'react';

export default function VectorBar({ nombre, valor }) {
  // valor va de 1.0 a 4.0
  const porcentaje = Math.min(100, Math.max(0, ((valor - 1) / 3) * 100));
  
  // Colores según el nivel
  let color = 'bg-emerald-500'; // N1
  if (valor >= 2.0) color = 'bg-amber-500'; // N2
  if (valor >= 3.0) color = 'bg-orange-500'; // N3
  if (valor >= 4.0) color = 'bg-rose-500'; // N4

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-slate-300 uppercase">
        <span>{nombre}</span>
        <span className="font-mono">{valor.toFixed(2)}</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-500`} 
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}