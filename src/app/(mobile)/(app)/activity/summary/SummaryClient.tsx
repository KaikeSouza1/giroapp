'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  useActivityStore,
  formatPace,
  formatElapsed,
  ACTIVITY_META,
} from '@/store/activityStore'

export default function SummaryClient() {
  const router = useRouter()
  const store = useActivityStore()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const isInitRef = useRef(false) // Trava para evitar que o mapa renderize duas vezes e quebre
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const {
    activityType,
    coordinates,
    startTime,
    pausedDuration,
    distanceKm,
    currentPaceSecPerKm,
  } = store

  // Total active time
  const totalMs = startTime
    ? (store.pauseStartTime
        ? store.pauseStartTime
        : Date.now()) - startTime - pausedDuration
    : 0

  const avgPaceSec = distanceKm > 0 ? totalMs / 1000 / distanceKm : 0
  const avgSpeedKmH = totalMs > 0 ? distanceKm / (totalMs / 3_600_000) : 0
  const meta = activityType ? ACTIVITY_META[activityType] : null

  useEffect(() => {
    // Garante que o status pare, sem dar "flicker" redirecionando pra trás
    if (store.status === 'running' || store.status === 'pausado') {
       store.stopActivity()
    }
    
    if (isInitRef.current) return
    isInitRef.current = true
    
    initMap()
  }, [])

  async function initMap() {
    if (!mapContainerRef.current || mapRef.current) return
    // Evita o crash "Map container is already initialized" do Leaflet
    if ((mapContainerRef.current as any)._leaflet_id) return 

    const L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')

    const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map)

    if (coordinates.length > 0) {
      const latlngs = coordinates.map((c) => [c.lat, c.lng] as [number, number])

      L.polyline(latlngs, {
        color: '#FF6B35',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)

      // Start dot
      const startIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#22C55E;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        className: '', iconSize: [14, 14], iconAnchor: [7, 7],
      })
      L.marker(latlngs[0], { icon: startIcon }).addTo(map)

      // End dot
      if (latlngs.length > 1) {
        const endIcon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#EF4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
          className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        })
        L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map)
      }

      // IMPORTANTE: Timeout pro Leaflet calcular o tamanho da tela do celular antes de focar
      setTimeout(() => {
        map.invalidateSize()
        if (latlngs.length > 1) {
            map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })
        } else {
            map.setView(latlngs[0], 16)
        }
      }, 100)

    } else {
      map.setView([-23.5505, -46.6333], 15) // Fallback caso não tenha gravado nada
    }

    mapRef.current = map
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Não autenticado')

      // CORREÇÃO: URL correta e payload formatado igual ao que o Drizzle espera
      const res = await fetch('/api/activities/save-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          activityType: activityType,
          startedAt: new Date(startTime!).toISOString(),
          completedAt: new Date().toISOString(),
          durationSeconds: Math.floor(totalMs / 1000),
          totalDistanceKm: distanceKm.toFixed(4),
          averagePace: formatPace(avgPaceSec),
          pathCoordinates: coordinates.map((c) => ({ lat: c.lat, lng: c.lng, ts: c.timestamp })),
          // A imagem só vai ser enviada na próxima tela (Share)
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Falha ao salvar atividade')
      }
      
      const data = await res.json()
      
      // Guarda o ID que o banco gerou no Zustand para a tela de Share poder atualizar a foto
      if (data.id) {
         store.setLastSavedActivityId(data.id)
      }

      router.replace('/activity/share')
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  function handleDiscard() {
    store.resetActivity()
    router.replace('/home')
  }

  if (!meta) return null

  return (
    <div
      className="min-h-screen flex flex-col font-[family-name:var(--font-dm)]"
      style={{ background: '#080808' }}
    >
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-6">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,197,94,0.2) 0%, transparent 70%)' }}
        />
        <p className="relative text-white/40 text-xs uppercase tracking-widest font-bold mb-1">
          {meta.emoji} Atividade Concluída
        </p>
        <h1
          className="relative font-black text-4xl"
          style={{
            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {formatElapsed(totalMs)}
        </h1>
        <p className="relative text-white/40 text-sm font-semibold mt-1">{meta.label}</p>
      </div>

      {/* Map */}
      <div className="mx-5 rounded-3xl overflow-hidden relative" style={{ height: 220 }}>
        {/* Placeholder escuro para evitar flicker antes do mapa aparecer */}
        <div className="absolute inset-0 bg-[#111]" />
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 px-5 mt-4">
        {[
          { label: 'Distância', value: `${distanceKm.toFixed(2)} km`, icon: '📏' },
          { label: 'Pace médio', value: `${formatPace(avgPaceSec)} /km`, icon: '⚡' },
          { label: 'Velocidade', value: `${avgSpeedKmH.toFixed(1)} km/h`, icon: '🏎️' },
          { label: 'Tempo ativo', value: formatElapsed(totalMs), icon: '⏱️' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-xl mb-1">{s.icon}</p>
            <p className="text-white font-black text-xl leading-none">{s.value}</p>
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-red-900/30 border border-red-500/30">
          <p className="text-red-400 text-sm font-bold text-center">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 mt-6 pb-12 flex flex-col gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #830200, #E05300)', boxShadow: '0 8px 28px rgba(224,83,0,0.35)' }}
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Salvar &amp; Criar Post
            </>
          )}
        </button>

        <button
          onClick={handleDiscard}
          className="w-full py-3.5 rounded-2xl font-bold text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Descartar atividade
        </button>
      </div>
    </div>
  )
}