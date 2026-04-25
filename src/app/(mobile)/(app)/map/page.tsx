// src/app/(mobile)/(app)/map/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import RouteCard from '@/components/mobile/RouteCard'

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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
          // Filtra rotas que têm coordenada inicial
          const validRoutes = data.filter((r: Route) => r.startLatitude && r.startLongitude)
          setRoutes(validRoutes)
          if (validRoutes.length > 0) setActiveRouteId(validRoutes[0].id)
        }
      } catch (err) {
        console.error("Erro ao buscar rotas para o mapa", err)
      } finally {
        setLoading(false)
      }
    }
    fetchMapData()
  }, [router, supabase.auth])

  return (
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden font-[family-name:var(--font-dm)]">
      
      {/* ==========================================
          AREA DO MAPA
          (Substitua esta div pelo seu <MapContainer> do Leaflet ou Google Maps)
          ========================================== */}
      <div className="absolute inset-0 z-0 bg-[#E5E3DF]">
        {/* Um fundo simulando o mapa enquanto você não pluga a lib oficial */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#830200 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        
        {/* Pinos Mockados (Simulando os waypoints no mapa) */}
        {routes.map((route) => (
          <button 
            key={route.id}
            onClick={() => setActiveRouteId(route.id)}
            className={`absolute flex items-center justify-center transition-all duration-300 ${activeRouteId === route.id ? 'scale-125 z-20' : 'scale-100 z-10'}`}
            // Posições randômicas apenas para o placeholder visual, no mapa real você usará as coordenadas (route.startLatitude)
            style={{ 
              top: `${Math.random() * 50 + 20}%`, 
              left: `${Math.random() * 70 + 10}%` 
            }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${activeRouteId === route.id ? 'bg-orange-600' : 'bg-gray-800'}`}>
              <span className="text-white text-xs">📍</span>
            </div>
          </button>
        ))}
      </div>

      {/* Header Transparente com Botão Voltar */}
      <div className="absolute top-12 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => router.back()} 
          className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md shadow-xl flex items-center justify-center border border-gray-100 pointer-events-auto active:scale-90 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-gray-100 pointer-events-auto">
          <p className="text-xs font-black text-gray-900 tracking-widest uppercase">{routes.length} Rotas Encontradas</p>
        </div>
      </div>

      {/* Carrossel de Cards Flutuante (Estilo Airbnb) */}
      <div className="absolute bottom-6 left-0 right-0 z-10">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin shadow-lg" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto px-6 pb-6 pt-2 snap-x snap-mandatory scrollbar-hide">
            {routes.map(route => (
              <div 
                key={route.id} 
                className="snap-center shrink-0 w-[85vw] transition-transform duration-300"
                style={{ transform: activeRouteId === route.id ? 'scale(1)' : 'scale(0.95)', opacity: activeRouteId === route.id ? 1 : 0.7 }}
                onClick={() => setActiveRouteId(route.id)}
              >
                <div className="pointer-events-auto shadow-2xl rounded-[32px]">
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