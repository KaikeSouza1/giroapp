'use client'

// ─────────────────────────────────────────────────────────────────────────────
// src/app/(mobile)/(app)/routes/[id]/checkin/CheckinClient.tsx
//
// PÁGINA DE EXECUÇÃO DA ROTA
// Fluxo completo: GPS em tempo real → chegou no waypoint → selfie/galeria →
// upload → próximo waypoint → rota concluída.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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

// Máquina de estados da execução — cada fase representa uma tela diferente
type Phase =
  | 'loading'         // carregando dados da rota
  | 'ready'           // dados carregados, aguardando início
  | 'acquiring-gps'   // GPS ativado, aguardando primeiro fix
  | 'navigating'      // GPS ativo, usuário a caminho do waypoint
  | 'near-waypoint'   // dentro do raio — botão de check-in habilitado
  | 'camera-open'     // aguardando resposta da câmera
  | 'reviewing'       // foto tirada, mostrando preview antes de confirmar
  | 'uploading'       // enviando selfie + salvando check-in no servidor
  | 'completed'       // todos os waypoints concluídos 🎉
  | 'error'

type CompletedCheckin = {
  waypointId: string
  selfieUrl: string
  lat: number
  lng: number
  distance: number
}

// ── Utilitários ───────────────────────────────────────────────────────────────

/** Fórmula de Haversine: distância entre dois pontos GPS em metros */
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

/** Converte base64 puro (sem prefixo data:) para Blob */
function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mimeType })
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function CheckinClient({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeId } = use(params)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ── Estado principal ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading')
  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentWpIndex, setCurrentWpIndex] = useState(0)
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null)
  const [distanceToWp, setDistanceToWp] = useState<number | null>(null)
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const [completedCheckins, setCompletedCheckins] = useState<CompletedCheckin[]>([])
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null) // preview
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)   // sem prefixo
  const [error, setError] = useState('')

  // ── Refs (valores que não devem re-renderizar) ─────────────────────────────
  const gpsWatchIdRef = useRef<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const userIdRef = useRef<string | null>(null)
  const authTokenRef = useRef<string | null>(null)

  // ── Carrega rota ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      authTokenRef.current = session.access_token

      const res = await fetch(`/api/routes/${routeId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = res.ok ? await res.json() : null

      if (!data) { setPhase('error'); return }

      // Ordena waypoints por order
      data.waypoints = (data.waypoints ?? []).sort((a: Waypoint, b: Waypoint) => a.order - b.order)
      setRoute(data)
      setPhase('ready')
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  // ── Recalcula distância ao waypoint atual sempre que posição ou waypoint muda
  useEffect(() => {
    if (!userPosition || !route) return
    const wp = route.waypoints[currentWpIndex]
    if (!wp) return

    const dist = haversineMeters(
      userPosition.lat, userPosition.lng,
      parseFloat(wp.latitude), parseFloat(wp.longitude)
    )
    setDistanceToWp(dist)

    // Dentro do raio → muda fase para "pode fazer check-in"
    // Só muda se estiver navegando (evita resetar se já estiver em outra fase)
    if (dist <= wp.radiusMeters && phase === 'navigating') {
      setPhase('near-waypoint')
    }
    // Saiu do raio (pode ter melhorado o GPS): volta para navegando
    if (dist > wp.radiusMeters && phase === 'near-waypoint') {
      setPhase('navigating')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, currentWpIndex, route])

  // ── Inicia GPS e cria sessão no servidor ──────────────────────────────────
  const startRoute = useCallback(async () => {
    setPhase('acquiring-gps')
    setError('')

    try {
      // 1. Cria sessão no servidor
      const sessRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId }),
      })
      if (!sessRes.ok) throw new Error('Falha ao criar sessão')
      const { id } = await sessRes.json()
      setSessionId(id)

      // 2. Inicia o watch de GPS do Capacitor
      // watchPosition chama o callback continuamente enquanto o usuário se move.
      // O callback recebe a posição atual ou um erro.
      const { Geolocation } = await import('@capacitor/geolocation')

      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 30000 },
        (pos, err) => {
          if (err || !pos) {
            console.warn('[GPS]', err)
            return
          }
          setUserPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
          // Assim que receber o primeiro fix, muda de 'acquiring' para 'navigating'
          setPhase(prev => prev === 'acquiring-gps' ? 'navigating' : prev)
        }
      )
      gpsWatchIdRef.current = watchId

      // 3. Inicia timer de tempo decorrido
      timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000)

    } catch (err: any) {
      setError('Não foi possível iniciar o GPS. Verifique as permissões.')
      setPhase('ready')
    }
  }, [routeId])

  // ── Para GPS e timer ao sair da página ───────────────────────────────────
  useEffect(() => {
    return () => {
      stopGpsAndTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function stopGpsAndTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (gpsWatchIdRef.current) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation')
        await Geolocation.clearWatch({ id: gpsWatchIdRef.current })
      } catch { /* ignorar */ }
      gpsWatchIdRef.current = null
    }
  }

  // ── Abre câmera ou galeria para selfie ────────────────────────────────────
  async function openCameraForCheckin(source: 'camera' | 'gallery') {
    setPhase('camera-open')
    setError('')

    try {
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera')

      const image = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        quality: 85,
        width: 720,
        height: 720,
        correctOrientation: true,
      })

      if (!image.dataUrl) throw new Error('Foto não capturada')

      // Separa o prefixo "data:image/jpeg;base64," para guardar apenas o base64 puro
      const base64 = image.dataUrl.replace(/^data:image\/\w+;base64,/, '')
      setPhotoDataUrl(image.dataUrl)   // para o <img> de preview
      setPhotoBase64(base64)           // para upload posterior
      setPhase('reviewing')

    } catch (err: any) {
      const isCancelled = ['cancel', 'cancelled', 'canceled', 'dismissed', 'no image']
        .some(w => err?.message?.toLowerCase().includes(w))

      // Ao cancelar, volta para o estado anterior (near-waypoint)
      setPhase('near-waypoint')
      if (!isCancelled) {
        setError('Erro ao acessar câmera. Verifique as permissões.')
      }
    }
  }

  // ── Confirma check-in: upload + salva no servidor ─────────────────────────
  async function confirmCheckin() {
    if (!photoBase64 || !sessionId || !route || !userPosition) return

    setPhase('uploading')
    setError('')

    try {
      const wp = route.waypoints[currentWpIndex]
      const distance = distanceToWp ?? 0

      // 1. Upload da selfie para o Supabase Storage
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      const blob = base64ToBlob(photoBase64)
      const filePath = `checkins/${session.user.id}/${wp.id}-${Date.now()}.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('giro-media')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false })

      if (uploadErr) throw new Error('Falha no upload da selfie')

      const { data: { publicUrl } } = supabase.storage
        .from('giro-media')
        .getPublicUrl(filePath)

      // 2. Registra o check-in no servidor
      const checkinRes = await fetch(`/api/sessions/${sessionId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypointId: wp.id,
          selfieImagePath: publicUrl,
          capturedLatitude: userPosition.lat,
          capturedLongitude: userPosition.lng,
          distanceFromWaypointMeters: Math.round(distance),
        }),
      })
      if (!checkinRes.ok) throw new Error('Falha ao salvar check-in')

      // 3. Registra localmente no estado
      setCompletedCheckins(prev => [...prev, {
        waypointId: wp.id,
        selfieUrl: publicUrl,
        lat: userPosition.lat,
        lng: userPosition.lng,
        distance: Math.round(distance),
      }])
      setPhotoDataUrl(null)
      setPhotoBase64(null)

      // 4. Verifica se era o último waypoint
      const isLast = currentWpIndex >= route.waypoints.length - 1

      if (isLast) {
        // Finaliza a sessão
        await fetch(`/api/sessions/${sessionId}/complete`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalDistanceKm: route.distanceKm ?? null,
          }),
        })
        await stopGpsAndTimer()
        setPhase('completed')
      } else {
        setCurrentWpIndex(i => i + 1)
        setPhase('navigating')
      }

    } catch (err: any) {
      setError(err.message || 'Erro ao salvar check-in. Tente novamente.')
      setPhase('near-waypoint')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-spin"
            style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
          <p className="text-gray-400 text-sm">Carregando rota...</p>
        </div>
      </div>
    )
  }

  // ── Erro ──────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 gap-4">
        <span className="text-5xl">😕</span>
        <p className="text-gray-700 font-bold text-center">Rota não encontrada</p>
        <button onClick={() => router.back()}
          className="px-6 py-3 rounded-xl text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg,#830200,#E05300)' }}>
          Voltar
        </button>
      </div>
    )
  }

  const currentWp = route?.waypoints[currentWpIndex]
  const progressPercent = route
    ? (completedCheckins.length / route.waypoints.length) * 100
    : 0

  // ── TELA CONCLUÍDA 🎉 ─────────────────────────────────────────────────────
  if (phase === 'completed') {
    return (
      <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">

        {/* Header */}
        <div className="relative overflow-hidden px-6 pt-12 pb-16"
          style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
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
          {/* Trophy */}
          <div className="w-28 h-28 rounded-3xl flex items-center justify-center mb-6 mt-2 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
            <span className="text-6xl">🏆</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 w-full mb-6">
            {[
              { label: 'Check-ins', value: completedCheckins.length.toString() },
              { label: 'Tempo', value: formatTime(elapsedSecs) },
              { label: 'Distância', value: route?.distanceKm ? `${route.distanceKm}km` : '—' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center"
                style={{ background: '#FFF8F5', border: '1.5px solid #FFE0D0' }}>
                <p className="font-black text-gray-900 text-base">{s.value}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Fotos dos check-ins */}
          {completedCheckins.length > 0 && (
            <div className="w-full mb-6">
              <p className="text-sm font-black text-gray-700 mb-3">Suas fotos da trilha</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {completedCheckins.map((c, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={c.waypointId} src={c.selfieUrl} alt={`Check-in ${i + 1}`}
                    className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-sm"
                    style={{ border: '2px solid #FFE0D0' }} />
                ))}
              </div>
            </div>
          )}

          <button onClick={() => router.push('/home')}
            className="w-full py-4 rounded-2xl text-white font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
            Ir para o início 🏠
          </button>
        </div>
      </div>
    )
  }

  // ── TELA: Reviewing — confirmar foto antes de enviar ──────────────────────
  if (phase === 'reviewing' && photoDataUrl) {
    return (
      <div className="min-h-screen flex flex-col bg-black font-[family-name:var(--font-dm)]">

        {/* Preview da foto — ocupa toda a tela */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoDataUrl} alt="Selfie" className="absolute inset-0 w-full h-full object-cover" />

        {/* Overlay escuro no topo */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)' }} />

        {/* Topo: info do waypoint */}
        <div className="relative z-10 px-5 pt-12">
          <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Check-in em</p>
          <h2 className="text-white font-black text-xl leading-tight">{currentWp?.name}</h2>
        </div>

        {/* Botões na base */}
        <div className="relative z-10 mt-auto px-5 pb-10 flex flex-col gap-3">
          <button
            onClick={confirmCheckin}
            className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}
          >
            ✅ Confirmar check-in
          </button>

          <div className="flex gap-3">
            <button onClick={() => openCameraForCheckin('camera')}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm border-2 border-white/40 text-white"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              📷 Tirar outra
            </button>
            <button onClick={() => openCameraForCheckin('gallery')}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm border-2 border-white/40 text-white"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              🖼️ Galeria
            </button>
          </div>

          <button onClick={() => { setPhotoDataUrl(null); setPhotoBase64(null); setPhase('near-waypoint') }}
            className="text-white/60 text-sm font-semibold text-center py-2">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ── TELA PRINCIPAL: Navegação + Check-in ──────────────────────────────────
  const isUploading = phase === 'uploading'
  const isAcquiring = phase === 'acquiring-gps'
  const canCheckin = phase === 'near-waypoint' || phase === 'camera-open'
  const accInfo = userPosition ? accuracyLabel(userPosition.accuracy) : null

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-[family-name:var(--font-dm)]">

      {/* ── Header com gradiente ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-16"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
        </svg>

        {/* Topo: Voltar + Timer */}
        <div className="relative z-10 flex items-center justify-between mb-5">
          <button onClick={() => { stopGpsAndTimer(); router.back() }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className="text-center">
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Tempo</p>
            <p className="text-white font-black text-xl tabular-nums">{formatTime(elapsedSecs)}</p>
          </div>

          {/* GPS accuracy badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: accInfo?.color ?? '#fff' }} />
            <span className="text-white text-[10px] font-bold">
              {isAcquiring ? 'GPS...' : accInfo ? `±${Math.round(userPosition!.accuracy)}m` : '—'}
            </span>
          </div>
        </div>

        {/* Nome da rota */}
        <div className="relative z-10">
          <p className="text-white/60 text-xs font-medium">{route?.name}</p>
          {/* Barra de progresso */}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%`, background: 'white' }} />
          </div>
          <p className="text-white/60 text-[10px] mt-1 font-medium">
            {completedCheckins.length} de {route?.waypoints.length} pontos
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50 rounded-t-3xl" />
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div className="flex-1 px-5 -mt-2">

        {/* TELA: Pronto para iniciar */}
        {phase === 'ready' && (
          <div className="pt-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Primeiro waypoint</p>
              <h2 className="text-xl font-black text-gray-900 mb-1">{route?.waypoints[0]?.name}</h2>
              {route?.waypoints[0]?.description && (
                <p className="text-gray-500 text-sm">{route.waypoints[0].description}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-orange-100 mb-6"
              style={{ background: '#FFF8F5' }}>
              <p className="text-[11px] font-black text-orange-700 mb-2">⚠️ Antes de iniciar:</p>
              <ul className="text-xs text-orange-600/80 flex flex-col gap-1">
                <li>• O GPS será ativado automaticamente</li>
                <li>• Fique ao ar livre para melhor sinal</li>
                <li>• Você precisará tirar uma selfie em cada waypoint</li>
              </ul>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100 mb-4">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            <button onClick={startRoute}
              className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
              🚀 Iniciar trilha
            </button>
          </div>
        )}

        {/* TELA: Adquirindo GPS */}
        {isAcquiring && (
          <div className="pt-6 flex flex-col items-center gap-5">
            <div className="relative w-24 h-24 mt-4">
              {/* Anéis pulsantes simulando sinal GPS */}
              <div className="absolute inset-0 rounded-full animate-ping opacity-25"
                style={{ background: '#E05300' }} />
              <div className="absolute inset-2 rounded-full animate-ping opacity-30 animation-delay-200"
                style={{ background: '#E05300', animationDelay: '0.3s' }} />
              <div className="absolute inset-4 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                <span className="text-2xl">📡</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-700 font-black text-lg">Buscando sinal GPS</p>
              <p className="text-gray-400 text-sm mt-1">Fique ao ar livre com o céu aberto</p>
            </div>
          </div>
        )}

        {/* TELA: Navegando / Perto do waypoint */}
        {(phase === 'navigating' || phase === 'near-waypoint' || phase === 'camera-open' || isUploading) && currentWp && (
          <div className="pt-4">

            {/* Card do waypoint atual */}
            <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm mb-4">

              {/* Indicador de ordem */}
              <div className="px-5 pt-4 pb-3 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                    {currentWpIndex + 1}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Destino atual</p>
                    <h2 className="font-black text-gray-900 text-base leading-tight">{currentWp.name}</h2>
                  </div>
                </div>
              </div>

              {/* Distância */}
              <div className="px-5 py-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Distância</p>
                  {distanceToWp !== null ? (
                    <p className="font-black text-3xl" style={{
                      color: distanceToWp <= currentWp.radiusMeters ? '#22c55e' : '#E05300'
                    }}>
                      {formatDistance(distanceToWp)}
                    </p>
                  ) : (
                    <p className="text-gray-400 font-bold">Calculando...</p>
                  )}
                </div>

                {/* Indicador visual de proximidade */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                    style={{
                      background: phase === 'near-waypoint' ? '#dcfce7' : '#FFF0EB',
                      border: `2px solid ${phase === 'near-waypoint' ? '#22c55e' : '#E05300'}`,
                    }}>
                    {phase === 'near-waypoint' ? '✅' : '🧭'}
                  </div>
                  <p className="text-[10px] font-bold"
                    style={{ color: phase === 'near-waypoint' ? '#22c55e' : '#E05300' }}>
                    {phase === 'near-waypoint' ? 'No local!' : 'A caminho'}
                  </p>
                </div>
              </div>

              {/* Info de raio */}
              <div className="px-5 pb-4">
                <div className="rounded-xl px-3 py-2 text-xs font-medium"
                  style={{ background: '#F7F7F7', color: '#888' }}>
                  Raio de check-in: {currentWp.radiusMeters}m
                  {currentWp.requiresSelfie && ' · Selfie obrigatória'}
                </div>
              </div>
            </div>

            {/* GPS info */}
            {userPosition && accInfo && (
              <div className="bg-white rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 border border-gray-100">
                <div className="w-2 h-2 rounded-full" style={{ background: accInfo.color }} />
                <p className="text-xs text-gray-500 font-medium">
                  GPS {accInfo.text} · ±{Math.round(userPosition.accuracy)}m de precisão
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100 mb-4">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            {/* ── Botão de Check-in ──────────────────────────────────────── */}
            {isUploading ? (
              <div className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-white font-bold"
                style={{ background: 'linear-gradient(135deg, #830200, #E05300)', opacity: 0.8 }}>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando check-in...
              </div>
            ) : canCheckin ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => openCameraForCheckin('camera')}
                  className="w-full py-4 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                  📷 Fazer check-in com selfie
                </button>
                <button
                  onClick={() => openCameraForCheckin('gallery')}
                  className="w-full py-3 rounded-2xl font-bold text-sm border-2 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ borderColor: '#E05300', color: '#E05300', background: '#FFF8F5' }}>
                  🖼️ Usar foto da galeria
                </button>
              </div>
            ) : (
              // Desabilitado enquanto não chegou no waypoint
              <div className="w-full py-4 rounded-2xl text-center font-bold text-sm"
                style={{ background: '#F0F0F0', color: '#BBB' }}>
                📍 Chegue até o ponto para fazer check-in
              </div>
            )}

            {/* Pontos concluídos */}
            {completedCheckins.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
                  Concluídos ({completedCheckins.length})
                </p>
                <div className="flex gap-2">
                  {completedCheckins.map((c, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c.waypointId} src={c.selfieUrl} alt={`Check-in ${i + 1}`}
                      className="w-14 h-14 rounded-xl object-cover"
                      style={{ border: '2px solid #22c55e' }} />
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