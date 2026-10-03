import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPin, ExternalLink } from 'lucide-react';

function ControladorCamara({ centro, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (centro) {
      map.flyTo(centro, zoom, { duration: 1.2 });
    }
  }, [centro, zoom, map]);
  return null;
}

export default function RiskMap({ evaluaciones, localidadFoco, alSeleccionarLocalidad }) {
  const centroPorDefecto = [20.0806, -98.3681];
  const zoomPorDefecto = 10;

  const calcularCentro = () => {
    if (!evaluaciones || evaluaciones.length === 0) return centroPorDefecto;
    const lats = evaluaciones.map(e => e.donde.coordenadas.lat);
    const lons = evaluaciones.map(e => e.donde.coordenadas.lon);
    const mediaLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const mediaLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    return [mediaLat, mediaLon];
  };

  const centroActual = calcularCentro();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      
      {/* Cabecera del Mapa */}
      <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-bold text-sm md:text-base text-white">
              Cartografía Táctica de Amenazas Comunitarias
            </h3>
            <p className="text-[11px] text-slate-400">
              Ubicación georreferenciada de las comunidades en monitoreo activo
            </p>
          </div>
        </div>

        {/* Leyenda del Semáforo */}
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> N1 Normal
          </span>
          <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> N2 Vigilancia
          </span>
          <span className="flex items-center gap-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-orange-400"></span> N3 Alerta
          </span>
          <span className="flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> N4 Emergencia
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
          {/* Capa Humanitaria OpenStreetMap HOT: 100% Libre, Cero API Key, Sin Marcas de Agua */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Humanitarian OpenStreetMap Team'
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <ControladorCamara centro={centroActual} zoom={zoomPorDefecto} />

          {evaluaciones.map((item) => {
            const { lat, lon } = item.donde.coordenadas;
            if (!lat || !lon) return null;

            const esFoco = localidadFoco?.localidad_id === item.localidad_id;

            return (
              <CircleMarker
                key={item.localidad_id}
                center={[lat, lon]}
                radius={esFoco ? 12 : (item.nivel_alerta >= 3 ? 9 : 6)}
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
                        <span className="text-slate-500">Relieve:</span>
                        <span className="font-bold text-slate-800">{item.donde.tipo_relieve} ({item.donde.pendiente_max_grados}°)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Población:</span>
                        <span className="font-bold text-slate-800">{item.tamano_impacto.poblacion_directa.toLocaleString()} hab.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Acceso:</span>
                        <span className="font-bold text-amber-700">{item.tamano_impacto.tipo_acceso}</span>
                      </div>
                    </div>

                    <p className="text-[10px] font-semibold text-rose-700 mb-2 leading-tight">
                      ⚠️ {item.que.evento}
                    </p>

                    <button
                      onClick={() => alSeleccionarLocalidad(item)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-2 rounded-md text-[10px] flex items-center justify-center gap-1 transition-colors"
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

      <div className="p-3 bg-slate-950/80 text-xs text-slate-400 flex justify-between items-center px-4 border-t border-slate-800">
        <span>Haz clic en cualquier punto para ver el diagnóstico territorial de esa comunidad.</span>
        <span className="font-mono text-slate-500">OpenStreetMap Humanitarian • WGS84</span>
      </div>

    </div>
  );
}