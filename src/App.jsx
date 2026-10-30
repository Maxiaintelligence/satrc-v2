import React, { useState } from 'react';
import MonitorPublico from './views/MonitorPublico.jsx';
import SatRCOperativo from './views/SatRCOperativo.jsx';
import MapaGraficas from './views/MapaGraficas.jsx';
import ReporteSara from './views/ReporteSara.jsx';
import { Lock, Eye, EyeOff, AlertTriangle, Map as MapIcon, FileText } from 'lucide-react';

export default function App() {
  // Vistas: 'inicio' (MonitorPublico), 'mapa_graficas', 'reporte_sara', 'operativo'
  const [vistaActiva, setVistaActiva] = useState('inicio'); 
  const [operativoAbierto, setOperativoAbierto] = useState(false);
  const [localidadActiva, setLocalidadActiva] = useState(null);
  const [datosConsenso, setDatosConsenso] = useState([]);
  

  // Estados para el login operativo
  const [autenticado, setAutenticado] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorPassword, setErrorPassword] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const intentarAccesoAlerta = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth-operativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: passwordInput })
      });
      if (res.ok) {
        setAutenticado(true);
        setErrorPassword(false);
        setOperativoAbierto(false);
        setVistaActiva('operativo');
      } else {
        setErrorPassword(true);
      }
    } catch (error) {
      setErrorPassword(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-24">
      
      {/* 1. Header Compacto */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="SatRC" className="w-10 h-10 rounded-full border border-amber-500/40 bg-white" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white leading-none">SatRC</h1>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded">V2.0</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Monitor climático · Hidalgo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Conectado
            </span>
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal Dinámico */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4">
        {vistaActiva === 'inicio' && (
          <MonitorPublico 
            localidadActiva={localidadActiva} 
            setLocalidadActiva={setLocalidadActiva} 
            datosConsenso={datosConsenso} 
            setDatosConsenso={setDatosConsenso} 
          />
        )}
        {vistaActiva === 'mapa_graficas' && (
          <MapaGraficas 
            localidadActiva={localidadActiva} 
            datosConsenso={datosConsenso} 
          />
        )}
        {vistaActiva === 'reporte_sara' && <ReporteSara />}
      </main>

      {/* 3. Barra de Navegación Inferior (3 Botones) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40 pb-safe">
        <div className="max-w-md mx-auto flex justify-between items-center px-4 py-2">
          
          {/* Botón Izquierda: Mapa y Gráficas */}
          <button
            onClick={() => setVistaActiva('mapa_graficas')}
            className={`flex flex-col items-center gap-1 w-24 py-1 transition-colors ${vistaActiva === 'mapa_graficas' ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[10px] font-bold">Mapa</span>
          </button>

          {/* Botón Central: Sala Operativa */}
          <button
            onClick={() => {
              if (autenticado) setVistaActiva('operativo');
              else setOperativoAbierto(true);
            }}
            className="flex flex-col items-center gap-1 -mt-6 relative"
          >
            <div className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 border-4 border-slate-950 hover:scale-105 transition-transform">
              <img src="/icon.svg" alt="Escudo" className="w-8 h-8 filter brightness-0" />
            </div>
            <span className="text-[10px] font-bold text-amber-400 mt-1">Sala Operativa</span>
          </button>

          {/* Botón Derecha: Reporte SARA */}
          <button
            onClick={() => setVistaActiva('reporte_sara')}
            className={`flex flex-col items-center gap-1 w-24 py-1 transition-colors ${vistaActiva === 'reporte_sara' ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-bold">Reporte</span>
          </button>

        </div>
      </nav>

      {/* 4. Modal de Login de la Sala Operativa */}
      {operativoAbierto && !autenticado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/30 max-w-sm w-full p-6 rounded-2xl shadow-2xl text-center">
            <Lock className="w-10 h-10 text-rose-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Sala Operativa</h2>
            <p className="text-xs text-slate-400 mb-6">Acceso exclusivo para coordinadores y brigadistas.</p>
            
            <form onSubmit={intentarAccesoAlerta} className="space-y-4">
              <div className="relative">
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  placeholder="Clave de operador..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-800 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-bold border border-slate-700"
                />
                <button type="button" onClick={() => setMostrarPassword(!mostrarPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errorPassword && <p className="text-rose-400 text-xs flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Clave incorrecta.</p>}
              <button type="submit" className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition-colors">
                Entrar
              </button>
              <button type="button" onClick={() => setOperativoAbierto(false)} className="text-xs text-slate-400 hover:text-white w-full py-2">
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Vista Operativa (Pantalla completa) */}
      {autenticado && vistaActiva === 'operativo' && (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
           <div className="p-4 max-w-7xl mx-auto">
              <button onClick={() => setVistaActiva('inicio')} className="mb-4 text-xs bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-slate-300 font-bold border border-slate-700">
                ← Volver al Monitor
              </button>
              <SatRCOperativo alCerrarSesion={() => { setAutenticado(false); setVistaActiva('inicio'); }} />
           </div>
        </div>
      )}
    </div>
  );
}