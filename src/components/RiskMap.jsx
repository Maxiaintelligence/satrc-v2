import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPin, ExternalLink, Clock, Users, Mountain, AlertTriangle, ShieldCheck } from 'lucide-react';

function ControladorCamara({ centro, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (centro && Array.isArray(centro) && centro.length === 2 && !isNaN(centro[0]) && !isNaN(centro[1])) {
      map.flyTo(centro, zoom, { duration: 1.2 });
    }
  }, [centro, zoom, map]);
  return null;
}

export default function RiskMap({ evaluaciones, localidadFoco, alSeleccionarLocalidad }) {
  const centroPorDefecto = [20.15, -98.15]; // Centrado sobre la zona de impacto de la Sierra de Puebla / Hidalgo
  const zoomPorDefecto = 9;

  const calcularCentro = () => {
    if (!evaluaciones || evaluaciones.length === 0) return centroPorDefecto;
    const itemsValidos = evaluaciones.filter(e => e?.donde?.coordenadas?.lat || e?.geografia?.coordenadas?.lat);
    if (!itemsValidos.length) return centroPorDefecto;

    // Si hay una localidad en foco, centrar sobre ella
    if (localidadFoco?.donde?.coordenadas?.lat) {
      return [localidadFoco.donde.coordenadas.lat, localidadFoco.donde.coordenadas.lon];
    }

    const lats = itemsValidos.map(e => e.donde?.coordenadas?.lat ?? e.geografia?.coordenadas?.lat);
    const lons = itemsValidos.map(e => e.donde?.coordenadas?.lon ?? e.geografia?.coordenadas?.lon);
    const mediaLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const mediaLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    return [mediaLat, mediaLon];
  };

  const centroActual = calcularCentro();

  return (
    <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Cabecera Limpia del Mapa */}
      <div className="p-3.5 bg-slate-800/90 border-b border-slate-700 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="font-bold text-xs md:text-sm text-white tracking-wide">
            Cartografía Táctica de Amenazas Diocesanas
          </h3>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            (Toca cualquier punto para ver el diagnóstico físico)
          </span>
        </div>

        {/* Leyenda Compacta */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className="flex items-center gap-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> N4 Emergencia
          </span>
          <span className="flex items-center gap-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-orange-400"></span> N3 Alerta
          </span>
          <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> N2 Vigilancia
          </span>
          <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> N1 Normal
          </span>
        </div>
      </div>

      {/* Contenedor del Mapa */}
      <div className="h-[440px] md:h-[520px] w-full relative z-0">
        <MapContainer
          center={centroActual}
          zoom={zoomPorDefecto}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Humanitarian OpenStreetMap Team'
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <ControladorCamara centro={centroActual} zoom={zoomPorDefecto} />

          {evaluaciones && evaluaciones.map((item) => {
            const coords = item?.donde?.coordenadas || item?.geografia?.coordenadas;
            if (!coords?.lat || !coords?.lon) return null;

            const esFoco = localidadFoco?.localidad_id === item.localidad_id;

            return (
              <CircleMarker
                key={item.localidad_id}
                center={[coords.lat, coords.lon]}
                radius={esFoco ? 13 : (item.nivel_alerta === 4 ? 9.5 : (item.nivel_alerta === 3 ? 7.5 : 4.5))}
                pathOptions={{
                  fillColor: item.color_alerta,
                  fillOpacity: esFoco ? 1 : 0.85,
                  color: esFoco ? '#FFFFFF' : '#000000',
                  weight: esFoco ? 3 : 1.2
                }}
                eventHandlers={{
                  click: () => {
                    if (alSeleccionarLocalidad) alSeleccionarLocalidad(item);
                  }
                }}
              >
                {/* TARJETA TÁCTICA AL TOCAR EL PUNTO: QUÉ, CUÁNDO Y MAGNITUD */}
                <Popup className="satrc-popup-tactico">
                  <div className="p-2 text-slate-900 min-w-[240px] max-w-[280px] space-y-2">
                    
                    {/* Encabezado */}
                    <div className="flex justify-between items-start gap-2 border-b pb-1.5">
                      <div>
                        <h4 className="font-black text-sm text-slate-950 leading-tight">
                          {item.nombre}
                        </h4>
                        <p className="text-[10px] text-slate-600 font-semibold">
                          {item.municipio}, {item.estado}
                        </p>
                      </div>
                      <span 
                        className="text-[9px] font-black px-2 py-0.5 rounded text-white shadow shrink-0"
                        style={{ backgroundColor: item.color_alerta }}
                      >
                        Nivel {item.nivel_alerta}
                      </span>
                    </div>

                    {/* Las 3 Respuestas Concretas */}
                    <div className="space-y-1.5 text-[11px] leading-tight text-slate-800">
                      
                      {/* QUÉ SUCEDE */}
                      <div className="bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                        <span className="text-[9px] uppercase font-black text-slate-500 block">Amenaza Activa</span>
                        <strong className="text-slate-950 font-bold block mt-0.5">
                          {item.diagnostico?.titulo || item.que?.evento}
                        </strong>
                        <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                          {item.diagnostico?.causa?.slice(0, 110) || item.que?.descripcion?.slice(0, 110)}...
                        </p>
                      </div>

                      {/* CUÁNDO */}
                      <div className="flex justify-between items-center text-[10px] bg-slate-50 px-2 py-1 rounded border">
                        <span className="text-slate-500 font-semibold">Ventana de Acción:</span>
                        <span className="font-bold text-amber-800">
                          {item.tiempos?.ventanaAccionHoras || item.cuando?.ventana_evacuacion_horas} horas
                        </span>
                      </div>

                      {/* MAGNITUD */}
                      <div className="text-[10px] space-y-0.5 pt-0.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Población expuesta:</span>
                          <strong className="text-slate-950">{(item.impactoSistemico?.poblacionDirecta || item.tamano_impacto?.poblacion_directa)?.toLocaleString()} hab.</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Acceso vial:</span>
                          <strong className="text-amber-800">{item.impactoSistemico?.accesoVial || item.tamano_impacto?.tipo_acceso}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Hospital cercano:</span>
                          <strong className="text-slate-800">{item.impactoSistemico?.distanciaHospitalKm || item.tamano_impacto?.distancia_hospital_km} km</strong>
                        </div>
                      </div>

                    </div>

                    {/* Botón para abrir la ficha completa */}
                    <button
                      onClick={() => alSeleccionarLocalidad(item)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-2 rounded-lg text-[10px] flex items-center justify-center gap-1.5 transition-colors shadow"
                    >
                      Auditar Ficha Completa <ExternalLink className="w-3 h-3 text-amber-400" />
                    </button>

                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

    </div>
  );
}