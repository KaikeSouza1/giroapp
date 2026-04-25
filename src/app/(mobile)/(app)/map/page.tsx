// src/app/(mobile)/(app)/map/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import RouteCard from '@/components/mobile/RouteCard'

// Importa o CSS original do Leaflet para o mapa não ficar "torto"
import 'leaflet/dist/leaflet.css'

type Route = {
  id: string
  name: string
  description: string | null
  difficulty: string
  type: string
  distanceKm: string | null
  estimatedMinutes: number | null
  coverImageUrl: string | null
  status: string
  organizationName: string | null
  startLatitude: string | null
  startLongitude: string | null
}

export default function ExploreMapPage() {
  const router = useRouter()
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)

  // Refs para o Mapa e Carrossel
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const carouselRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Busca os Dados
  useEffect(() => {
    async function fetchMapData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      try {
        const res = await fetch('/api/routes', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (res.ok) {
          const data = await res.json()
          // Pegamos apenas rotas que tenham coordenada inicial válida
          const validRoutes = data.filter((r: Route) => r.startLatitude && r.startLongitude)
          setRoutes(validRoutes)
          
          if (validRoutes.length > 0) {
            setActiveRouteId(validRoutes[0].id)
          }
        }
      } catch (err) {
        console.error("Erro ao buscar rotas", err)
      } finally {
        setLoading(false)
      }
    }
    fetchMapData()
  }, [router, supabase.auth])

  // 2. Inicializa o Leaflet de forma dinâmica
  useEffect(() => {
    // Salvamos a referência numa variável local para o TypeScript não reclamar de null dentro do .then()
    const mapContainer = mapContainerRef.current;
    
    if (typeof window === 'undefined' || !mapContainer || loading || routes.length === 0) return;

    import('leaflet').then((L) => {
      // Cria o mapa apenas se não existir usando a variável não nula 'mapContainer'
      if (!mapRef.current) {
        mapRef.current = L.map(mapContainer, {
          zoomControl: false, // Esconde os botões +/- pra ficar clean
          attributionControl: false,
        }).setView([parseFloat(routes[0].startLatitude!), parseFloat(routes[0].startLongitude!)], 13);

        // Estilo de mapa Voyager (Limpo e Premium)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      // Limpa os marcadores antigos
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};

      // Adiciona os marcadores novos
      routes.forEach(route => {
        if (!route.startLatitude || !route.startLongitude) return;

        const lat = parseFloat(route.startLatitude);
        const lng = parseFloat(route.startLongitude);
        const isActive = activeRouteId === route.id;

        // Custom HTML Icon (Pino)
        const markerHtml = `
          <div style="
            width: ${isActive ? '40px' : '32px'}; 
            height: ${isActive ? '40px' : '32px'}; 
            background: ${isActive ? '#E05300' : '#1f2937'}; 
            border-radius: 50%; 
            border: 3px solid white; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: ${isActive ? '20px' : '14px'};
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform: translateY(${isActive ? '-5px' : '0'});
          ">📍</div>
        `;

        const icon = L.divIcon({
          html: markerHtml,
          className: 'custom-leaflet-marker', // Classe vazia, apenas pra resetar estilos do Leaflet
          iconSize: isActive ? [40, 40] : [32, 32],
          iconAnchor: isActive ? [20, 20] : [16, 16],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current);
        
        // Clicar no pino do mapa
        marker.on('click', () => {
          setActiveRouteId(route.id);
          
          // Move o carrossel até o card
          const cardEl = document.getElementById(`card-${route.id}`);
          if (cardEl && carouselRef.current) {
            isScrollingRef.current = true; // Pausa o sincronismo reverso
            const scrollPos = cardEl.offsetLeft - (window.innerWidth / 2) + (cardEl.offsetWidth / 2);
            carouselRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
            setTimeout(() => { isScrollingRef.current = false }, 500); // Libera depois de rolar
          }
        });

        markersRef.current[route.id] = marker;
      });

      // Animação FlyTo (Aproxima a câmera) quando o Active muda
      if (activeRouteId && markersRef.current[activeRouteId]) {
        const activeRoute = routes.find(r => r.id === activeRouteId);
        if (activeRoute && activeRoute.startLatitude && activeRoute.startLongitude) {
          mapRef.current.flyTo(
            [parseFloat(activeRoute.startLatitude), parseFloat(activeRoute.startLongitude)], 
            15, // Zoom de aproximação
            { duration: 0.8, easeLinearity: 0.25 }
          );
        }
      }

    });
  }, [routes, activeRouteId, loading]);

  // 3. Sincroniza o Scroll do Carrossel com o Mapa
  const handleCarouselScroll = () => {
    if (!carouselRef.current || isScrollingRef.current) return;
    
    const scrollLeft = carouselRef.current.scrollLeft;
    const centerPos = scrollLeft + window.innerWidth / 2;
    
    let closestId = activeRouteId;
    let minDistance = Infinity;

    routes.forEach(r => {
      const card = document.getElementById(`card-${r.id}`);
      if (card) {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(centerPos - cardCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestId = r.id;
        }
      }
    });

    if (closestId && closestId !== activeRouteId) {
      setActiveRouteId(closestId);
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden font-[family-name:var(--font-dm)]">
      
      {/* Ajustes CSS globais estritamente para os pinos do mapa e ocultação do banner do Leaflet */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-leaflet-marker { background: none; border: none; }
        .leaflet-control-attribution { display: none !important; }
      `}} />

      {/* Container do Mapa Real */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-[#E5E3DF]" />

      {/* Header com Botão Voltar */}
      <div className="absolute top-12 left-6 right-6 z-[400] flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => router.back()} 
          className="w-12 h-12 rounded-[18px] bg-white/95 backdrop-blur-md shadow-lg flex items-center justify-center border border-gray-100 pointer-events-auto active:scale-90 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        
        <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-full shadow-lg border border-gray-100 pointer-events-auto">
          <p className="text-[10px] font-black text-gray-900 tracking-widest uppercase">{routes.length} Encontradas</p>
        </div>
      </div>

      {/* Carrossel de Cards Flutuante */}
      <div className="absolute bottom-8 left-0 right-0 z-[400]">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin shadow-lg" />
          </div>
        ) : routes.length === 0 ? (
          <div className="mx-6 p-6 bg-white/95 backdrop-blur-md rounded-[32px] text-center shadow-2xl border border-gray-100">
            <span className="text-3xl block mb-2">🗺️</span>
            <p className="text-gray-900 font-black text-base">Nenhuma rota no mapa</p>
            <p className="text-gray-400 text-xs mt-1">As rotas precisam ter coordenadas de início para aparecerem aqui.</p>
          </div>
        ) : (
          <div 
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex gap-4 overflow-x-auto px-6 pb-6 pt-4 snap-x snap-mandatory scrollbar-hide"
          >
            {routes.map(route => (
              <div 
                key={route.id} 
                id={`card-${route.id}`}
                className="snap-center shrink-0 w-[85vw] transition-transform duration-300"
                style={{ 
                  transform: activeRouteId === route.id ? 'scale(1)' : 'scale(0.95)', 
                  opacity: activeRouteId === route.id ? 1 : 0.6 
                }}
                onClick={() => setActiveRouteId(route.id)}
              >
                <div className="pointer-events-auto shadow-2xl rounded-[32px] bg-white ring-4 ring-transparent transition-all"
                     style={{ borderColor: activeRouteId === route.id ? '#E05300' : 'transparent' }}>
                  <RouteCard {...route} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}