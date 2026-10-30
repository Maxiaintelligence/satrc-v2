import React, { useState } from 'react';

export default function WeatherChart({ titulo, datos, unidad, colorLinea = "#f59e0b" }) {
  const [puntoActivo, setPuntoActivo] = useState(null);

  if (!datos || datos.length === 0) return null;

  const maxVal = Math.max(...datos.map(d => d.valor), 1);
  const minVal = Math.min(...datos.map(d => d.valor), 0);
  
  // Dimensiones del SVG
  const width = 300;
  const height = 100;
  const padding = 10;
  
  // Coordenadas
  const getX = (index) => padding + (index / (datos.length - 1)) * (width - padding * 2);
  const getY = (valor) => height - padding - ((valor - minVal) / (maxVal - minVal || 1)) * (height - padding * 2);

  // Construir el path de la línea
  const pathD = datos.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.valor)}`).join(' ');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
      <div className="flex justify-between items-center z-10">
        <h3 className="text-xs font-bold text-slate-300">{titulo}</h3>
        <span className="text-[10px] text-slate-500 font-mono">{unidad}</span>
      </div>
      
      <div className="relative w-full h-24">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          {/* Línea de fondo (grid) */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1e293b" strokeWidth="1" />
          
          {/* Área bajo la curva */}
          <path d={`${pathD} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`} fill={colorLinea} opacity="0.1" />
          
          {/* Línea principal */}
          <path d={pathD} fill="none" stroke={colorLinea} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Puntos interactivos */}
          {datos.map((d, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(d.valor)}
              r={puntoActivo === i ? 4 : 2}
              fill={puntoActivo === i ? '#ffffff' : colorLinea}
              stroke={colorLinea}
              strokeWidth="1.5"
              onMouseEnter={() => setPuntoActivo(i)}
              onMouseLeave={() => setPuntoActivo(null)}
              onTouchStart={() => setPuntoActivo(i)}
              className="cursor-pointer transition-all duration-200"
            />
          ))}
        </svg>

        {/* Tooltip flotante */}
        {puntoActivo !== null && (
          <div 
            className="absolute bg-slate-800 border border-slate-600 text-white text-[10px] px-2 py-1 rounded pointer-events-none transform -translate-x-1/2 -translate-y-full shadow-lg z-20"
            style={{ left: `${(getX(puntoActivo) / width) * 100}%`, top: `${(getY(datos[puntoActivo].valor) / height) * 100}%` }}
          >
            {datos[puntoActivo].hora} <br/>
            <strong>{datos[puntoActivo].valor} {unidad}</strong>
          </div>
        )}
      </div>
    </div>
  );
}