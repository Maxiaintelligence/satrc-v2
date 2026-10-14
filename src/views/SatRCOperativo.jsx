import React, { useState, useEffect, useRef } from 'react';
import db from '../data/localidades.json';
import { consultarModelosDeterministas } from '../engine/meteoFetcher.js';
import { generarConsensoDeterminista } from '../engine/consensusEngine.js';
import { evaluarLocalidad } from '../engine/riskEvaluator.js';
import { construirResumenesRegionales, invalidarCache } from '../engine/reportesRegionales.js';
import RiskMap from '../components/RiskMap.jsx';
import SatelliteViewer from '../components/SatelliteViewer.jsx';
import {
  Radio,
  Power,
  Send,
  Bot,
  ScrollText,
  Clock,
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Mountain,
  Waves,
  Truck,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Layers,
  RotateCw,
  ShieldAlert,
  FileText,
  Printer,
  Sparkles,
  Share2,
  Check,
  ShieldCheck,
  CloudRain,
  Thermometer,
  Wind,
  Droplets,
  Eye,
  EyeOff,
  User
} from 'lucide-react';

const INTERVALO_REFRESCO_MS = 5 * 60 * 1000;
const INTERVALO_SMN_MS = 30 * 60 * 1000;

function formatearTimestamp(isoUtc) {
  if (!isoUtc) return null;
  try {
    const fecha = new Date(isoUtc);
    if (isNaN(fecha.getTime())) return null;
    const fechaMx = fecha.toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: 'short'
    });
    const horaMx = fecha.toLocaleTimeString('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${fechaMx} • ${horaMx} hrs`;
  } catch (e) {
    return null;
  }
}

/**
 * N12 — Extrae un resumen atmosférico real de la serie de consenso.
 * La serie tiene 240 h: índices 0-167 son las últimas 7 días pasadas,
 * índice 168 es "ahora" (aprox), y 168-239 son el pronóstico.
 */
function construirResumenAtmosferico(serie, nodoNombre) {
  if (!Array.isArray(serie) || serie.length < 192) return null;

  const ultimas24h = serie.slice(144, 168);   // 24 h antes de "ahora"
  const proximas24h = serie.slice(168, 192);  // 24 h de pronóstico

  const lluviaAcumulada24h = ultimas24h.reduce((a, h) => a + (h.lluvia_mm || 0), 0);
  const lluviaProyectada24h = proximas24h.reduce((a, h) => a + (h.lluvia_mm || 0), 0);

  const temps = ultimas24h.map(h => h.temperatura_c).filter(Number.isFinite);
  const vientos = ultimas24h.map(h => h.viento_kmh).filter(Number.isFinite);
  const rafagas = ultimas24h.map(h => h.rafagas_kmh).filter(Number.isFinite);
  const humedades = ultimas24h.map(h => h.humedad_relativa_pct).filter(Number.isFinite);
  const visibilidades = ultimas24h.map(h => h.visibility_km).filter(Number.isFinite);

  const actual = serie[168] || ultimas24h[ultimas24h.length - 1] || {};

  // Confiabilidad dominante en las últimas 24 h
  const cuentaConfiabilidad = { ALTA: 0, MODERADA: 0, EN_DISPUTA: 0 };
  ultimas24h.forEach(h => {
    if (h.confiabilidad && cuentaConfiabilidad[h.confiabilidad] !== undefined) {
      cuentaConfiabilidad[h.confiabilidad]++;
    }
  });
  const confiabilidadDominante = Object.entries(cuentaConfiabilidad)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'DESCONOCIDA';

  return {
    nodo_nombre: nodoNombre,
    ventana_analisis: 'últimas 24 horas',
    lluvia_acumulada_24h_mm: parseFloat(lluviaAcumulada24h.toFixed(1)),
    lluvia_proyectada_prox_24h_mm: parseFloat(lluviaProyectada24h.toFixed(1)),
    temperatura_min_c: temps.length ? parseFloat(Math.min(...temps).toFixed(1)) : null,
    temperatura_max_c: temps.length ? parseFloat(Math.max(...temps).toFixed(1)) : null,
    temperatura_actual_c: Number.isFinite(actual.temperatura_c) ? parseFloat(actual.temperatura_c.toFixed(1)) : null,
    viento_max_kmh: vientos.length ? parseFloat(Math.max(...vientos).toFixed(1)) : null,
    rafaga_max_kmh: rafagas.length ? parseFloat(Math.max(...rafagas).toFixed(1)) : null,
    humedad_min_pct: humedades.length ? Math.round(Math.min(...humedades)) : null,
    humedad_max_pct: humedades.length ? Math.round(Math.max(...humedades)) : null,
    visibilidad_min_km: visibilidades.length ? parseFloat(Math.min(...visibilidades).toFixed(1)) : null,
    confiabilidad_dominante: confiabilidadDominante
  };
}

export default function SatRCOperativo({ alCerrarSesion }) {
  const todasLocalidades = db.localidades || [];

  const [evaluaciones, setEvaluaciones] = useState([]);
  const [comunidadFoco, setComunidadFoco] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [filtroSemaforo, setFiltroSemaforo] = useState('NIVEL4');
  const [bandejaAbierta, setBandejaAbierta] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  const [dictamenSARA, setDictamenSARA] = useState(null);
  const [bitacoraSARA, setBitacoraSARA] = useState([]);
  const [modalBitacoraAbierto, setModalBitacoraAbierto] = useState(false);
  const [disparandoManual, setDisparandoManual] = useState(false);
  const [comunidadDetalle, setComunidadDetalle] = useState(null);

  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const [alertaSMN, setAlertaSMN] = useState(null);

  const [modalReporteOnDemandAbierto, setModalReporteOnDemandAbierto] = useState(false);
  const [generandoOnDemand, setGenerandoOnDemand] = useState(false);
  const [reporteVigente, setReporteVigente] = useState(null);

  // C2c — Estados del modal de clave de operador
  const [modalClaveOperadorAbierto, setModalClaveOperadorAbierto] = useState(false);
  const [claveOperadorInput, setClaveOperadorInput] = useState('');
  const [claveOperadorVisible, setClaveOperadorVisible] = useState(false);
  const [errorClaveOperador, setErrorClaveOperador] = useState(false);
  const [zonasFallidasTemporal, setZonasFallidasTemporal] = useState(null);
  
  const ADMIN_TOKEN = import.meta.env.VITE_SARA_ONDEMAND_TOKEN || "";

  const alertaSMNRef = useRef(null);
  useEffect(() => {
    alertaSMNRef.current = alertaSMN;
  }, [alertaSMN]);

  // C4 — Cargar alerta SMN
  useEffect(() => {
    let cancelado = false;

    async function cargarAlertaSMN() {
      try {
        const res = await fetch(`/api/smn?t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado && data.exito && data.alerta) {
          setAlertaSMN(data.alerta);
        }
      } catch (e) {
        console.warn("[SMN] No se pudo cargar la alerta oficial:", e.message);
      }
    }

    cargarAlertaSMN();
    const intervalo = setInterval(cargarAlertaSMN, INTERVALO_SMN_MS);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  const ejecutarEvaluacionRealEnVivo = async (alertaParaEvaluar = null) => {
    const nodoSierra = todasLocalidades.find(l => l.nombre.toLowerCase().includes('huauchinango')) || todasLocalidades[0];
    let serieConsenso = [];

    try {
      const resM = await consultarModelosDeterministas(nodoSierra.coords.lat, nodoSierra.coords.lon);
      if (resM?.exito && resM?.datos_horarios) {
        serieConsenso = generarConsensoDeterminista(resM.datos_horarios);
      }
    } catch (e) {}

    const resEvaluadas = todasLocalidades.map(loc => {
      try {
        return evaluarLocalidad(loc, serieConsenso, { alertaSMN: alertaParaEvaluar });
      } catch (err) {
        return null;
      }
    }).filter(Boolean);

    resEvaluadas.sort((a, b) => b.nivel_alerta - a.nivel_alerta);
    setEvaluaciones(resEvaluadas);
    setComunidadFoco(resEvaluadas[0] || null);
  };

  const cargarEstadoServidor = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    if (silencioso) setRefrescando(true);

    try {
      const res = await fetch(`/api/sara?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (res.ok) {
        const data = await res.json();

        if (data.dictamen) {
          setDictamenSARA(data.dictamen);
          if (data.dictamen.timestamp) {
            setUltimaActualizacion(data.dictamen.timestamp);
          }
        }
        if (data.bitacora) setBitacoraSARA(data.bitacora);
        if (data.ultimo_reporte_ondemand) setReporteVigente(data.ultimo_reporte_ondemand);

        if (data.evaluaciones && data.evaluaciones.length > 0) {
          setEvaluaciones(data.evaluaciones);
          setComunidadFoco(data.evaluaciones[0] || null);
        } else if (!silencioso) {
          await ejecutarEvaluacionRealEnVivo(alertaSMNRef.current);
        }
      } else if (!silencioso) {
        await ejecutarEvaluacionRealEnVivo(alertaSMNRef.current);
      }
    } catch (e) {
      if (!silencioso) {
        console.warn("Fallo en carga inicial, evaluando en vivo:", e.message);
        await ejecutarEvaluacionRealEnVivo(alertaSMNRef.current);
      } else {
        console.warn("Refresh silencioso falló:", e.message);
      }
    }

    if (!silencioso) setCargando(false);
    if (silencioso) setRefrescando(false);
  };

  const cargarEstadoRef = useRef();
  cargarEstadoRef.current = cargarEstadoServidor;

  useEffect(() => {
    cargarEstadoServidor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarEstadoRef.current?.(true);
      }
    }, INTERVALO_REFRESCO_MS);

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        cargarEstadoRef.current?.(true);
      }
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, []);

  // ============================================================
  // C2c — Generar Reporte On-Demand Regional
  // ============================================================

  const abrirModalClaveOperador = () => {
    setClaveOperadorInput('');
    setClaveOperadorVisible(false);
    setErrorClaveOperador(false);
    setZonasFallidasTemporal(null);
    setModalClaveOperadorAbierto(true);
  };

  const ejecutarGeneracionReporte = async (esModoEmergencia = false) => {
    if (!ADMIN_TOKEN) {
      alert("Error de configuración: VITE_SARA_ONDEMAND_TOKEN no está definido. Contacte al administrador.");
      return;
    }
    if (!claveOperadorInput.trim()) {
      setErrorClaveOperador(true);
      return;
    }

    setModalClaveOperadorAbierto(false);
    setGenerandoOnDemand(true);
    setModalReporteOnDemandAbierto(true);

    // Invalidar caché si es un reintento (segunda generación consecutiva)
    if (esModoEmergencia) {
      invalidarCache();
    }

    const n4 = evaluaciones.filter(e => e?.nivel_alerta === 4).length;
    const n3 = evaluaciones.filter(e => e?.nivel_alerta === 3).length;
    const n2 = evaluaciones.filter(e => e?.nivel_alerta === 2).length;
    const n1 = evaluaciones.filter(e => e?.nivel_alerta === 1).length;

    const focosN3N4 = evaluaciones.filter(e => (e?.nivel_alerta ?? 1) >= 3);
    const focos = (focosN3N4.length > 0
      ? focosN3N4
      : evaluaciones
          .filter(e => e?.nivel_alerta === 2)
          .sort((a, b) => (b?.impactoSistemico?.poblacionDirecta ?? 0) - (a?.impactoSistemico?.poblacionDirecta ?? 0))
    ).slice(0, 7).map(c => ({
      nombre: c.nombre,
      municipio: c.municipio,
      nivel: c.nivel_alerta,
      causa: c.diagnostico?.titulo,
      pendiente: `${c.geografia?.pendienteMax}°`,
      acceso: c.impactoSistemico?.accesoVial
    }));

    const alertaParaEnviar = (alertaSMN && alertaSMN.activo && alertaSMN.nivel >= 2)
      ? {
          activo: true,
          nivel: alertaSMN.nivel,
          severidad: alertaSMN.severidad,
          titulo: alertaSMN.titulo,
          descripcion: alertaSMN.descripcion,
          estados_afectados: alertaSMN.estados_afectados || [],
          rango_lluvia_min_mm: alertaSMN.rango_lluvia_min_mm,
          rango_lluvia_max_mm: alertaSMN.rango_lluvia_max_mm,
          fecha_sincronizacion: alertaSMN.fecha_sincronizacion
        }
      : null;

    // C2c — Construir los 14 resúmenes regionales
    let datosRegionales = null;
    try {
      datosRegionales = await construirResumenesRegionales();
    } catch (e) {
      console.warn("[C2c] No se pudieron construir los resúmenes regionales:", e.message);
    }

    if (!datosRegionales) {
      alert("No se pudieron obtener datos meteorológicos regionales. Verifique su conexión.");
      setGenerandoOnDemand(false);
      return;
    }

    // Caso límite: ninguna zona respondió
    if (datosRegionales.zonas_ok === 0) {
      alert("No se pudo conectar con Open-Meteo. Ninguna zona reportó datos. Verifique su conexión a internet e intente más tarde.");
      setGenerandoOnDemand(false);
      return;
    }

    // Si es modo normal y faltan zonas, mostrar error y opción de modo emergencia
    if (!esModoEmergencia && datosRegionales.zonas_ok < datosRegionales.zonas_totales) {
      setZonasFallidasTemporal(datosRegionales.zonas_fallidas);
      setGenerandoOnDemand(false);
      return;
    }

    try {
      const res = await fetch('/api/reporte-ondemand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': ADMIN_TOKEN,
          'x-user-key': claveOperadorInput
        },
        body: JSON.stringify({
          resumenSeveridad: { totalNivel4: n4, totalNivel3: n3, totalNivel2: n2, totalNivel1: n1 },
          focosCriticos: focos,
          alertaSMN: alertaParaEnviar,
          datosRegionales: datosRegionales,
          esModoEmergencia: esModoEmergencia
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reporte_guardado) setReporteVigente(data.reporte_guardado);
        if (data.registro_bitacora) {
          setBitacoraSARA(prev => [...prev, data.registro_bitacora]);
        }
        setZonasFallidasTemporal(null);
      } else if (res.status === 401) {
        setErrorClaveOperador(true);
        setModalClaveOperadorAbierto(true);
        setModalReporteOnDemandAbierto(false);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'No se pudo generar el reporte'}`);
      }
    } catch (e) {
      console.error("Error generando reporte On-Demand:", e);
      alert("Error de red. Verifique su conexión a internet.");
    }
    setGenerandoOnDemand(false);
  };

  const confirmarClaveOperador = () => {
    ejecutarGeneracionReporte(false);
  };

  const generarReporteParcial = () => {
    ejecutarGeneracionReporte(true);
  };

  const cerrarModalClaveOperador = () => {
    setModalClaveOperadorAbierto(false);
    setClaveOperadorInput('');
    setClaveOperadorVisible(false);
    setErrorClaveOperador(false);
  };

  const compartirPorWhatsApp = () => {
    if (!reporteVigente?.reporte) return;
    const r = reporteVigente.reporte;
    const textoMensaje = `🏛️ *REPORTE DIOCESANO DE SITUACIÓN • CÁRITAS TULANCINGO*\n` +
      `📅 *Emisión:* ${reporteVigente.fecha_dia_mexico} (${reporteVigente.hora_exacta_mexico} hrs)\n\n` +
      `*I. ATMÓSFERA REGIONAL:*\n${r.seccion_I_atmosfera}\n\n` +
      `*II. FOCOS CRÍTICOS EN SIERRA:*\n${r.seccion_II_focos_sierra}\n\n` +
      `*III. RECOMENDACIONES TÁCTICAS:*\n${r.seccion_V_recomendaciones_pastorales}\n\n` +
      `⛪ _Consulte al coordinador de Cáritas Diocesana._`;

    const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoMensaje)}`;
    window.open(urlWhatsApp, '_blank');
  };

  const descargarDocumentoOficial = () => {
    if (!reporteVigente?.reporte) return;
    const r = reporteVigente.reporte;
    const contenidoDoc = `================================================================================
CÁRITAS PASTORAL SOCIAL • ARQUIDIÓCESIS DE TULANCINGO
SISTEMA DE ALERTA TEMPRANA Y RIESGOS CLIMÁTICOS (SatRC V2.0) • AGENTE SARA
================================================================================
REPORTE DIOCESANO DE SITUACIÓN METEOROLÓGICA (ON-DEMAND)
Folio de Auditoría: ${reporteVigente.id_reporte}
Fecha de Emisión: ${reporteVigente.fecha_dia_mexico}
Hora Exacta de Emisión: ${reporteVigente.hora_exacta_mexico} (Hora del Centro de México)
Consenso de Modelos: ${reporteVigente.consenso_modelos}
--------------------------------------------------------------------------------

I. DINÁMICA ATMOSFÉRICA REGIONAL:
${r.seccion_I_atmosfera}

II. FOCOS PRIORITARIOS DE TENSIÓN EN LA SIERRA (NIVEL 4 Y NIVEL 3):
${r.seccion_II_focos_sierra}

III. CONDICIONES METEOROLÓGICAS EN EL ALTIPLANO Y VALLES:
${r.seccion_III_condiciones_altiplano}

IV. PRONÓSTICO DE EVOLUCIÓN (PRÓXIMAS 12 A 24 HORAS):
${r.seccion_IV_evolucion}

V. RECOMENDACIONES TÁCTICAS SEGÚN CONDICIONES ACTIVAS:
${r.seccion_V_recomendaciones_pastorales}

VI. AVISO INSTITUCIONAL Y COORDINACIÓN CON PROTECCIÓN CIVIL:
${r.seccion_VI_deslinde}

--------------------------------------------------------------------------------
Instrucción Diocesana: "Consulte al coordinador de Cáritas"
Documento oficial emitido para párrocos, brigadistas y autoridades de auxilio.
================================================================================`;

    const blob = new Blob([contenidoDoc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Diocesano_Caritas_${reporteVigente.fecha_dia_mexico.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totalNivel4 = evaluaciones.filter(e => e?.nivel_alerta === 4).length;
  const totalNivel3 = evaluaciones.filter(e => e?.nivel_alerta === 3).length;
  const totalNivel2 = evaluaciones.filter(e => e?.nivel_alerta === 2).length;
  const totalNivel1 = evaluaciones.filter(e => e?.nivel_alerta === 1).length;

  const comunidadesFiltradas = evaluaciones.filter(item => {
    if (!item) return false;
    if (filtroSemaforo === 'NIVEL4') return item.nivel_alerta === 4;
    if (filtroSemaforo === 'NIVEL3') return item.nivel_alerta === 3;
    if (filtroSemaforo === 'NIVEL2') return item.nivel_alerta === 2;
    if (filtroSemaforo === 'NIVEL1') return item.nivel_alerta === 1;
    return true;
  });

  const totalPaginas = Math.ceil(comunidadesFiltradas.length / itemsPorPagina) || 1;
  const itemsPaginados = comunidadesFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina
  );

  const obtenerTendencia = (item) => {
    const sat = item?.impactoSistemico?.saturacionTotalSueloMm ?? 0;
    const nivel = item?.nivel_alerta ?? 1;
    if (nivel >= 3 && sat >= 70) {
      return { texto: "Empeorando", icono: TrendingUp, color: "text-rose-400" };
    }
    if (nivel >= 2) {
      return { texto: "Estacionario", icono: Minus, color: "text-amber-400" };
    }
    return { texto: "Mejorando", icono: TrendingDown, color: "text-emerald-400" };
  };

  const textoUltimaActualizacion = formatearTimestamp(ultimaActualizacion);
  const hayAvisoSMNActivo = alertaSMN && alertaSMN.activo && alertaSMN.nivel >= 2;

  return (
    <div className="space-y-6">

      {/* 1. BARRA SUPERIOR DE MANDO */}
      <div className="bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-black text-white tracking-wide">
                Cuarto de Situación Diocesano
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                CRON AUTÓNOMO (ACTIVO)
              </span>
              {textoUltimaActualizacion && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800 text-amber-300 border-amber-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Datos: {textoUltimaActualizacion}
                </span>
              )}
              {hayAvisoSMNActivo && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  alertaSMN.nivel >= 3
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  <AlertTriangle className="w-3 h-3" />
                  CONAGUA N{alertaSMN.nivel}: {alertaSMN.titulo}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Cáritas Pastoral Social • Arquidiócesis de Tulancingo (405 Localidades)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => cargarEstadoServidor(true)}
            disabled={refrescando}
            title="Refrescar datos del servidor"
            className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-xs border border-slate-700 transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refrescando ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={abrirModalClaveOperador}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/25 border border-amber-400"
            title="Generar reporte diocesano en tiempo real"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>Generar Reporte On-Demand</span>
          </button>

          <button
            onClick={() => setModalBitacoraAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs border border-amber-500/30 transition-all shadow"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-400" />
            Bitácora SARA ({bitacoraSARA.length})
          </button>

          <button
            onClick={alCerrarSesion}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-medium border border-slate-700"
          >
            Salir
          </button>
        </div>
      </div>

      {/* 2. TARJETA DEL ÚLTIMO REPORTE */}
      {reporteVigente && (
        <div className="bg-slate-900 border-2 border-amber-500/40 p-4 rounded-2xl shadow-xl flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider block">
                  Último Reporte Diocesano Emitido en el Servidor
                </span>
                {(() => {
                  const origen = reporteVigente.origen || 'ON_DEMAND_OPERADOR';
                  const colores = {
                    PROGRAMADO_REPORTE_DIARIO: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/40', text: 'text-emerald-300', label: 'Automático' },
                    PROGRAMADO_CRON: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/40', text: 'text-emerald-300', label: 'Automático' },
                    ON_DEMAND_OPERADOR: { bg: 'bg-blue-600/20', border: 'border-blue-500/40', text: 'text-blue-300', label: 'On-Demand' },
                    ON_DEMAND_OPERADOR_REINTENTO: { bg: 'bg-amber-600/20', border: 'border-amber-500/40', text: 'text-amber-300', label: 'Reintento' }
                  };
                  const c = colores[origen] || colores.ON_DEMAND_OPERADOR;
                  return (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
                      {c.label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs md:text-sm font-bold text-white">
                Emitido el {reporteVigente.fecha_dia_mexico} a las {reporteVigente.hora_exacta_mexico} hrs
              </p>
              {reporteVigente.generado_por && (
                <p className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Generado por: {reporteVigente.generado_por}
                </p>
              )}
              <p className="text-[11px] text-slate-300 line-clamp-2 break-words">
                {reporteVigente.reporte?.seccion_I_atmosfera?.slice(0, 140)}...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalReporteOnDemandAbierto(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow"
            >
              Consultar / Exportar
            </button>
          </div>
        </div>
      )}

      {/* 3. SEMÁFORO INTERACTIVO — Grid 2x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* N1 Estables — verde */}
        <div
          onClick={() => { setFiltroSemaforo('NIVEL1'); setPaginaActual(1); }}
          className={`cursor-pointer rounded-xl p-4 shadow-lg transition-all flex flex-col items-center justify-center text-center ${filtroSemaforo === 'NIVEL1' ? 'scale-[1.02] ring-4 ring-white/30' : 'hover:scale-[1.01]'}`}
          style={{ backgroundColor: '#10B981' }}
        >
          <span className="text-4xl font-black text-white leading-none">{totalNivel1}</span>
          <span className="text-sm font-black text-white uppercase tracking-wide mt-2">N1 · Estables</span>
          <span className="text-xs text-white/90 mt-0.5">Altiplano en paz</span>
        </div>

        {/* N2 Vigilancia — ámbar */}
        <div
          onClick={() => { setFiltroSemaforo('NIVEL2'); setPaginaActual(1); }}
          className={`cursor-pointer rounded-xl p-4 shadow-lg transition-all flex flex-col items-center justify-center text-center ${filtroSemaforo === 'NIVEL2' ? 'scale-[1.02] ring-4 ring-white/30' : 'hover:scale-[1.01]'}`}
          style={{ backgroundColor: '#F59E0B' }}
        >
          <span className="text-4xl font-black text-white leading-none">{totalNivel2}</span>
          <span className="text-sm font-black text-white uppercase tracking-wide mt-2">N2 · Vigilancia</span>
          <span className="text-xs text-white/90 mt-0.5">Valles / Niebla</span>
        </div>

        {/* N3 Alerta Temprana — naranja */}
        <div
          onClick={() => { setFiltroSemaforo('NIVEL3'); setPaginaActual(1); }}
          className={`cursor-pointer rounded-xl p-4 shadow-lg transition-all flex flex-col items-center justify-center text-center ${filtroSemaforo === 'NIVEL3' ? 'scale-[1.02] ring-4 ring-white/30' : 'hover:scale-[1.01]'}`}
          style={{ backgroundColor: '#F97316' }}
        >
          <span className="text-4xl font-black text-white leading-none">{totalNivel3}</span>
          <span className="text-sm font-black text-white uppercase tracking-wide mt-2">N3 · Alerta Temprana</span>
          <span className="text-xs text-white/90 mt-0.5">Laderas 25° a 44°</span>
        </div>

        {/* N4 Emergencia — rojo */}
        <div
          onClick={() => { setFiltroSemaforo('NIVEL4'); setPaginaActual(1); }}
          className={`cursor-pointer rounded-xl p-4 shadow-lg transition-all flex flex-col items-center justify-center text-center ${filtroSemaforo === 'NIVEL4' ? 'scale-[1.02] ring-4 ring-white/30' : 'hover:scale-[1.01]'}`}
          style={{ backgroundColor: '#EF4444' }}
        >
          <span className="text-4xl font-black text-white leading-none">{totalNivel4}</span>
          <span className="text-sm font-black text-white uppercase tracking-wide mt-2">N4 · Emergencia</span>
          <span className="text-xs text-white/90 mt-0.5">Laderas ≥ 45°</span>
        </div>
      </div>

      {/* 4. DÚO TÁCTICO */}
      <div className="space-y-6">
        <RiskMap evaluaciones={evaluaciones} localidadFoco={comunidadFoco} alSeleccionarLocalidad={(item) => { setComunidadFoco(item); setComunidadDetalle(item); }} />
        <SatelliteViewer />
      </div>

      {/* 5. BANDEJA DE COMUNIDADES PAGINADA */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <button onClick={() => setBandejaAbierta(!bandejaAbierta)} className="w-full p-4 bg-slate-800/90 hover:bg-slate-800 flex justify-between items-center transition-colors text-left">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            Comunidades en: <strong className="text-amber-300">{filtroSemaforo}</strong> ({comunidadesFiltradas.length} encontradas)
          </span>
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
            {bandejaAbierta ? 'Contraer' : 'Desplegar Listado'}
            {bandejaAbierta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {bandejaAbierta && (
          <div className="border-t border-slate-800 animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Severidad</th>
                    <th className="py-3 px-3">Evolución</th>
                    <th className="py-3 px-3">Comunidad</th>
                    <th className="py-3 px-3">Municipio</th>
                    <th className="py-3 px-3">Saturación Suelo</th>
                    <th className="py-3 px-3">Vector Dominante</th>
                    <th className="py-3 px-3">Acceso Vial</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {itemsPaginados.map((item) => {
                    const tendencia = obtenerTendencia(item);
                    const IconoTendencia = tendencia.icono;

                    return (
                      <tr key={item?.localidad_id || Math.random()} onClick={() => setComunidadFoco(item)} className="hover:bg-slate-800/40 cursor-pointer transition-colors">
                        <td className="py-2.5 px-4"><span className="text-[10px] font-black px-2 py-0.5 rounded text-white shadow" style={{ backgroundColor: item?.color_alerta }}>Nivel {item?.nivel_alerta}</span></td>
                        <td className="py-2.5 px-3"><span className={`flex items-center gap-1 font-bold text-[10px] ${tendencia.color}`}><IconoTendencia className="w-3.5 h-3.5" />{tendencia.texto}</span></td>
                        <td className="py-2.5 px-3 font-extrabold text-white">{item?.nombre}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item?.municipio}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">{item?.impactoSistemico?.saturacionTotalSueloMm ?? 0} mm</td>
                        <td className="py-2.5 px-3 text-cyan-400 font-semibold">{item?.vector_dominante || item?.diagnostico?.titulo}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item?.impactoSistemico?.accesoVial}</td>
                        <td className="py-2.5 px-4 text-center">
                          <button onClick={(e) => { e.stopPropagation(); setComunidadFoco(item); setComunidadDetalle(item); }} className="text-[11px] font-bold text-amber-400 hover:text-white bg-slate-800 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg border border-slate-700 transition-all">Auditar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Mostrando <strong className="text-white">{(paginaActual - 1) * itemsPorPagina + 1}</strong> a <strong className="text-white">{Math.min(paginaActual * itemsPorPagina, comunidadesFiltradas.length)}</strong> de <strong className="text-white">{comunidadesFiltradas.length}</strong></span>
              <div className="flex items-center gap-2">
                <button disabled={paginaActual === 1} onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-300"><ChevronLeft className="w-4 h-4" /> Anterior</button>
                <span className="font-mono text-slate-300 px-2 font-bold">{paginaActual} / {totalPaginas}</span>
                <button disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-slate-300">Siguiente <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. MODAL DE REPORTE DIOCESANO ON-DEMAND */}
      {modalReporteOnDemandAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[92vh] print:max-h-none print:border-0 print:shadow-none print:text-black print:bg-white">

            <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-wrap justify-between items-center gap-2 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Reporte Diocesano Oficial • On-Demand (En Vivo)</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={compartirPorWhatsApp}
                  disabled={generandoOnDemand || !reporteVigente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Enviar WhatsApp</span>
                </button>

                <button
                  onClick={descargarDocumentoOficial}
                  disabled={generandoOnDemand || !reporteVigente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all border border-slate-600"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descargar Doc</span>
                </button>

                <button
                  onClick={() => window.print()}
                  disabled={generandoOnDemand || !reporteVigente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>

                <button onClick={() => setModalReporteOnDemandAbierto(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed font-sans print:p-6 print:text-xs">
{generandoOnDemand ? (
  <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    <p className="font-bold text-white text-sm">SARA redactando reporte en tiempo real...</p>
    <p className="text-[11px] text-slate-400">Consultando 14 zonas regionales. Esto puede tardar hasta 30 segundos en conexiones lentas.</p>
  </div>
) : zonasFallidasTemporal ? (
  <div className="p-8 text-center space-y-4">
    <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/20 rounded-full">
      <AlertTriangle className="w-6 h-6 text-amber-400" />
    </div>
    <div className="space-y-2">
      <h3 className="text-lg font-black text-white">Reporte no generado</h3>
      <p className="text-sm text-slate-300 leading-relaxed">
        El reporte requiere las 14 zonas completas, pero <strong className="text-amber-400">{zonasFallidasTemporal.length} zonas no respondieron</strong>:
      </p>
      <p className="text-xs text-slate-400 font-mono">{zonasFallidasTemporal.join(', ')}</p>
      <p className="text-xs text-slate-400 leading-relaxed pt-2">
        Esto puede deberse a la calidad de su conexión a internet. Si necesita el reporte ahora, puede generarlo en <strong className="text-amber-300">modo emergencia</strong> (parcial) e intentar de nuevo más tarde para obtener el completo.
      </p>
    </div>
    <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
      <button
        onClick={() => { setZonasFallidasTemporal(null); setModalReporteOnDemandAbierto(false); }}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
      >
        Cancelar
      </button>
      <button
        onClick={generarReporteParcial}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg"
      >
        Generar reporte parcial (modo emergencia)
      </button>
    </div>
  </div>
) : reporteVigente ? (
                <>
                  <div className="border-b-2 border-amber-500 pb-3 flex justify-between items-start">
                    <div>
                      <h1 className="text-base md:text-lg font-black text-white uppercase tracking-tight print:text-black">
                        Cáritas Pastoral Social • Arquidiócesis de Tulancingo
                      </h1>
                      <p className="text-xs text-amber-400 font-semibold print:text-amber-800">
                        Sistema de Alerta Temprana y Riesgos Climáticos (SatRC V2.0) • Agente SARA
                      </p>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-400 print:text-gray-600">
                      <p>Sello de Emisión: <strong>{reporteVigente.fecha_dia_mexico} a las {reporteVigente.hora_exacta_mexico} hrs</strong></p>
                      <p>Consenso: {reporteVigente.consenso_modelos}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-black text-amber-400 uppercase tracking-wider text-[11px] print:text-amber-900">
                      I. Dinámica Atmosférica Regional
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_I_atmosfera}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-black text-rose-400 uppercase tracking-wider text-[11px] print:text-rose-900">
                      II. Focos Prioritarios de Tensión en la Sierra (Nivel 4 y Nivel 3)
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_II_focos_sierra}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-black text-emerald-400 uppercase tracking-wider text-[11px] print:text-emerald-900">
                      III. Condiciones Meteorológicas en el Altiplano y Valles
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_III_condiciones_altiplano}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-black text-cyan-400 uppercase tracking-wider text-[11px] print:text-cyan-900">
                      IV. Pronóstico de Evolución (Próximas 12 a 24 Horas)
                    </h4>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 print:bg-gray-50 print:border-gray-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_IV_evolucion}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-black text-amber-300 uppercase tracking-wider text-[11px] print:text-amber-900">
                      V. Recomendaciones Tácticas según Condiciones Activas
                    </h4>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-slate-100 print:bg-amber-50 print:border-amber-300 print:text-gray-900">
                      {reporteVigente.reporte?.seccion_V_recomendaciones_pastorales}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 space-y-1 print:bg-gray-50 print:border-gray-200 print:text-gray-600">
                    <p className="font-bold text-slate-300 print:text-black">VI. Aviso Institucional y Coordinación con Protección Civil:</p>
                    <p>{reporteVigente.reporte?.seccion_VI_deslinde}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex justify-between items-end text-[10px] text-slate-500 print:border-gray-300 print:text-gray-600">
                    <p className="font-semibold text-amber-400 print:text-amber-900">Instrucción diocesana: "Consulte al coordinador de Cáritas"</p>
                    <div className="text-center font-mono">
                      <div className="w-36 border-b border-slate-600 mb-1 print:border-gray-400"></div>
                      <span>Sello de Guardia SatRC</span>
                    </div>
                  </div>
                </>
              ) : null}

            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL AUDITORÍA */}
      {comunidadDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-start" style={{ backgroundColor: `${comunidadDetalle?.color_alerta || '#10B981'}20` }}>
              <div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded text-white" style={{ backgroundColor: comunidadDetalle?.color_alerta }}>
                  NIVEL {comunidadDetalle?.nivel_alerta} • {comunidadDetalle?.estado_alerta}
                </span>
                <h2 className="text-xl font-black text-white mt-1">{comunidadDetalle?.nombre}</h2>
                <p className="text-xs text-slate-300">{comunidadDetalle?.municipio}, {comunidadDetalle?.estado} • Cuenca: {comunidadDetalle?.geografia?.cuenca}</p>
              </div>
              <button onClick={() => setComunidadDetalle(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
              {/* Diagnóstico Físico */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Diagnóstico Físico</p>
                <p className="text-sm font-bold text-white">{comunidadDetalle?.diagnostico?.titulo}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{comunidadDetalle?.diagnostico?.causa}</p>
              </div>

              {/* Condiciones Meteorológicas Actuales */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Condiciones Meteorológicas Actuales</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Lluvia 24h</span>
                    </div>
                    <span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.lluviaEvento24hMm ?? 0} mm</span>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Temp Mínima</span>
                    </div>
                    <span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.tempMinimaC ?? '--'} °C</span>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wind className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Ráfaga Máxima</span>
                    </div>
                    <span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.rafagaMaximaKmh ?? '--'} km/h</span>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Droplets className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Saturación Suelo</span>
                    </div>
                    <span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.saturacionTotalSueloMm ?? 0} mm</span>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">API 7 días</span>
                    </div>
                    <span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.apiPrevio7DiasMm ?? 0} mm</span>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Eye className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Visibilidad Mín</span>
                    </div>
                    <span className="text-base font-bold text-white">{comunidadDetalle?.impactoSistemico?.visibilidadMinKm ?? 10} km</span>
                  </div>
                </div>
              </div>

              {/* Protocolo */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                <p className="text-xs font-bold text-amber-300 italic">{comunidadDetalle?.protocolo || "Consulte al coordinador de Cáritas"}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center text-xs">
              <span className="text-slate-400">Población directa: <strong className="text-white">{comunidadDetalle?.impactoSistemico?.poblacionDirecta?.toLocaleString() ?? 0}</strong> habitantes</span>
              <button onClick={() => setComunidadDetalle(null)} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL BITÁCORA */}
      {modalBitacoraAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-slate-700 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 max-h-[85vh]">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <ScrollText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm md:text-base text-white">Bitácora Auditable de Operaciones • Agente SARA</h3>
                  <p className="text-[11px] text-slate-400">Almacén en Vercel Blob • Hash SHA-256 encadenado</p>
                </div>
              </div>
              <button onClick={() => setModalBitacoraAbierto(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 font-mono text-xs">
              {[...bitacoraSARA].reverse().map((entry) => (
                <div key={entry.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-amber-400 font-bold">{entry.fecha_dia_mexico ? `${entry.fecha_dia_mexico} • ${entry.hora_exacta_mexico}` : (entry.timestamp_local || entry.timestamp_iso || '(sin fecha)')} ({entry.id})</span>
                    <span className="text-slate-400 text-[10px]">Hash: <strong className="text-emerald-400">{entry.hash}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded font-bold">
                      {entry.origen_evento || "PROGRAMADO_CRON"}
                    </span>
                    <p className="text-white font-bold text-xs">{entry.titulo}</p>
                  </div>
                  {entry.generado_por && (
                    <p className="text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      Generado por: {entry.generado_por}
                    </p>
                  )}
                  <p className="text-slate-300 text-[11px] font-sans leading-relaxed">{entry.resumen}</p>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 px-4">
              <span>Preservación permanente en Vercel Blob.</span>
              <button onClick={() => setModalBitacoraAbierto(false)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CLAVE OPERADOR */}
      {modalClaveOperadorAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/40 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
            <div className="p-4 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h3 className="font-black text-sm text-white">Autenticación de Operador</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Ingrese su clave personal para generar el reporte diocesano. Su acción quedará registrada en la bitácora auditable.
              </p>
              <div className="relative">
                <input
                  type={claveOperadorVisible ? 'text' : 'password'}
                  value={claveOperadorInput}
                  onChange={(e) => { setClaveOperadorInput(e.target.value); setErrorClaveOperador(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarClaveOperador(); }}
                  placeholder="Clave de operador"
                  autoFocus
                  className={`w-full px-3 py-2.5 pr-10 bg-slate-950 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 ${errorClaveOperador ? 'border-rose-500' : 'border-slate-700'}`}
                />
                <button
                  type="button"
                  onClick={() => setClaveOperadorVisible(!claveOperadorVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-amber-400"
                >
                  {claveOperadorVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errorClaveOperador && (
                <p className="text-xs text-rose-400 font-semibold">Clave inválida. Intente de nuevo.</p>
              )}
            </div>
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={cerrarModalClaveOperador}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarClaveOperador}
                disabled={!claveOperadorInput.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black"
              >
                Generar Reporte
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}