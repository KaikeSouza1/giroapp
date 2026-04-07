'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  useActivityStore,
  formatPace,
  formatElapsed,
  getElapsedMs,
  ACTIVITY_META,
  Coordinate,
} from '@/store/activityStore'

const REQUIRED_ACCURACY_METERS = 20 

export default function RecordClient() {
  const router = useRouter()
  const store = useActivityStore()

  // ── Local UI state ────────────────────────────────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [currentLoc, setCurrentLoc] = useState<{lat: number, lng: number} | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [autoPauseWarning, setAutoPauseWarning] = useState(false)
  const [showStopModal, setShowStopModal] = useState(false)

  // 🚀 NOVO ESTADO: Tela de transição para evitar o "bug" congelado
  const [isFinishing, setIsFinishing] = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const watchIdRef = useRef<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  const lowSpeedCountRef = useRef(0)
  const autoPauseRef = useRef(false)

  const { status, activityType, coordinates, startTime, pausedDuration, pauseStartTime } = store

  useEffect(() => {
    if (!activityType) {
      router.replace('/activity')
    }
  }, [activityType, router])

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedMs(getElapsedMs(startTime, pausedDuration, pauseStartTime))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTime, pausedDuration, pauseStartTime])

  // ── Leaflet map init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      const map = L.map(mapContainerRef.current!, {
        center: [-23.5505, -46.6333],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)

      const poly = L.polyline([], {
        color: '#FF6B35',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      polylineRef.current = poly

      const markerIcon = L.divIcon({
        html: `<div style="
          width:18px;height:18px;
          border-radius:50%;
          background:linear-gradient(135deg,#E05300,#FF8C00);
          border:3px solid white;
          box-shadow:0 0 0 4px rgba(224,83,0,0.35);
        "></div>`,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      const m = L.marker([-23.5505, -46.6333], { icon: markerIcon, zIndexOffset: 1000 }).addTo(map)
      markerRef.current = m

      mapRef.current = map
      setMapReady(true)
    }

    initMap()
  }, [])

  // ── Atualização do Mapa (Marcador e Câmera) ───────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !polylineRef.current) return

    if (currentLoc) {
      markerRef.current.setLatLng([currentLoc.lat, currentLoc.lng])
    }

    if (coordinates.length > 0) {
      const latlngs = coordinates.map((c) => [c.lat, c.lng] as [number, number])
      polylineRef.current.setLatLngs(latlngs)
      
      const last = coordinates[coordinates.length - 1]
      mapRef.current.panTo([last.lat, last.lng], { animate: true, duration: 0.5 })
    } 
    else if (currentLoc) {
      mapRef.current.panTo([currentLoc.lat, currentLoc.lng], { animate: true, duration: 0.5 })
    }
  }, [coordinates.length, currentLoc])

  // ── GPS watch ─────────────────────────────────────────────────────────────
  const startGpsWatch = useCallback(async () => {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')

      watchIdRef.current = await Geolocation.watchPosition(
        { 
          enableHighAccuracy: true, 
          timeout: 10000,
          maximumAge: 0
        },
        (pos, err) => {
          if (err || !pos) return

          const accuracy = pos.coords.accuracy
          setGpsAccuracy(accuracy)

          const lat = pos.coords.latitude
          const lng = pos.coords.longitude

          if (lat === 0 && lng === 0) return

          setCurrentLoc({ lat, lng })

          const currentState = useActivityStore.getState()

          if (currentState.status === 'idle') {
            if (accuracy <= REQUIRED_ACCURACY_METERS) {
              currentState.startActivity()
            }
            return
          }

          if (currentState.status === 'running') {
            const coord: Coordinate = {
              lat,
              lng,
              accuracy,
              timestamp: Date.now(),
              altitude: pos.coords.altitude,
            }

            if (currentState.currentSpeedKmH < 1.0 && accuracy < 30) {
              lowSpeedCountRef.current++
              if (lowSpeedCountRef.current >= 4) {
                autoPauseRef.current = true
                useActivityStore.getState().pauseActivity(true)
                setAutoPauseWarning(true)
                setTimeout(() => setAutoPauseWarning(false), 3000)
              }
            } else if (currentState.currentSpeedKmH >= 1.0) {
              lowSpeedCountRef.current = 0
              if (autoPauseRef.current) {
                autoPauseRef.current = false
                useActivityStore.getState().resumeActivity()
              }
            }

            useActivityStore.getState().addCoordinate(coord)
          }
        }
      )
    } catch (err) {
      console.error('GPS error:', err)
    }
  }, [])

  const stopGpsWatch = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (watchIdRef.current) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation')
        await Geolocation.clearWatch({ id: watchIdRef.current })
      } catch {}
      watchIdRef.current = null
    }
  }, [])

  useEffect(() => {
    startGpsWatch()
    return () => {
      stopGpsWatch()
    }
  }, [startGpsWatch, stopGpsWatch])

  // ── Finalizar Atividade (CORRIGIDO PARA NÃO BUGAR A TELA) ───────────────
  function handleStop() {
    // 1. Esconde o modal de confirmação e sobe a tela de "Salvando" instantaneamente
    setShowStopModal(false)
    setIsFinishing(true)

    // 2. Coloca um pequeno delay (setTimeout) para dar tempo do React renderizar a tela preta de salvamento
    // antes de travarmos o navegador com o router.replace e o desligamento do GPS
    setTimeout(async () => {
      await stopGpsWatch()
      store.stopActivity()
      router.replace('/activity/summary')
    }, 150)
  }

  function handlePauseResume() {
    if (status === 'idle') return
    if (status === 'running') {
      store.pauseActivity()
    } else if (status === 'pausado') {
      store.resumeActivity()
    }
  }

  const meta = activityType ? ACTIVITY_META[activityType] : null
  const distDisplay = store.distanceKm.toFixed(2)
  const paceDisplay = formatPace(store.currentPaceSecPerKm)
  const speedDisplay = store.currentSpeedKmH.toFixed(1)
  const timeDisplay = formatElapsed(elapsedMs)

  const accColor =
    !gpsAccuracy ? '#888' :
    gpsAccuracy <= 15 ? '#22C55E' :
    gpsAccuracy <= 30 ? '#EAB308' : '#EF4444'

  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-dm)] select-none relative" style={{ background: '#080808' }}>
      
      {/* 🚀 OVERLAY DE TRANSIÇÃO (SALVANDO ATIVIDADE) */}
      {isFinishing && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-[#080808]">
          <div className="w-16 h-16 rounded-full animate-spin mb-6" style={{ border: '4px solid rgba(255,255,255,0.05)', borderTop: '4px solid #E05300' }} />
          <h2 className="text-white font-black text-2xl animate-pulse">Salvando treino...</h2>
          <p className="text-white/40 text-sm mt-2 font-medium">Preparando suas estatísticas</p>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showStopModal && !isFinishing && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center px-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
            </div>
            <h3 className="text-white font-black text-xl mb-2 text-center">Encerrar Atividade?</h3>
            <p className="text-white/60 text-sm text-center mb-6 font-medium">
              O tempo e a gravação serão finalizados para você gerar sua imagem do Instagram.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStopModal(false)}
                className="flex-1 py-3.5 rounded-2xl font-bold text-white/70 bg-white/5 active:scale-95 transition-transform"
              >
                Continuar
              </button>
              <button
                onClick={handleStop}
                className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-red-600 active:scale-95 transition-transform"
              >
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-pause banner */}
      {autoPauseWarning && !isFinishing && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl"
          style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <p className="text-white text-xs font-bold">Pausa automática ativada</p>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta?.emoji}</span>
          <div>
            <p className="text-white font-black text-sm">{meta?.label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: accColor }} />
              <p className="text-[10px] font-semibold" style={{ color: accColor }}>
                {gpsAccuracy ? `GPS ±${Math.round(gpsAccuracy)}m` : 'Buscando sinal...'}
              </p>
            </div>
          </div>
        </div>

        <div
          className="px-3 py-1.5 rounded-full flex items-center gap-1.5"
          style={{
            background: status === 'idle' ? 'rgba(234,179,8,0.15)' : status === 'pausado' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            border: `1px solid ${status === 'idle' ? 'rgba(234,179,8,0.3)' : status === 'pausado' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: status === 'idle' ? '#EAB308' : status === 'pausado' ? '#EF4444' : '#22C55E',
              animation: status === 'running' ? 'pulse 2s infinite' : status === 'idle' ? 'ping 1.5s infinite' : 'none',
            }}
          />
          <p
            className="text-xs font-black"
            style={{ color: status === 'idle' ? '#EAB308' : status === 'pausado' ? '#EF4444' : '#22C55E' }}
          >
            {status === 'idle' ? 'AGUARDANDO GPS' : status === 'running' ? 'GRAVANDO' : store.isAutoPaused ? 'AUTO PAUSA' : 'PAUSADO'}
          </p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <p
          className="font-black leading-none tabular-nums"
          style={{
            fontSize: 'clamp(52px, 16vw, 72px)',
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {timeDisplay}
        </p>
      </div>

      <div className="flex px-5 pb-4 gap-3">
        {[
          { label: 'KM', value: distDisplay, sub: 'Distância' },
          { label: 'min/km', value: paceDisplay, sub: 'Pace atual' },
          { label: 'km/h', value: speedDisplay, sub: 'Velocidade' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex-1 rounded-2xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-white font-black text-xl leading-none tabular-nums">{s.value}</p>
            <p className="text-white/30 text-[9px] font-bold uppercase tracking-wider mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Live map ───────────────────────────────────────────────────── */}
      <div className="flex-1 mx-5 rounded-3xl overflow-hidden relative" style={{ minHeight: 200 }}>
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {status === 'idle' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-50 backdrop-blur-sm"
            style={{ background: 'rgba(8,8,8,0.85)' }}
          >
            <div
              className="w-12 h-12 rounded-full animate-spin mb-4"
              style={{ border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #EAB308' }}
            />
            <p className="text-white font-black text-lg text-center px-4">Buscando sinal GPS...</p>
            <p className="text-white/60 text-xs mt-2 font-bold text-center px-6">
              Vá para uma área a céu aberto.<br/>
              Precisão: <span style={{ color: accColor }}>{gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : '--'}</span> (Alvo: {REQUIRED_ACCURACY_METERS}m)
            </p>
          </div>
        )}

        {!mapReady && status !== 'idle' && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: '#111' }}
          >
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{ border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #E05300' }}
            />
          </div>
        )}

        <div
          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(8,8,8,0.8))' }}
        />
      </div>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-12 flex items-center justify-center gap-8">
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => setShowStopModal(true)}
            disabled={status === 'idle'}
            className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1.5px solid rgba(239,68,68,0.4)',
            }}
          >
            <div className="w-6 h-6 rounded-md bg-red-500" />
          </button>
        </div>

        <button
          onClick={handlePauseResume}
          disabled={status === 'idle'}
          className="w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-30"
          style={{
            background:
              status === 'running'
                ? 'linear-gradient(135deg, #830200, #E05300)'
                : 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow:
              status === 'running'
                ? '0 8px 28px rgba(224,83,0,0.5)'
                : status === 'idle' ? 'none' : '0 8px 28px rgba(34,197,94,0.5)',
          }}
        >
          {status === 'running' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <div className="w-16 h-16 flex items-center justify-center">
          <p className="text-white/20 text-[9px] text-center font-bold uppercase tracking-wider leading-tight">
            Clique<br />para<br />parar
          </p>
        </div>
      </div>
    </div>
  )
}