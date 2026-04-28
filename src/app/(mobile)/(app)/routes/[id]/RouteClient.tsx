"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Waypoint = {
  id: string;
  name: string;
  description: string | null;
  latitude: string;
  longitude: string;
  order: number;
  radiusMeters: number;
  requiresSelfie: boolean;
};

type RouteDetail = {
  id: string;
  name: string;
  description: string | null;
  difficulty: string;
  type: string;
  distanceKm: string | null;
  estimatedMinutes: number | null;
  coverImageUrl: string | null;
  organizationName: string | null;
  waypoints: Waypoint[];
  polyline?: string | null; // Adicionado para suportar a estrada real
};

const difficultyLabel: Record<string, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
  extreme: "Extremo",
};
const difficultyColor: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
  extreme: "#7c3aed",
};

function decodePolyline(str: string, precision = 5): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

export default function RouteClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/routes/${resolvedParams.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      setRoute(data);
      setLoading(false);
    }
    load();
  }, [resolvedParams.id, router, supabase.auth]);

  useEffect(() => {
    if (!route || !mapContainerRef.current || mapRef.current) return;
    const currentRoute = route;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const firstWp = currentRoute.waypoints[0];
      const center: [number, number] = firstWp
        ? [parseFloat(firstWp.latitude), parseFloat(firstWp.longitude)]
        : [-27.5954, -48.548];

      const map = L.map(mapContainerRef.current!, {
        center,
        zoom: 14,
        zoomControl: false,
      });

      const initialUrl = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

      tileLayerRef.current = L.tileLayer(initialUrl, {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);

      // ADICIONA OS MARCADORES DOS WAYPOINTS PRIMEIRO
      currentRoute.waypoints.forEach((wp, i) => {
        const lat = parseFloat(wp.latitude);
        const lng = parseFloat(wp.longitude);
        const icon = L.divIcon({
          html: `<div style="background:linear-gradient(135deg,#830200,#E05300);color:white;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><span style="transform:rotate(45deg)">${
            i + 1
          }</span></div>`,
          className: "",
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${wp.name || `Ponto ${i + 1}`}</b>`);
      });

      let bounds: any = null;

      // ── SOLUÇÃO 1: LÓGICA PARA DESENHAR ESTRADA REAL OU FALLBACK AO VIVO ──
      if (currentRoute.polyline) {
        // Se a rota for nova e já tiver a polyline no banco
        const pathPoints = decodePolyline(currentRoute.polyline);

        L.polyline(pathPoints, {
          color: "#000",
          weight: 7,
          opacity: 0.15,
          lineJoin: "round",
        }).addTo(map);

        const line = L.polyline(pathPoints, {
          color: "#E05300",
          weight: 5,
          opacity: 0.9,
          lineJoin: "round",
        }).addTo(map);

        bounds = line.getBounds();
      } else if (currentRoute.waypoints && currentRoute.waypoints.length > 1) {
        // Se for rota antiga (sem polyline), o app recalcula ao vivo!
        try {
          let profile = "foot";
          if (currentRoute.type === "cicloturismo") profile = "bike";
          else if (currentRoute.type === "4x4" || currentRoute.type === "moto") profile = "driving";

          const coords = currentRoute.waypoints
            .sort((a, b) => a.order - b.order)
            .map((wp) => `${wp.longitude},${wp.latitude}`)
            .join(";");

          const res = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=polyline`);
          const data = await res.json();

          if (data.code === "Ok" && data.routes?.[0]) {
            const livePathPoints = decodePolyline(data.routes[0].geometry);

            L.polyline(livePathPoints, {
              color: "#000",
              weight: 7,
              opacity: 0.15,
              lineJoin: "round",
            }).addTo(map);

            const line = L.polyline(livePathPoints, {
              color: "#E05300",
              weight: 5,
              opacity: 0.9,
              lineJoin: "round",
            }).addTo(map);

            bounds = line.getBounds();
          } else {
            throw new Error("Falha no OSRM");
          }
        } catch (error) {
          // Último recurso: se o app estiver offline ou OSRM falhar, liga os pontos em linha reta pontilhada
          const latlngs: [number, number][] = currentRoute.waypoints.map((wp) => [
            parseFloat(wp.latitude),
            parseFloat(wp.longitude),
          ]);
          
          const line = L.polyline(latlngs, {
            color: "#E05300",
            weight: 3,
            opacity: 0.8,
            dashArray: "8, 6",
          }).addTo(map);
          
          bounds = line.getBounds();
        }
      }

      if (bounds) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      mapRef.current = map;
      setMapReady(true);
    }
    initMap();
  }, [route]);

  useEffect(() => {
    if (tileLayerRef.current) {
      const newUrl = isSatellite
        ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

      tileLayerRef.current.setUrl(newUrl);
    }
  }, [isSatellite]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{
            border: "3px solid #F0F0F0",
            borderTop: "3px solid #E05300",
          }}
        />
      </div>
    );

  if (!route)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-6">
        <div className="text-5xl">🗺️</div>
        <p className="text-gray-500 font-semibold">Rota não encontrada</p>
        <Link
          href="/home"
          className="text-sm font-bold"
          style={{ color: "#E05300" }}
        >
          ← Voltar
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-dm)]">
      <div className="relative h-64">
        {}
        <div ref={mapContainerRef} className="absolute inset-0" />

        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-[500]">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{
                border: "3px solid #F0F0F0",
                borderTop: "3px solid #E05300",
              }}
            />
          </div>
        )}

        {}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-[1000] w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          style={{ background: "white" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#333"
            strokeWidth="2.5"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {}
        <button
          onClick={() => setIsSatellite(!isSatellite)}
          className="absolute top-4 right-4 z-[1000] w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          style={{ background: isSatellite ? "#1F2937" : "white" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isSatellite ? "white" : "#333"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="3 6 12 11 21 6 12 1 3 6"></polygon>
            <polygon points="3 11 12 16 21 11"></polygon>
            <polygon points="3 16 12 21 21 16"></polygon>
          </svg>
        </button>
      </div>

      <div className="px-5 pt-5 pb-32">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-black text-gray-900 leading-tight flex-1">
            {route.name}
          </h1>
          <span
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: `${difficultyColor[route.difficulty]}15`,
              color: difficultyColor[route.difficulty],
            }}
          >
            {difficultyLabel[route.difficulty] ?? route.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded-md">
            {route.type}
          </span>
          {route.organizationName && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-orange-50 text-orange-600 uppercase tracking-wider">
              {route.organizationName}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            {
              icon: "📍",
              label: "Waypoints",
              value: `${route.waypoints.length}`,
            },
            {
              icon: "📏",
              label: "Distância",
              value: route.distanceKm ? `${route.distanceKm} km` : "—",
            },
            {
              icon: "⏱️",
              label: "Duração",
              value: route.estimatedMinutes
                ? route.estimatedMinutes >= 60
                  ? `${Math.floor(route.estimatedMinutes / 60)}h${
                      route.estimatedMinutes % 60 > 0
                        ? `${route.estimatedMinutes % 60}m`
                        : ""
                    }`
                  : `${route.estimatedMinutes}min`
                : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-3 text-center"
              style={{ background: "#F9F9F9", border: "1.5px solid #F0F0F0" }}
            >
              <p className="text-lg mb-0.5">{s.icon}</p>
              <p className="font-black text-gray-900 text-sm">{s.value}</p>
              <p className="text-gray-400 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>

        {route.description && (
          <div className="mb-5">
            <h2 className="text-sm font-black text-gray-900 mb-2">
              Sobre a rota
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              {route.description}
            </p>
          </div>
        )}

        {route.waypoints.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-black text-gray-900 mb-3">
              Pontos da trilha ({route.waypoints.length})
            </h2>
            <div className="relative">
              <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-gray-100" />
              <div className="flex flex-col gap-0">
                {route.waypoints.map((wp, i) => (
                  <div
                    key={wp.id}
                    className="flex items-start gap-4 py-3 relative"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white z-10"
                      style={{
                        background:
                          i === 0
                            ? "#830200"
                            : i === route.waypoints.length - 1
                            ? "#22c55e"
                            : "#E05300",
                      }}
                    >
                      {i === route.waypoints.length - 1 ? "🏁" : i + 1}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="font-bold text-gray-900 text-sm">
                        {wp.name || `Ponto ${i + 1}`}
                      </p>
                      {wp.description && (
                        <p className="text-gray-400 text-xs mt-0.5">
                          {wp.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400">
                          📍 {parseFloat(wp.latitude).toFixed(4)},{" "}
                          {parseFloat(wp.longitude).toFixed(4)}
                        </span>
                        {wp.requiresSelfie && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "#FFF0EB", color: "#E05300" }}
                          >
                            📸 Foto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-white border-t border-gray-100"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <Link
          href={`/routes/${route.id}/checkin`}
          className="block w-full py-4 rounded-2xl text-white font-black text-base text-center shadow-lg transition-all active:scale-[0.98]"
          style={{
            background:
              "linear-gradient(135deg, #830200 0%, #E05300 60%, #FF8C00 100%)",
          }}
        >
          Iniciar trilha
        </Link>
      </div>
    </div>
  );
}