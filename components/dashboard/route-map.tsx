"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";

// [Certo] Leaflet exige acesso a `window`/`document` — este componente só
// pode ser usado dentro de um componente client, nunca renderizado no servidor.
// Os ícones default do Leaflet apontam para URLs relativas que não existem
// no bundle do Next — corrige-se isto definindo os ícones manualmente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitBounds({ route }: { route: [number, number][] }) {
  // Hook simples: ajusta o zoom/centro ao percurso quando o mapa monta.
  useEffect(() => {
    // O ajuste real é feito via `bounds` na MapContainer abaixo;
    // este efeito existe só para satisfazer regras de hooks caso se
    // queira animar/recalcular no futuro.
  }, [route]);
  return null;
}

export function RouteMap({ route }: { route: [number, number][] }) {
  if (route.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 text-sm text-slate-500">
        Sem dados de GPS para esta atividade.
      </div>
    );
  }

  return (
    <div className="h-64 overflow-hidden rounded-xl border border-slate-800">
      <MapContainer
        bounds={route as [number, number][]}
        boundsOptions={{ padding: [20, 20] }}
        style={{ height: "100%", width: "100%", background: "#0f172a" }}
        scrollWheelZoom={false}
      >
        <FitBounds route={route} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <Polyline positions={route} pathOptions={{ color: "#fb923c", weight: 3 }} />
        <CircleMarker center={route[0]} radius={5} pathOptions={{ color: "#fb923c", fillColor: "#fb923c", fillOpacity: 1 }} />
      </MapContainer>
    </div>
  );
}
