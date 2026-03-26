'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

type Waypoint = {
  id: string
  name: string
  description: string | null
  latitude: string
  longitude: string
  order: number
  radiusMeters: number
  requiresSelfie: boolean
}

type RouteDetail = {
  id: string
  name: string
  description: string | null
  difficulty: string
  type: string
  distanceKm: string | null
  estimatedMinutes: number | null
  coverImageUrl: string | null
  organizationName: string | null
  waypoints: Waypoint[]
}

const difficultyLabel: Record<string, string> = {
  easy: 'Fácil', medium: 'Médio', hard: 'Difícil', extreme: 'Extremo'
}
const difficultyColor: Record<string, string> = {
  easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444', extreme: '#7c3aed'
}

export default function RouteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch(`/api/routes/${params.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : null
      setRoute(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  // Inicializa mapa quando a rota carregar
  useEffect(() => {
    if (!route || !mapContainerRef.current || mapRef.current) return

    const currentRoute = route

    async function initMap() {
      const L = (await import('leaflet')).default
      
      // @ts-expect-error
      await import('leaflet/dist/leaflet.css')

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const firstWp = currentRoute.waypoints[0]
      const center: [number, number] = firstWp
        ? [parseFloat(firstWp.latitude), parseFloat(firstWp.longitude)]
        : [-27.5954, -48.548]

      const map = L.map(mapContainerRef.current!, { center, zoom: 14, zoomControl: false })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      const latlngs: [number, number][] = []

      currentRoute.waypoints.forEach((wp, i) => {
        const lat = parseFloat(wp.latitude)
        const lng = parseFloat(wp.longitude)
        latlngs.push([lat, lng])

        const icon = L.divIcon({
          html: `<div style="
            background:linear-gradient(135deg,#830200,#E05300);
            color:white;width:28px;height:28px;
            border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            display:flex;align-items:center;justify-content:center;
            font-weight:bold;font-size:11px;border:2px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
          "><span style="transform:rotate(45deg)">${i + 1}</span></div>`,
          className: '', iconSize: [28, 28], iconAnchor: [14, 28],
        })

        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${wp.name || `Ponto ${i+1}`}</b>`)
      })

      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: '#E05300', weight: 3, opacity: 0.8, dashArray: '8, 6'
        }).addTo(map)
        map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] })
      }

      mapRef.current = map
      setMapReady(true)
    }

    initMap()
  }, [route])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
      </div>
    )
  }

  if (!route) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-6">
        <div className="text-5xl">🗺️</div>
        <p className="text-gray-500 font-semibold">Rota não encontrada</p>
        <Link href="/home" className="text-sm font-bold" style={{ color: '#E05300' }}>
          ← Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-dm)]">

      <div className="relative h-64">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full animate-spin"
              style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
          </div>
        )}

        <button onClick={() => router.back()}
          className="absolute top-4 left-4 z-[1000] w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'white' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      <div className="px-5 pt-5 pb-32">

        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-black text-gray-900 leading-tight flex-1">{route.name}</h1>
          <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: `${difficultyColor[route.difficulty]}15`,
              color: difficultyColor[route.difficulty]
            }}>
            {difficultyLabel[route.difficulty] ?? route.difficulty}
          </span>
        </div>

        {/* Informações da Organização e Tipo - Adicionadas aqui */}
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
            { icon: '📍', label: 'Waypoints', value: `${route.waypoints.length}` },
            { icon: '📏', label: 'Distância', value: route.distanceKm ? `${route.distanceKm} km` : '—' },
            { icon: '⏱️', label: 'Duração', value: route.estimatedMinutes
              ? route.estimatedMinutes >= 60
                ? `${Math.floor(route.estimatedMinutes / 60)}h${route.estimatedMinutes % 60 > 0 ? `${route.estimatedMinutes % 60}m` : ''}`
                : `${route.estimatedMinutes}min`
              : '—' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3 text-center"
              style={{ background: '#F9F9F9', border: '1.5px solid #F0F0F0' }}>
              <p className="text-lg mb-0.5">{s.icon}</p>
              <p className="font-black text-gray-900 text-sm">{s.value}</p>
              <p className="text-gray-400 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>

        {route.description && (
          <div className="mb-5">
            <h2 className="text-sm font-black text-gray-900 mb-2">Sobre a rota</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{route.description}</p>
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
                  <div key={wp.id} className="flex items-start gap-4 py-3 relative">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white z-10"
                      style={{ background: i === 0 ? '#830200' : i === route.waypoints.length - 1 ? '#22c55e' : '#E05300' }}>
                      {i === route.waypoints.length - 1 ? '🏁' : i + 1}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="font-bold text-gray-900 text-sm">
                        {wp.name || `Ponto ${i + 1}`}
                      </p>
                      {wp.description && (
                        <p className="text-gray-400 text-xs mt-0.5">{wp.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400">
                          📍 {parseFloat(wp.latitude).toFixed(4)}, {parseFloat(wp.longitude).toFixed(4)}
                        </span>
                        {wp.requiresSelfie && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#FFF0EB', color: '#E05300' }}>
                            📸 Selfie
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

      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <Link href={`/routes/${route.id}/checkin`}
          className="block w-full py-4 rounded-2xl text-white font-black text-base text-center shadow-lg transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #830200 0%, #E05300 60%, #FF8C00 100%)' }}>
          🚀 Iniciar trilha
        </Link>
      </div>
    </div>
  )
}