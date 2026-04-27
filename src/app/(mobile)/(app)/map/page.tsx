"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import RouteCard from "@/components/mobile/RouteCard";

import "leaflet/dist/leaflet.css";

type Route = {
  id: string;
  name: string;
  description: string | null;
  difficulty: string;
  type: string;
  distanceKm: string | null;
  estimatedMinutes: number | null;
  coverImageUrl: string | null;
  status: string;
  organizationName: string | null;
  startLatitude: string | null;
  startLongitude: string | null;
};

export default function ExploreMapPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const carouselRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchMapData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("/api/routes", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();

          const validRoutes = data.filter(
            (r: Route) => r.startLatitude && r.startLongitude
          );
          setRoutes(validRoutes);
          if (validRoutes.length > 0) setActiveRouteId(validRoutes[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do mapa", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMapData();
  }, [router, supabase.auth]);

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    if (
      typeof window === "undefined" ||
      !mapContainer ||
      loading ||
      routes.length === 0
    )
      return;

    import("leaflet").then((L) => {
      if (!mapRef.current) {
        mapRef.current = L.map(mapContainer, {
          zoomControl: false,
          attributionControl: false,
        }).setView(
          [
            parseFloat(routes[0].startLatitude!),
            parseFloat(routes[0].startLongitude!),
          ],
          14
        );

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
          }
        ).addTo(mapRef.current);
      }

      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      routes.forEach((route) => {
        if (!route.startLatitude || !route.startLongitude) return;

        const lat = parseFloat(route.startLatitude);
        const lng = parseFloat(route.startLongitude);
        const isActive = activeRouteId === route.id;

        const icon = L.divIcon({
          html: `
            <div style="
              width: ${isActive ? "42px" : "32px"}; 
              height: ${isActive ? "42px" : "32px"}; 
              background: ${isActive ? "#E05300" : "#1f2937"}; 
              border: 3px solid white; 
              border-radius: 50%; 
              box-shadow: 0 4px 15px rgba(0,0,0,0.3);
              display: flex; align-items: center; justify-content: center;
              transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              transform: translateY(${isActive ? "-6px" : "0"});
            ">📍</div>
          `,
          className: "custom-marker",
          iconSize: isActive ? [42, 42] : [32, 32],
          iconAnchor: isActive ? [21, 21] : [16, 16],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current);
        marker.on("click", () => {
          setActiveRouteId(route.id);
          const card = document.getElementById(`card-${route.id}`);
          if (card && carouselRef.current) {
            isScrollingRef.current = true;
            const scrollPos =
              card.offsetLeft - window.innerWidth / 2 + card.offsetWidth / 2;
            carouselRef.current.scrollTo({
              left: scrollPos,
              behavior: "smooth",
            });
            setTimeout(() => {
              isScrollingRef.current = false;
            }, 600);
          }
        });
        markersRef.current[route.id] = marker;
      });

      if (activeRouteId && markersRef.current[activeRouteId]) {
        const route = routes.find((r) => r.id === activeRouteId);
        if (route?.startLatitude) {
          mapRef.current.flyTo(
            [
              parseFloat(route.startLatitude),
              parseFloat(route.startLongitude!),
            ],
            15
          );
        }
      }
    });
  }, [routes, activeRouteId, loading]);

  const handleScroll = () => {
    if (!carouselRef.current || isScrollingRef.current) return;
    const center = carouselRef.current.scrollLeft + window.innerWidth / 2;
    let closest = activeRouteId;
    let minDistance = Infinity;

    routes.forEach((r) => {
      const card = document.getElementById(`card-${r.id}`);
      if (card) {
        const dist = Math.abs(
          center - (card.offsetLeft + card.offsetWidth / 2)
        );
        if (dist < minDistance) {
          minDistance = dist;
          closest = r.id;
        }
      }
    });
    if (closest !== activeRouteId) setActiveRouteId(closest);
  };

  return (
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden font-[family-name:var(--font-dm)]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-marker { background: none; border: none; }
        .leaflet-tile-pane { filter: saturate(1.1) brightness(0.98); }
      `,
        }}
      />

      <div
        ref={mapContainerRef}
        className="absolute inset-0 z-0 bg-[#f8f9fa]"
      />

      <div className="absolute top-12 left-6 right-6 z-[400] flex items-center justify-between pointer-events-none">
        <button
          onClick={() => router.back()}
          className="w-12 h-12 rounded-2xl bg-white/95 shadow-xl flex items-center justify-center border border-gray-100 pointer-events-auto active:scale-90 transition-transform"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#333"
            strokeWidth="3"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-full shadow-lg border border-gray-100 pointer-events-auto">
          <p className="text-[10px] font-black text-gray-900 tracking-widest uppercase">
            {routes.length} Ativas no Giro
          </p>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 z-[400]">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin shadow-lg" />
          </div>
        ) : (
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto px-6 pb-6 pt-4 snap-x snap-mandatory scrollbar-hide"
          >
            {routes.map((route) => (
              <div
                key={route.id}
                id={`card-${route.id}`}
                className="snap-center shrink-0 w-[85vw]"
                style={{
                  transform:
                    activeRouteId === route.id ? "scale(1)" : "scale(0.95)",
                  opacity: activeRouteId === route.id ? 1 : 0.6,
                }}
              >
                <div
                  className="pointer-events-auto shadow-2xl rounded-[32px] bg-white ring-4 ring-transparent transition-all"
                  style={{
                    borderColor:
                      activeRouteId === route.id ? "#E05300" : "transparent",
                  }}
                >
                  <RouteCard {...route} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
