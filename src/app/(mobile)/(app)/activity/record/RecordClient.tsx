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

// ── Auto-pause threshold ──────────────────────────────────────────────────────
const AUTO_PAUSE_SPEED_KMH = 0.4
const AUTO_PAUSE_CONSECUTIVE = 4 // N coordinates without movement
const REQUIRED_ACCURACY_METERS = 20 // Precisão mínima para iniciar a atividade

export default function RecordClient() {
  const router = useRouter()
  const store = useActivityStore()

  // ── Local UI state ────────────────────────────────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [longPressProgress, setLongPressProgress] = useState(0)
  const [isLongPressing, setIsLongPressing] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [autoPauseWarning, setAutoPauseWarning] = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const watchIdRef = useRef<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const longPressRafRef = useRef<number>(0)
  const longPressStartRef = useRef<number>(0)
  const lowSpeedCountRef = useRef(0)
  const autoPauseRef = useRef(false)

  const { status, activityType, coordinates, startTime, pausedDuration, pauseStartTime } = store

  // ── Redirect se não tiver atividade escolhida ─────────────────────────────
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

      // Dark CartoDB tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)

      // Polyline (neon orange trace)
      const poly = L.polyline([], {
        color: '#FF6B35',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      polylineRef.current = poly

      // Current position marker
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

  // ── Update map imperatively when coordinates change ───────────────────────
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current || !markerRef.current) return
    if (coordinates.length === 0) return

    const latlngs = coordinates.map((c) => [c.lat, c.lng] as [number, number])
    polylineRef.current.setLatLngs(latlngs)

    const last = coordinates[coordinates.length - 1]
    markerRef.current.setLatLng([last.lat, last.lng])
    mapRef.current.panTo([last.lat, last.lng], { animate: true, duration: 0.5 })
  }, [coordinates.length]) // Only re-run when coordinates array length changes

  // ── GPS watch ─────────────────────────────────────────────────────────────
  const startGpsWatch = useCallback(async () => {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')

      watchIdRef.current = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 30000 },
        (pos, err) => {
          if (err || !pos) return

          const accuracy = pos.coords.accuracy
          setGpsAccuracy(accuracy)

          const lat = pos.coords.latitude
          const lng = pos.coords.longitude

          // 🛡️ ANTI-BUG: Ignora a "Ilha Nula" (0,0)
          if (lat === 0 && lng === 0) return

          const currentState = useActivityStore.getState()

          // 🛡️ LÓGICA DE ESPERA: Se estiver idle, espera a precisão chegar em 20m ou menos
          if (currentState.status === 'idle') {
            if (accuracy <= REQUIRED_ACCURACY_METERS) {
              currentState.startActivity()
            }
            return // Não faz mais nada até iniciar de verdade
          }

          // Só grava e calcula auto-pause se a atividade estiver rodando
          if (currentState.status === 'running') {
            const coord: Coordinate = {
              lat,
              lng,
              accuracy,
              timestamp: Date.now(),
              altitude: pos.coords.altitude,
            }

            // Auto-pause logic
            if (currentState.currentSpeedKmH < AUTO_PAUSE_SPEED_KMH && accuracy < 30) {
              lowSpeedCountRef.current++
              if (lowSpeedCountRef.current >= AUTO_PAUSE_CONSECUTIVE) {
                autoPauseRef.current = true
                useActivityStore.getState().pauseActivity(true)
                setAutoPauseWarning(true)
                setTimeout(() => setAutoPauseWarning(false), 3000)
              }
            } else {
              lowSpeedCountRef.current = 0
              // Auto-resume
              if (autoPauseRef.current) {
                autoPauseRef.current = false
                useActivityStore.getState().resumeActivity()
              }
            }

            // Só adiciona a coordenada no mapa/store se estiver rodando
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

  // 🛡️ INICIA O SENSOR DE GPS ASSIM QUE A TELA ABRE (Mesmo sem ter começado a gravar)
  useEffect(() => {
    startGpsWatch()
    return () => {
      stopGpsWatch()
    }
  }, [startGpsWatch, stopGpsWatch])

  // ── Long press stop ───────────────────────────────────────────────────────
  function onStopPressStart() {
    if (status === 'idle') return // Impede de parar o que não começou

    setIsLongPressing(true)
    longPressStartRef.current = Date.now()

    function animate() {
      const elapsed = Date.now() - longPressStartRef.current
      const progress = Math.min((elapsed / 3000) * 100, 100)
      setLongPressProgress(progress)
      if (progress < 100) {
        longPressRafRef.current = requestAnimationFrame(animate)
      } else {
        handleStop()
      }
    }
    longPressRafRef.current = requestAnimationFrame(animate)
  }

  function onStopPressEnd() {
    if (longPressRafRef.current) cancelAnimationFrame(longPressRafRef.current)
    setIsLongPressing(false)
    setLongPressProgress(0)
  }

  async function handleStop() {
    onStopPressEnd()
    await stopGpsWatch()
    store.stopActivity()
    router.replace('/activity/summary')
  }

  function handlePauseResume() {
    if (status === 'idle') return
    if (status === 'running') {
      store.pauseActivity()
    } else if (status === 'pausado') {
      store.resumeActivity()
    }
  }

  // ── Computed display values ───────────────────────────────────────────────
  const meta = activityType ? ACTIVITY_META[activityType] : null
  const distDisplay = store.distanceKm.toFixed(2)
  const paceDisplay = formatPace(store.currentPaceSecPerKm)
  const speedDisplay = store.currentSpeedKmH.toFixed(1)
  const timeDisplay = formatElapsed(elapsedMs)

  const accColor =
    !gpsAccuracy ? '#888' :
    gpsAccuracy <= 15 ? '#22C55E' :
    gpsAccuracy <= 30 ? '#EAB308' : '#EF4444'

  // SVG circle for long-press progress
  const RADIUS = 38
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const strokeDashoffset = CIRCUMFERENCE - (longPressProgress / 100) * CIRCUMFERENCE

  return (
    <div
      className="min-h-screen flex flex-col font-[family-name:var(--font-dm)] select-none"
      style={{ background: '#080808' }}
    >
      {/* Auto-pause banner */}
      {autoPauseWarning && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl"
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

      {/* ── Big elapsed timer ──────────────────────────────────────────── */}
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

      {/* ── Stats row ──────────────────────────────────────────────────── */}
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

        {/* LOADING DO GPS - Fica por cima do mapa até bater os 20 metros */}
        {status === 'idle' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-50 backdrop-blur-md"
            style={{ background: 'rgba(8,8,8,0.75)' }}
          >
            <div
              className="w-12 h-12 rounded-full animate-spin mb-4"
              style={{ border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #EAB308' }}
            />
            <p className="text-white font-black text-lg text-center px-4">Buscando sinal GPS...</p>
            <p className="text-white/60 text-xs mt-2 font-bold text-center px-6">
              Vá para uma área a céu aberto.<br/>
              Precisão atual: <span style={{ color: accColor }}>{gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : '--'}</span> (Alvo: {REQUIRED_ACCURACY_METERS}m)
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

        {/* Map overlay gradient (bottom fade) */}
        <div
          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(8,8,8,0.8))' }}
        />
      </div>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-12 flex items-center justify-center gap-8">

        {/* Stop button with long-press ring */}
        <div className="relative flex items-center justify-center">
          <svg width="100" height="100" className="absolute" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
            {isLongPressing && (
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="#EF4444"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.05s linear' }}
              />
            )}
          </svg>
          <button
            onPointerDown={onStopPressStart}
            onPointerUp={onStopPressEnd}
            onPointerCancel={onStopPressEnd}
            onPointerLeave={onStopPressEnd}
            disabled={status === 'idle'}
            className="w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
            style={{
              background: isLongPressing
                ? 'rgba(239,68,68,0.2)'
                : 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.12)',
            }}
          >
            <div
              className="w-7 h-7 rounded-md"
              style={{ background: isLongPressing ? '#EF4444' : 'rgba(255,255,255,0.5)' }}
            />
          </button>
        </div>

        {/* Pause / Resume — big central button */}
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

        {/* Placeholder to balance layout */}
        <div className="w-16 h-16 flex items-center justify-center">
          <p className="text-white/20 text-[9px] text-center font-bold uppercase tracking-wider leading-tight">
            Segure<br />para<br />parar
          </p>
        </div>
      </div>
    </div>
  )
}