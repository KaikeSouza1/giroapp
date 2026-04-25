'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import {
  useActivityStore,
  formatPace,
  formatElapsed,
  ACTIVITY_META,
  Coordinate,
} from '@/store/activityStore'

function routeToSvgPath(coords: Coordinate[], width: number, height: number, padding = 40): string {
  if (coords.length < 2) return ''

  const lats = coords.map((c) => c.lat)
  const lngs = coords.map((c) => c.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const rangeH = maxLat - minLat || 0.001
  const rangeV = maxLng - minLng || 0.001

  const drawW = width - padding * 2
  const drawH = height - padding * 2

  const scale = Math.min(drawW / rangeV, drawH / rangeH)
  const offsetX = (drawW - rangeV * scale) / 2 + padding
  const offsetY = (drawH - rangeH * scale) / 2 + padding

  const points = coords.map((c) => {
    const x = (c.lng - minLng) * scale + offsetX
    const y = height - ((c.lat - minLat) * scale + offsetY) 
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return points.join(' ')
}

export default function ShareClient() {
  const router = useRouter()
  const store = useActivityStore()
  const shareCardRef = useRef<HTMLDivElement>(null)

  const [bgPhoto, setBgPhoto] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { activityType, coordinates, startTime, pausedDuration, distanceKm } = store

  const totalMs = startTime ? Date.now() - startTime - pausedDuration : 0
  const durationSeconds = Math.floor(totalMs / 1000)
  const avgPaceSec = distanceKm > 0 ? totalMs / 1000 / distanceKm : 0
  const meta = activityType ? ACTIVITY_META[activityType] : null

  const CARD_W = 390
  const CARD_H = 693
  const svgPoints = routeToSvgPath(coordinates, CARD_W, CARD_H * 0.55, 30)

  async function takeBgPhoto() {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const img = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90,
        correctOrientation: true,
      })
      if (img.dataUrl) setBgPhoto(img.dataUrl)
    } catch {}
  }

  async function pickBgPhoto() {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const img = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90,
      })
      if (img.dataUrl) setBgPhoto(img.dataUrl)
    } catch {}
  }

  // ── LÓGICA REFORÇADA: SALVAR NO BANCO DE DADOS COM TRAVA DE 8 SEGUNDOS ──
  async function saveActivityToDb(imageBase64: string | null = null) {
    if (isSaving || distanceKm === 0) return false
    setIsSaving(true)

    try {
      const payload = {
        activityType,
        startedAt: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDistanceKm: distanceKm.toFixed(2),
        durationSeconds,
        averagePace: formatPace(avgPaceSec),
        pathCoordinates: coordinates,
        socialImageBase64: imageBase64 
      }

      // 🚀 TIMEOUT RESTRITO DE 8 SEGUNDOS
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const res = await fetch('/api/activities/save-session', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      clearTimeout(timeoutId)

      if (!res.ok) throw new Error('Falha ao salvar sessão')
      return true
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('Timeout offline alcançado na exportação. Prosseguindo localmente.')
        // Ignora timeout por internet ruim e retorna TRUE liberando o fluxo pro usuário
        return true
      }
      console.error('Erro ao salvar no banco:', error)
      alert('Ops, não conseguimos salvar seu treino na nuvem. Verifique sua conexão.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExportAndShare() {
    if (!shareCardRef.current) return
    setIsExporting(true)

    try {
      const html2canvas = (await import('html2canvas')).default

      const canvas = await html2canvas(shareCardRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 3, // Aumenta a qualidade
        backgroundColor: '#0A0A0A',
        logging: false,
      })

      const dataUrl = canvas.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]

      if (!exported) {
        await saveActivityToDb(base64)
      }

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')

        const fileName = `giro-activity-${Date.now()}.png`

        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        })

        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })

        await Share.share({
          title: `Atividade no GIRO — ${distanceKm.toFixed(2)} km`,
          text: `Completei ${distanceKm.toFixed(2)} km de ${meta?.label} no GIRO! 🔥`,
          files: [uri],
        })
      } else {
        const link = document.createElement('a')
        link.download = 'giro-activity.png'
        link.href = dataUrl
        link.click()
      }

      setExported(true)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleFinish() {
    if (!exported) {
      await saveActivityToDb(null)
    }
    store.resetActivity()
    router.replace('/feed') 
  }

  if (!meta) return null

  return (
    <div
      className="min-h-screen flex flex-col font-[family-name:var(--font-dm)]"
      style={{ background: '#080808' }}
    >
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-0.5">Criar Post</p>
          <h1 className="text-white font-black text-2xl">Compartilhar 📸</h1>
        </div>
        <button
          onClick={handleFinish}
          disabled={isSaving}
          className="text-white/40 text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {isSaving && !isExporting ? 'Salvando...' : 'Pular'}
        </button>
      </div>

      {!bgPhoto && (
        <div className="px-5 mb-4 flex gap-3">
          <button
            onClick={takeBgPhoto}
            className="flex-1 py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}
          >
            📷 Tirar foto
          </button>
          <button
            onClick={pickBgPhoto}
            className="flex-1 py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            🖼️ Galeria
          </button>
        </div>
      )}

      <div className="flex justify-center px-5">
        <div
          ref={shareCardRef}
          className="relative overflow-hidden rounded-3xl"
          style={{
            width: '100%',
            maxWidth: 390,
            aspectRatio: '9/16',
            background: '#0A0A0A',
          }}
        >
          {bgPhoto ? (
            <img
              src={bgPhoto}
              alt="Fundo"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(160deg, #1A0800 0%, #0A0A0A 50%, #001A08 100%)',
              }}
            />
          )}

          <div
            className="absolute inset-0"
            style={{
              background: bgPhoto
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.75) 100%)'
                : 'transparent',
            }}
          />

          {!bgPhoto && (
            <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          )}

          <div className="absolute top-0 left-0 right-0 p-6 flex items-start justify-between">
            <div>
              <img
                src="/logogiroprincipal.png"
                alt="GIRO"
                width={70}
                height={28}
                className="drop-shadow-lg"
              />
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(224,83,0,0.85)' }}
            >
              <span className="text-sm">{meta.emoji}</span>
              <p className="text-white text-xs font-black">{meta.label}</p>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center" style={{ top: '15%', bottom: '30%' }}>
            {coordinates.length > 1 ? (
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${CARD_W} ${CARD_H * 0.55}`}
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline
                  points={svgPoints}
                  fill="none"
                  stroke="rgba(255,107,53,0.3)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={svgPoints}
                  fill="none"
                  stroke="rgba(255,107,53,0.6)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={svgPoints}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {svgPoints && (() => {
                  const first = svgPoints.split(' ')[0]?.split(',')
                  if (!first) return null
                  return (
                    <g>
                      <circle cx={first[0]} cy={first[1]} r="8" fill="rgba(34,197,94,0.3)" />
                      <circle cx={first[0]} cy={first[1]} r="5" fill="#22C55E" />
                    </g>
                  )
                })()}

                {svgPoints && (() => {
                  const pts = svgPoints.split(' ')
                  const last = pts[pts.length - 1]?.split(',')
                  if (!last) return null
                  return (
                    <g>
                      <circle cx={last[0]} cy={last[1]} r="8" fill="rgba(239,68,68,0.3)" />
                      <circle cx={last[0]} cy={last[1]} r="5" fill="#EF4444" />
                    </g>
                  )
                })()}
              </svg>
            ) : (
              <div className="flex flex-col items-center gap-3 opacity-30">
                <span className="text-5xl">{meta.emoji}</span>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">
              Distância percorrida
            </p>
            <p
              className="font-black leading-none mb-5"
              style={{ fontSize: 64, color: '#FF6B35', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
            >
              {distanceKm.toFixed(2)}
              <span className="text-2xl ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                km
              </span>
            </p>

            <div
              className="flex rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              {[
                { label: 'Tempo', value: formatElapsed(totalMs) },
                { label: 'Pace', value: `${formatPace(avgPaceSec)}/km` },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="flex-1 py-3 text-center"
                  style={{
                    borderRight: i === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  }}
                >
                  <p className="text-white font-black text-base">{s.value}</p>
                  <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider mt-0.5">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {bgPhoto && (
        <div className="flex justify-center mt-3 gap-3 px-5">
          <button
            onClick={takeBgPhoto}
            className="text-white/50 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            📷 Trocar foto
          </button>
          <button
            onClick={() => setBgPhoto(null)}
            className="text-white/30 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            ✕ Remover
          </button>
        </div>
      )}

      <div className="px-5 mt-5 pb-12 flex flex-col gap-3">
        <button
          onClick={handleExportAndShare}
          disabled={isExporting || isSaving}
          className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #830200, #E05300)',
            boxShadow: '0 8px 28px rgba(224,83,0,0.35)',
          }}
        >
          {isExporting || (isSaving && !exported) ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processando...
            </>
          ) : exported ? (
            '✅ Compartilhar novamente'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Exportar e Compartilhar
            </>
          )}
        </button>

        <button
          onClick={handleFinish}
          disabled={isSaving}
          className="text-center text-white/30 text-sm font-semibold py-2 disabled:opacity-50"
        >
          Finalizar Treino →
        </button>
      </div>
    </div>
  )
}