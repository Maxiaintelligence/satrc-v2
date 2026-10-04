import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPin, ExternalLink } from 'lucide-react';

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
  const centroPorDefecto = [20.0806, -98.3681];
  const zoomPorDefecto = 9;

  const calcularCentro = () => {
    if (!evaluaciones || evaluaciones.length === 0) return centroPorDefecto;
    const itemsValidos = evaluaciones.filter(e => e?.donde?.coordenadas?.lat || e?.geografia?.coordenadas?.lat);
    if (!itemsValidos.length) return centroPorDefecto;

    const lats = itemsValidos.map(e => e.donde?.coordenadas?.lat ?? e.geografia?.coordenadas?.lat);
    const lons = itemsValidos.map(e => e.donde?.coordenadas?.lon ?? e.geografia?.coordenadas?.lon);
    const mediaLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const mediaLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    return [mediaLat, mediaLon];
  };

  const centroActual = calcularCentro();

  return (
    <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Cabecera del Mapa */}
      <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-bold text-sm md:text-base text-white">
              Cartografía Táctica de Comunidades Prioritarias
            </h3>
            <p className="text-[11px] text-slate-400">
              Ubicación georreferenciada de focos activos en la Arquidiócesis
            </p>
          </div>
        </div>

        {/* Leyenda de Semáforo */}
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className="flex items-center gap-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> N4 Emergencia
          </span>
          <span className="flex items-center gap-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-orange-400"></span> N3 Alerta
          </span>
          <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> N2 Vigilancia
          </span>
        </div>
      </div>

      {/* Contenedor Leaflet */}
      <div className="h-[420px] md:h-[500px] w-full relative z-0">
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
                radius={esFoco ? 13 : (item.nivel_alerta === 4 ? 10 : (item.nivel_alerta === 3 ? 8 : 5))}
                pathOptions={{
                  fillColor: item.color_alerta,
                  fillOpacity: esFoco ? 0.95 : 0.85,
                  color: esFoco ? '#FFFFFF' : '#000000',
                  weight: esFoco ? 3 : 1.5
                }}
                eventHandlers={{
                  click: () => {
                    if (alSeleccionarLocalidad) alSeleccionarLocalidad(item);
                  }
                }}
              >
                <Popup>
                  <div className="p-1 text-slate-900 min-w-[200px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span 
                        className="text-[9px] font-black px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: item.color_alerta }}
                      >
                        NIVEL {item.nivel_alerta} • {item.estado_alerta}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-sm text-slate-950 leading-tight">
                      {item.nombre}
                    </h4>
                    <p className="text-[11px] text-slate-600 mb-2">
                      {item.municipio}, {item.estado}
                    </p>

                    <div className="bg-slate-100 p-2 rounded-lg text-[10px] space-y-1 mb-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Diagnóstico:</span>
                        <span className="font-bold text-slate-800">{item.diagnostico?.titulo || item.que?.evento}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Saturación Suelo:</span>
                        <span className="font-bold text-rose-700">{item.impactoSistemico?.saturacionTotalSueloMm || item.tamano_impacto?.lluvia_acumulada_24h_mm} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Acceso:</span>
                        <span className="font-bold text-amber-700">{item.impactoSistemico?.accesoVial || item.tamano_impacto?.tipo_acceso}</span>
                      </div>
                    </div>

                    <p className="text-[10px] italic text-amber-800 mb-2">
                      {item.protocolo || "Consulte al coordinador de Cáritas"}
                    </p>

                    <button
                      onClick={() => alSeleccionarLocalidad(item)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-2 rounded-md text-[10px] flex items-center justify-center gap-1 transition-colors"
                    >
                      Enfocar en Pantalla <ExternalLink className="w-3 h-3 text-amber-400" />
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="p-3 bg-slate-950/80 text-xs text-slate-400 flex justify-between items-center px-4 border-t border-slate-800">
        <span>Haz clic en cualquier punto para enfocar la comunidad en la ficha ejecutiva.</span>
        <span className="font-mono text-slate-500">OpenStreetMap Humanitario • WGS84</span>
      </div>

    </div>
  );
}