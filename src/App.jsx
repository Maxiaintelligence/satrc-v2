import React, { useState } from 'react';
import MonitorPublico from './views/MonitorPublico.jsx';
import SatRCOperativo from './views/SatRCOperativo.jsx';
import { 
  ShieldAlert, 
  Activity, 
  Lock, 
  ExternalLink, 
  Church, 
  CloudSun,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function App() {
  const [moduloActivo, setModuloActivo] = useState('monitor'); // 'monitor' o 'alerta'
  const [autenticado, setAutenticado] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorPassword, setErrorPassword] = useState(false);

  // Clave operativa para Cáritas / Operadores
  const CLAVE_ACCESO_OPERATIVO = 'emergencia';

  const intentarAccesoAlerta = (e) => {
    e.preventDefault();
    if (passwordInput === CLAVE_ACCESO_OPERATIVO) {
      setAutenticado(true);
      setErrorPassword(false);
    } else {
      setErrorPassword(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 1. Barra de Respaldo Oficial Nacional */}
      <div className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px] py-1.5 px-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Sincronización Oficial: <strong>SMN • CONAGUA • CENAPRED • NOAA</strong></span>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <a href="https://smn.conagua.gob.mx" target="_blank" rel="noreferrer" className="hover:text-amber-400 flex items-center gap-1 transition-colors">
            Portal SMN <ExternalLink className="w-3 h-3" />
          </a>
          <span>•</span>
          <span className="text-slate-500">Costo Cero • Dominio Público</span>
        </div>
      </div>

      {/* 2. Cabecera Institucional Cáritas Pastoral Social */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Logo e Identidad Oficial Cáritas Tulancingo */}
          <div className="flex items-center gap-3">
            <img 
              src="/icon.svg" 
              alt="Pastoral Social Arquidiócesis de Tulancingo" 
              className="w-12 h-12 rounded-full shadow-lg shadow-amber-900/30 border border-amber-500/40 object-cover bg-white"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg md:text-xl font-black tracking-tight text-white">SatRC</span>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">V2.0</span>
              </div>
              <p className="text-xs text-slate-400">
                Sistema de Alerta Temprana • Cáritas Pastoral Social • Arquidiócesis de Tulancingo
              </p>
            </div>
          </div>

          {/* Selector de los 2 Módulos Principales */}
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setModuloActivo('monitor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                moduloActivo === 'monitor'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CloudSun className="w-4 h-4" />
              1. Monitor Climático (Público)
            </button>

            <button
              onClick={() => setModuloActivo('alerta')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                moduloActivo === 'alerta'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              2. SatRC / Alerta Temprana
            </button>
          </div>

        </div>
      </header>

      {/* 3. Contenedor Principal */}
      <main className="max-w-7xl w-full mx-auto px-4 py-6 flex-1">
        {moduloActivo === 'monitor' ? (
          // Vista Pública
          <MonitorPublico />
        ) : (
          // Vista de Alerta Temprana (Control con Clave)
          !autenticado ? (
            <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center">
              <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl mx-auto flex items-center justify-center mb-4">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Acceso a Sala Operativa SatRC</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Este módulo es para coordinadores de albergues, párrocos y brigadistas de Cáritas Pastoral Social. Requiere clave de autorización.
              </p>
              
              <form onSubmit={intentarAccesoAlerta} className="space-y-4">
                <div>
                  <input
                    type="password"
                    placeholder="Introduce la clave operativa..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-center tracking-widest"
                  />
                  {errorPassword && (
                    <p className="text-rose-400 text-xs mt-2 flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Clave incorrecta.
                    </p>
                  )}
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-rose-600/20"
                >
                  Entrar a Consola Operativa
                </button>
              </form>
              <p className="text-[11px] text-slate-500 mt-4">
                * Para propósitos de este entorno de desarrollo, la clave es: <span className="font-mono text-slate-400">Caritas2026</span>
              </p>
            </div>
          ) : (
            <SatRCOperativo alCerrarSesion={() => setAutenticado(false)} />
          )
        )}
      </main>

      {/* 4. Pie de Página Institucional */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 px-4 text-xs mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div>
            <p className="font-bold text-slate-300">SatRC V2.0 • Sistema de Alerta Temprana y Riesgos Climáticos</p>
            <p className="text-slate-500">Cáritas Pastoral Social • Arquidiócesis de Tulancingo (Hidalgo, Puebla, Veracruz)</p>
          </div>
          <div className="text-[11px] text-slate-500 max-w-md">
            Plataforma orientativa sin fines de lucro. Los avisos oficiales de Protección Civil y CONAGUA prevalecen ante cualquier decisión civil.
          </div>
        </div>
      </footer>

    </div>
  );
}