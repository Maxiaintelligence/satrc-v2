import React from 'react';

/**
 * SatRC V2.0 — Componente de renderizado de markdown simple
 *
 * Extraído en Etapa 3 (H6.2) desde src/components/ReporteCuerpo.jsx.
 * Renderiza viñetas y negritas (**texto**) que Groq devuelve en las
 * secciones del reporte.
 *
 * Uso: <TextoEnriquecido texto={reporte.seccion_I_atmosfera} />
 *
 * Soporta:
 * - Párrafos (saltos de línea simples).
 * - Viñetas (-, •, * al inicio de línea).
 * - Negritas (**texto**).
 *
 * NO soporta markdown completo (headers, cursivas, links, etc).
 */

export function TextoEnriquecido({ texto, className = "" }) {
  if (!texto || typeof texto !== 'string') return null;

  const lineas = texto.split('\n').filter(l => l.trim().length > 0);

  const renderizarNegritas = (linea) => {
    const partes = linea.split(/(\*\*[^*]+\*\*)/g);
    return partes.map((parte, i) => {
      if (parte.startsWith('**') && parte.endsWith('**')) {
        return <strong key={i} className="font-bold text-white">{parte.slice(2, -2)}</strong>;
      }
      return <span key={i}>{parte}</span>;
    });
  };

  const esVineta = (linea) => /^\s*[-•*]\s+/.test(linea);

  const parrafos = [];
  let listaActual = [];

  lineas.forEach((linea, idx) => {
    if (esVineta(linea)) {
      const contenido = linea.replace(/^\s*[-•*]\s+/, '');
      listaActual.push(<li key={idx} className="ml-4 list-disc">{renderizarNegritas(contenido)}</li>);
    } else {
      if (listaActual.length > 0) {
        parrafos.push(<ul key={`ul-${idx}`} className="space-y-1 my-1">{listaActual}</ul>);
        listaActual = [];
      }
      parrafos.push(<p key={`p-${idx}`} className="my-1">{renderizarNegritas(linea)}</p>);
    }
  });

  if (listaActual.length > 0) {
    parrafos.push(<ul key="ul-final" className="space-y-1 my-1">{listaActual}</ul>);
  }

  return <div className={className}>{parrafos}</div>;
}