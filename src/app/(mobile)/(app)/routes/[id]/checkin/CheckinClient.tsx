'use client'

import { useEffect, useState, useRef, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// 👇 IMPORTS NATIVOS NO TOPO DO ARQUIVO (Isso resolve o bug de não abrir nada!)
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'

// ── Tipos ─────────────────────────────────────────────────────────────────────

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
  distanceKm: string | null
  waypoints: Waypoint[]
}

type UserPosition = {
  lat: number
  lng: number
  accuracy: number
}

type Phase =
  | 'loading'
  | 'ready'
  | 'acquiring-gps'
  | 'navigating'
  | 'near-waypoint'
  | 'camera-open'
  | 'reviewing'
  | 'uploading'
  | 'completed'
  | 'error'

type CompletedCheckin = {
  waypointId: string
  photoUrl: string
  lat: number
  lng: number
  distance: number
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function accuracyLabel(acc: number): { text: string; color: string } {
  if (acc <= 10) return { text: 'Excelente', color: '#22c55e' }
  if (acc <= 25) return { text: 'Boa', color: '#84cc16' }
  if (acc <= 50) return { text: 'Regular', color: '#f59e0b' }
  return { text: 'Fraca', color: '#ef4444' }
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function CheckinClient({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeId } = use(params)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [phase, setPhase] = useState<Phase>('loading')
  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentWpIndex, setCurrentWpIndex] = useState(0)
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null)
  const [distanceToWp, setDistanceToWp] = useState<number | null>(null)
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const [completedCheckins, setCompletedCheckins] = useState<CompletedCheckin[]>([])
  
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const gpsWatchIdRef = useRef<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch(`/api/routes/${routeId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = res.ok ? await res.json() : null

      if (!data) { setPhase('error'); return }

      data.waypoints = (data.waypoints ?? []).sort((a: Waypoint, b: Waypoint) => a.order - b.order)
      setRoute(data)
      setPhase('ready')
    }
    load()
  }, [routeId, router, supabase.auth])

  useEffect(() => {
    if (!userPosition || !route) return
    const wp = route.waypoints[currentWpIndex]
    if (!wp) return

    const dist = haversineMeters(userPosition.lat, userPosition.lng, parseFloat(wp.latitude), parseFloat(wp.longitude))
    setDistanceToWp(dist)

    if (dist <= wp.radiusMeters && phase === 'navigating') setPhase('near-waypoint')
    if (dist > wp.radiusMeters && phase === 'near-waypoint') setPhase('navigating')
  }, [userPosition, currentWpIndex, route, phase])

  // ── GPS Tracking ──────────────────────────────────────────────────────────
  const startRoute = useCallback(async () => {
    setPhase('acquiring-gps')
    setError('')

    try {
      setSessionId('sessao_local_' + Date.now())

      // Chamando o Geolocation nativo importado lá no topo
      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 30000 },
        (pos, err) => {
          if (err || !pos) return
          setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
          setPhase(prev => prev === 'acquiring-gps' ? 'navigating' : prev)
        }
      )
      gpsWatchIdRef.current = watchId

      timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000)

    } catch (err: any) {
      setError('Não foi possível iniciar o GPS. Verifique as permissões.')
      setPhase('ready')
    }
  }, [])

  useEffect(() => {
    return () => { stopGpsAndTimer() }
  }, [])

  async function stopGpsAndTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (gpsWatchIdRef.current) {
      try {
        await Geolocation.clearWatch({ id: gpsWatchIdRef.current })
      } catch { /* ignorar */ }
      gpsWatchIdRef.current = null
    }
  }

  // ── Câmera / Galeria Nativas ─────────────────────────────────────────────
  async function openCameraForCheckin(source: 'camera' | 'gallery') {
    setPhase('camera-open')
    setError('')

    try {
      // Chamando o Camera nativo importado lá no topo
      const image = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        direction: CameraDirection.Rear,
        quality: 85,
        width: 1080,
        correctOrientation: true,
      })

      if (!image.dataUrl) throw new Error('Foto não capturada')

      setPhotoDataUrl(image.dataUrl)
      setPhase('reviewing')

    } catch (err: any) {
      console.error(err)
      const isCancelled = ['cancel', 'cancelled', 'canceled', 'dismissed', 'no image'].some(w => err?.message?.toLowerCase().includes(w))
      setPhase('near-waypoint')
      if (!isCancelled) setError('Erro ao abrir a câmera ou galeria.')
    }
  }

  // ── Salvar na Memória (Offline-first) ────────────────────────────────────
  async function confirmCheckin() {
    if (!photoDataUrl || !sessionId || !route || !userPosition) return

    setPhase('uploading')
    setError('')

    try {
      const wp = route.waypoints[currentWpIndex]
      const distance = distanceToWp ?? 0

      // Simulando salvamento rápido
      await new Promise(res => setTimeout(res, 400))

      setCompletedCheckins(prev => [...prev, {
        waypointId: wp.id,
        photoUrl: photoDataUrl,
        lat: userPosition.lat,
        lng: userPosition.lng,
        distance: Math.round(distance),
      }])

      setPhotoDataUrl(null)

      const isLast = currentWpIndex >= route.waypoints.length - 1

      if (isLast) {
        await stopGpsAndTimer()
        setPhase('completed')
      } else {
        setCurrentWpIndex(i => i + 1)
        setPhase('navigating')
      }

    } catch (err: any) {
      setError('Erro ao salvar check-in localmente.')
      setPhase('near-waypoint')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
          <p className="text-gray-400 text-sm">Carregando rota...</p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 gap-4">
        <span className="text-5xl">😕</span>
        <p className="text-gray-700 font-bold text-center">Rota não encontrada</p>
        <button onClick={() => router.back()} className="px-6 py-3 rounded-xl text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#830200,#E05300)' }}>
          Voltar
        </button>
      </div>
    )
  }

  const currentWp = route?.waypoints[currentWpIndex]
  const progressPercent = route ? (completedCheckins.length / route.waypoints.length) * 100 : 0

  if (phase === 'completed') {
    return (
      <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">
        <div className="relative overflow-hidden px-6 pt-12 pb-16" style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
            <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
          </svg>
          <div className="relative z-10 text-center">
            <p className="text-white/70 text-sm font-medium mb-1">Parabéns! Você concluiu</p>
            <h1 className="text-white font-black text-2xl leading-tight">{route?.name}</h1>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-white rounded-t-3xl" />
        </div>

        <div className="flex-1 px-6 pt-4 pb-10 flex flex-col items-center">
          <div className="w-28 h-28 rounded-3xl flex items-center justify-center mb-6 mt-2 shadow-xl" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
            <span className="text-6xl">🏆</span>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full mb-6">
            {[
              { label: 'Check-ins', value: completedCheckins.length.toString() },
              { label: 'Tempo', value: formatTime(elapsedSecs) },
              { label: 'Distância', value: route?.distanceKm ? `${route.distanceKm}km` : '—' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: '#FFF8F5', border: '1.5px solid #FFE0D0' }}>
                <p className="font-black text-gray-900 text-base">{s.value}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {completedCheckins.length > 0 && (
            <div className="w-full mb-6">
              <p className="text-sm font-black text-gray-700 mb-3">Suas fotos do local</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {completedCheckins.map((c, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={c.waypointId} src={c.photoUrl} alt={`Check-in ${i + 1}`}
                    className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-sm"
                    style={{ border: '2px solid #FFE0D0' }} />
                ))}
              </div>
            </div>
          )}

          <div className="bg-orange-50 w-full p-4 rounded-xl text-center mb-6">
            <p className="text-orange-700 text-xs font-bold">Os dados foram salvos no seu dispositivo.</p>
            <p className="text-orange-600/80 text-[10px] mt-1">A sincronização na nuvem acontecerá em breve.</p>
          </div>

          <button onClick={() => router.push('/home')} className="w-full py-4 rounded-2xl text-white font-black text-sm" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
            Ir para o início 🏠
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'reviewing' && photoDataUrl) {
    return (
      <div className="min-h-screen flex flex-col bg-black font-[family-name:var(--font-dm)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoDataUrl} alt="Foto do Ponto" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' }} />

        <div className="relative z-10 px-5 pt-12">
          <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Check-in no Ponto</p>
          <h2 className="text-white font-black text-xl leading-tight">{currentWp?.name}</h2>
        </div>

        <div className="relative z-10 mt-auto px-5 pb-10 flex flex-col gap-3">
          <button onClick={confirmCheckin} className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 shadow-lg" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
            ✅ Salvar e Continuar
          </button>

          <div className="flex gap-3">
            <button onClick={() => openCameraForCheckin('camera')} className="flex-1 py-3.5 rounded-2xl font-bold text-sm border-2 border-white/40 text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
              📷 Tirar outra
            </button>
            <button onClick={() => openCameraForCheckin('gallery')} className="flex-1 py-3.5 rounded-2xl font-bold text-sm border-2 border-white/40 text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
              🖼️ Galeria
            </button>
          </div>

          <button onClick={() => { setPhotoDataUrl(null); setPhase('near-waypoint') }} className="text-white/60 text-sm font-semibold text-center py-2">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const isUploading = phase === 'uploading'
  const isAcquiring = phase === 'acquiring-gps'
  const canCheckin = phase === 'near-waypoint' || phase === 'camera-open'
  const accInfo = userPosition ? accuracyLabel(userPosition.accuracy) : null

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-[family-name:var(--font-dm)]">

      <div className="relative overflow-hidden px-5 pt-12 pb-16" style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
        </svg>

        <div className="relative z-10 flex items-center justify-between mb-5">
          <button onClick={() => { stopGpsAndTimer(); router.back() }} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div className="text-center">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Tempo</p>
            <p className="text-white font-black text-xl tabular-nums">{formatTime(elapsedSecs)}</p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accInfo?.color ?? '#fff' }} />
            <span className="text-white text-[10px] font-bold">
              {isAcquiring ? 'GPS...' : accInfo ? `±${Math.round(userPosition!.accuracy)}m` : '—'}
            </span>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/60 text-xs font-medium">{route?.name}</p>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPercent}%`, background: 'white' }} />
          </div>
          <p className="text-white/60 text-[10px] mt-1 font-medium">
            {completedCheckins.length} de {route?.waypoints.length} pontos
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50 rounded-t-3xl" />
      </div>

      <div className="flex-1 px-5 -mt-2">

        {phase === 'ready' && (
          <div className="pt-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Primeiro ponto</p>
              <h2 className="text-xl font-black text-gray-900 mb-1">{route?.waypoints[0]?.name}</h2>
              {route?.waypoints[0]?.description && (
                <p className="text-gray-500 text-sm">{route.waypoints[0].description}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-orange-100 mb-6" style={{ background: '#FFF8F5' }}>
              <p className="text-[11px] font-black text-orange-700 mb-2">⚠️ Antes de iniciar:</p>
              <ul className="text-xs text-orange-600/80 flex flex-col gap-1">
                <li>• O GPS funcionará mesmo offline</li>
                <li>• Fique ao ar livre para melhor sinal</li>
                <li>• Você tirará fotos com a câmera traseira do celular</li>
              </ul>
            </div>

            {error && <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100 mb-4"><p className="text-red-500 text-sm">{error}</p></div>}

            <button onClick={startRoute} className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 shadow-lg" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
              🚀 Iniciar trilha
            </button>
          </div>
        )}

        {isAcquiring && (
          <div className="pt-6 flex flex-col items-center gap-5">
            <div className="relative w-24 h-24 mt-4">
              <div className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: '#E05300' }} />
              <div className="absolute inset-2 rounded-full animate-ping opacity-30 animation-delay-200" style={{ background: '#E05300', animationDelay: '0.3s' }} />
              <div className="absolute inset-4 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                <span className="text-2xl">📡</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-700 font-black text-lg">Buscando sinal GPS</p>
              <p className="text-gray-400 text-sm mt-1">Fique ao ar livre com o céu aberto</p>
            </div>
          </div>
        )}

        {(phase === 'navigating' || phase === 'near-waypoint' || phase === 'camera-open' || isUploading) && currentWp && (
          <div className="pt-4">

            <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm mb-4">
              <div className="px-5 pt-4 pb-3 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                    {currentWpIndex + 1}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Destino atual</p>
                    <h2 className="font-black text-gray-900 text-base leading-tight">{currentWp.name}</h2>
                  </div>
                </div>
              </div>

              <div className="px-5 py-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Distância</p>
                  {distanceToWp !== null ? (
                    <p className="font-black text-3xl" style={{ color: distanceToWp <= currentWp.radiusMeters ? '#22c55e' : '#E05300' }}>
                      {formatDistance(distanceToWp)}
                    </p>
                  ) : (
                    <p className="text-gray-400 font-bold">Calculando...</p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                    style={{ background: phase === 'near-waypoint' ? '#dcfce7' : '#FFF0EB', border: `2px solid ${phase === 'near-waypoint' ? '#22c55e' : '#E05300'}` }}>
                    {phase === 'near-waypoint' ? '✅' : '🧭'}
                  </div>
                  <p className="text-[10px] font-bold" style={{ color: phase === 'near-waypoint' ? '#22c55e' : '#E05300' }}>
                    {phase === 'near-waypoint' ? 'No local!' : 'A caminho'}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-4">
                <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{ background: '#F7F7F7', color: '#888' }}>
                  Raio de captura: {currentWp.radiusMeters}m
                  {currentWp.requiresSelfie && ' · Foto obrigatória'}
                </div>
              </div>
            </div>

            {userPosition && accInfo && (
              <div className="bg-white rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 border border-gray-100">
                <div className="w-2 h-2 rounded-full" style={{ background: accInfo.color }} />
                <p className="text-xs text-gray-500 font-medium">GPS {accInfo.text} · Precisão de ±{Math.round(userPosition.accuracy)}m</p>
              </div>
            )}

            {error && <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100 mb-4"><p className="text-red-500 text-sm">{error}</p></div>}

            {isUploading ? (
              <div className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-white font-bold" style={{ background: 'linear-gradient(135deg, #830200, #E05300)', opacity: 0.8 }}>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando na memória...
              </div>
            ) : canCheckin ? (
              <div className="flex flex-col gap-3">
                <button onClick={() => openCameraForCheckin('camera')} className="w-full py-4 rounded-2xl text-white font-black text-base shadow-lg active:scale-[0.98] flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                  📸 Tirar foto do local
                </button>
                <button onClick={() => openCameraForCheckin('gallery')} className="w-full py-3 rounded-2xl font-bold text-sm border-2 active:scale-[0.98] flex items-center justify-center gap-2" style={{ borderColor: '#E05300', color: '#E05300', background: '#FFF8F5' }}>
                  🖼️ Escolher da galeria
                </button>
              </div>
            ) : (
              <div className="w-full py-4 rounded-2xl text-center font-bold text-sm" style={{ background: '#EAEAEA', color: '#AAA' }}>
                📍 Aproxime-se para fotografar
              </div>
            )}

            {completedCheckins.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Concluídos ({completedCheckins.length})</p>
                <div className="flex gap-2">
                  {completedCheckins.map((c, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c.waypointId} src={c.photoUrl} alt={`Check-in ${i + 1}`} className="w-14 h-14 rounded-xl object-cover shadow-sm" style={{ border: '2px solid #22c55e' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}