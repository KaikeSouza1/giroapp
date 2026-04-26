'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'
import 'leaflet/dist/leaflet.css'
import { uploadImageToBucket } from '@/lib/supabase/storage'

type Waypoint = {
  id: string
  name: string
  description: string
  latitude: number
  longitude: number
  order: number
  radiusMeters: number
  requiresSelfie: boolean
}

type Organization = { id: string; name: string }

// ── Decodificador de Polyline (formato Google / OSRM) ──────────────────────
function decodePolyline(str: string, precision = 5): [number, number][] {
  let index = 0
  let lat = 0
  let lng = 0
  const coordinates: [number, number][] = []
  const factor = Math.pow(10, precision)

  while (index < str.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    shift = 0
    result = 0
    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    coordinates.push([lat / factor, lng / factor])
  }
  return coordinates
}

// ── Config por tipo de rota ────────────────────────────────────────────────
// O servidor público router.project-osrm.org só suporta "driving".
// Para foot e bike usamos routed-foot / routed-bike no mesmo host.
// Velocidade média (km/h) usada para estimar tempo na linha reta.
const routeConfig: Record<string, { osrmService: string; speedKmh: number; label: string }> = {
  caminhada:   { osrmService: 'routed-foot',  speedKmh: 5,   label: 'a pé' },
  cicloturismo:{ osrmService: 'routed-bike',  speedKmh: 15,  label: 'de bike' },
  '4x4':       { osrmService: 'routed-car',   speedKmh: 40,  label: 'de 4x4' },
  moto:        { osrmService: 'routed-car',   speedKmh: 50,  label: 'de moto' },
  outros:      { osrmService: 'routed-foot',  speedKmh: 5,   label: 'a pé' },
}

export default function NewRoutePage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  const routeLayerRef = useRef<any>(null)
  const straightLayerRef = useRef<any>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    difficulty: 'medio',
    type: 'caminhada',
    distanceKm: '',
    estimatedMinutes: '',
    organizationId: '',
    coverImageUrl: '',
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'waypoints'>('info')
  const [userRole, setUserRole] = useState<string>('')
  const [organizations, setOrganizations] = useState<Organization[]>([])

  // ── NOVO: Estado de Roteamento ─────────────────────────────────────────
  const [followRoads, setFollowRoads] = useState(true)
  const [isRouting, setIsRouting] = useState(false)
  const [routeError, setRouteError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchingMap, setIsSearchingMap] = useState(false)
  const [wpSearchQuery, setWpSearchQuery] = useState('')
  const [isSearchingWp, setIsSearchingWp] = useState(false)

  useEffect(() => {
    async function fetchSessionData() {
      const resUser = await fetch('/api/users/me')
      const user = await resUser.json()
      setUserRole(user?.role || '')
      if (user?.role === 'superadmin') {
        const resOrgs = await fetch('/api/admin/organizations')
        if (resOrgs.ok) setOrganizations(await resOrgs.json())
      }
    }
    fetchSessionData()
  }, [])

  // ── Inicialização do Mapa ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    async function initMap() {
      const L = (await import('leaflet')).default

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapContainerRef.current!, { center: [-15.7801, -47.9292], zoom: 4 })

      L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google Maps',
      }).addTo(map)

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            map.flyTo([position.coords.latitude, position.coords.longitude], 15)
          },
          () => {}
        )
      }

      map.on('click', (e: any) => {
        const newWaypoint: Waypoint = {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
          order: 0,
          radiusMeters: 50,
          requiresSelfie: true,
        }
        setWaypoints((prev) => [...prev, { ...newWaypoint, order: prev.length + 1 }])
        setActiveTab('waypoints')
      })

      mapRef.current = map
      setMapReady(true)
    }
    initMap()
  }, [])

  // ── Atualiza marcadores ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    async function updateMarkers() {
      const L = (await import('leaflet')).default
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      waypoints.forEach((wp, i) => {
        const icon = L.divIcon({
          html: `<div style="background:linear-gradient(135deg,#830200,#E05300);color:white;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><span style="transform:rotate(45deg)">${i + 1}</span></div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        })
        const marker = L.marker([wp.latitude, wp.longitude], { icon })
          .addTo(mapRef.current)
          .bindPopup(wp.name || `Waypoint ${i + 1}`)
        markersRef.current.push(marker)
      })
    }
    updateMarkers()
  }, [waypoints, mapReady])

  // ── NOVO: Função de Roteamento OSRM ──────────────────────────────────
  const fetchOSRMRoute = useCallback(
    async (wps: Waypoint[], type: string) => {
      if (wps.length < 2 || !mapRef.current) return

      setIsRouting(true)
      setRouteError('')

      const L = (await import('leaflet')).default

      // Remove rotas anteriores
      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
        routeLayerRef.current = null
      }
      if (straightLayerRef.current) {
        straightLayerRef.current.remove()
        straightLayerRef.current = null
      }

      try {
        const config = routeConfig[type] || routeConfig['caminhada']
        const coords = wps.map((wp) => `${wp.longitude},${wp.latitude}`).join(';')
        // Cada serviço (routed-foot / routed-bike / routed-car) tem seu próprio
        // subdomínio no servidor público do OSRM com o perfil correto.
        const url = `https://${config.osrmService}.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`

        const res = await fetch(url)
        const data = await res.json()

        if (data.code !== 'Ok' || !data.routes?.[0]) {
          throw new Error('Rota não encontrada pelo OSRM')
        }

        const route = data.routes[0]
        const geometry = route.geometry
        const latlngs = decodePolyline(geometry)

        // Distância e duração
        const distKm = (route.distance / 1000).toFixed(2)
        const durationMin = Math.round(route.duration / 60).toString()

        setForm((prev) => ({
          ...prev,
          distanceKm: distKm,
          estimatedMinutes: durationMin,
        }))

        // Desenha a polyline
        const polyline = L.polyline(latlngs, {
          color: '#E05300',
          weight: 5,
          opacity: 0.85,
          dashArray: undefined,
          lineJoin: 'round',
          lineCap: 'round',
        })

        // Sombra (efeito premium)
        const shadow = L.polyline(latlngs, {
          color: '#830200',
          weight: 9,
          opacity: 0.2,
          lineJoin: 'round',
          lineCap: 'round',
        })

        shadow.addTo(mapRef.current)
        polyline.addTo(mapRef.current)
        routeLayerRef.current = polyline

        // Mantém referência da sombra para remover depois
        const origRemove = polyline.remove.bind(polyline)
        ;(polyline as any)._shadow = shadow
        polyline.remove = () => {
          shadow.remove()
          return origRemove()
        }
      } catch (err: any) {
        setRouteError('Não foi possível calcular a rota. Verifique os waypoints.')
        console.error('OSRM error:', err)
      } finally {
        setIsRouting(false)
      }
    },
    []
  )

  // ── NOVO: Linha reta entre waypoints ─────────────────────────────────
  const drawStraightLines = useCallback(async (wps: Waypoint[], type: string) => {
    if (!mapRef.current) return
    const L = (await import('leaflet')).default

    if (routeLayerRef.current) {
      routeLayerRef.current.remove()
      routeLayerRef.current = null
    }
    if (straightLayerRef.current) {
      straightLayerRef.current.remove()
      straightLayerRef.current = null
    }

    if (wps.length < 2) return

    const latlngs = wps.map((wp) => [wp.latitude, wp.longitude] as [number, number])
    const line = L.polyline(latlngs, {
      color: '#E05300',
      weight: 4,
      opacity: 0.75,
      dashArray: '10, 8',
      lineJoin: 'round',
      lineCap: 'round',
    })
    line.addTo(mapRef.current)
    straightLayerRef.current = line

    // Distância em linha reta
    let totalDist = 0
    for (let i = 0; i < wps.length - 1; i++) {
      const from = L.latLng(wps[i].latitude, wps[i].longitude)
      const to = L.latLng(wps[i + 1].latitude, wps[i + 1].longitude)
      totalDist += from.distanceTo(to)
    }
    const distKm = (totalDist / 1000).toFixed(2)
    // Velocidade correta por tipo de atividade
    const config = routeConfig[type] || routeConfig['caminhada']
    const durationMin = Math.round((totalDist / 1000 / config.speedKmh) * 60).toString()
    setForm((prev) => ({ ...prev, distanceKm: distKm, estimatedMinutes: durationMin }))
  }, [])

  // ── NOVO: Dispara roteamento sempre que waypoints ou modo muda ────────
  useEffect(() => {
    if (!mapReady) return
    if (waypoints.length < 2) {
      // Limpa rotas se menos de 2 pontos
      if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null }
      if (straightLayerRef.current) { straightLayerRef.current.remove(); straightLayerRef.current = null }
      return
    }
    if (followRoads) {
      fetchOSRMRoute(waypoints, form.type)
    } else {
      drawStraightLines(waypoints, form.type)
    }
  }, [waypoints, followRoads, form.type, mapReady, fetchOSRMRoute, drawStraightLines])

  // ── Busca geral no mapa ───────────────────────────────────────────────
  async function handleSearchMap(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim() || !mapRef.current) return
    setIsSearchingMap(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data?.length > 0) {
        const { lat, lon } = data[0]
        mapRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 16, { duration: 1.5 })
      } else {
        alert('Local não encontrado.')
      }
    } catch { alert('Erro ao buscar local.') }
    finally { setIsSearchingMap(false) }
  }

  // ── Busca e adiciona waypoint ─────────────────────────────────────────
  async function handleSearchAndAddWaypoint(e: React.FormEvent) {
    e.preventDefault()
    if (!wpSearchQuery.trim() || !mapRef.current) return
    setIsSearchingWp(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(wpSearchQuery)}`)
      const data = await res.json()
      if (data?.length > 0) {
        const { lat, lon, display_name } = data[0]
        const latitude = parseFloat(lat)
        const longitude = parseFloat(lon)
        const placeName = display_name.split(',')[0]
        const newWaypoint: Waypoint = {
          id: crypto.randomUUID(),
          name: placeName,
          description: '',
          latitude,
          longitude,
          order: waypoints.length + 1,
          radiusMeters: 50,
          requiresSelfie: true,
        }
        setWaypoints((prev) => [...prev, newWaypoint])
        mapRef.current.flyTo([latitude, longitude], 17, { duration: 1.5 })
        setWpSearchQuery('')
      } else {
        alert('Local exato não encontrado para adicionar o waypoint.')
      }
    } catch { alert('Erro ao buscar o waypoint.') }
    finally { setIsSearchingWp(false) }
  }

  function updateWaypoint(id: string, field: keyof Waypoint, value: any) {
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, [field]: value } : wp)))
  }

  function removeWaypoint(id: string) {
    setWaypoints((prev) =>
      prev.filter((wp) => wp.id !== id).map((wp, i) => ({ ...wp, order: i + 1 }))
    )
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  function removeImage() {
    setImageFile(null)
    setPreviewUrl(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('O nome da rota é obrigatório.'); return }
    if (userRole === 'superadmin' && !form.organizationId) {
      setError('Superadmins precisam selecionar uma Organização.')
      return
    }
    if (waypoints.length === 0) { setError('Adicione pelo menos um waypoint no mapa.'); return }

    setSaving(true)
    setError('')

    let finalImageUrl = form.coverImageUrl
    if (imageFile) {
      try {
        finalImageUrl = await uploadImageToBucket(imageFile, 'giro-app', 'routes')
      } catch {
        setError('Erro ao fazer upload da capa. Tente novamente.')
        setSaving(false)
        return
      }
    }

    const res = await fetch('/api/admin/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, coverImageUrl: finalImageUrl, waypoints }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar rota.')
      setSaving(false)
      return
    }

    router.push('/dashboard/routes')
  }

  const inputStyle = {
    background: '#F7F7F7',
    border: '1.5px solid #EFEFEF',
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col">

        {/* Topbar */}
        <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100 shadow-sm z-10 relative">
          <div>
            <h1 className="text-xl font-black text-gray-900">Nova Rota</h1>
            <p className="text-gray-400 text-xs mt-0.5">Clique no mapa ou pesquise para adicionar waypoints</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar rota'
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Painel lateral */}
          <div className="w-[420px] bg-white border-r border-gray-100 flex flex-col overflow-hidden shadow-2xl z-20">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['info', 'waypoints'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 text-sm font-bold transition-all"
                  style={{
                    color: activeTab === tab ? '#E05300' : '#9CA3AF',
                    borderBottom: activeTab === tab ? '2px solid #E05300' : '2px solid transparent',
                  }}
                >
                  {tab === 'info' ? 'Informações' : `Waypoints (${waypoints.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">

              {/* ABA: INFORMAÇÕES */}
              {activeTab === 'info' && (
                <div className="flex flex-col gap-4">
                  {error && (
                    <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
                      <p className="text-red-500 text-sm">{error}</p>
                    </div>
                  )}

                  {userRole === 'superadmin' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Organização *</label>
                      <select
                        value={form.organizationId}
                        onChange={(e) => setForm((p) => ({ ...p, organizationId: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-orange-500/20"
                        style={inputStyle}
                      >
                        <option value="">Selecione a organização...</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nome da rota *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Trilha da Serra"
                      className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20"
                      style={inputStyle}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Descrição</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Descreva a rota..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none resize-none focus:ring-2 focus:ring-orange-500/20"
                      style={inputStyle}
                    />
                  </div>

                  {/* FOTO DE CAPA */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Imagem de Capa</label>
                    {!previewUrl ? (
                      <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer bg-orange-50/50 border-[#E05300]/40 hover:bg-orange-50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg className="w-8 h-8 mb-3 text-[#E05300]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                          </svg>
                          <p className="mb-2 text-sm text-gray-600"><span className="font-semibold text-[#E05300]">Clique para upload</span></p>
                          <p className="text-xs text-gray-500">PNG ou JPG</p>
                        </div>
                        <input id="image-upload" type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleImageChange} />
                      </label>
                    ) : (
                      <div className="relative w-full rounded-2xl overflow-hidden mt-1 shadow-sm" style={{ height: '140px', border: '1.5px solid #F0F0F0' }}>
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button onClick={removeImage} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors shadow-lg" style={{ background: 'rgba(0,0,0,0.6)' }} type="button">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo</label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-orange-500/20"
                        style={inputStyle}
                      >
                        <option value="caminhada">🥾 Caminhada</option>
                        <option value="cicloturismo">🚴 Cicloturismo</option>
                        <option value="4x4">🚙 4x4</option>
                        <option value="moto">🏍️ Moto</option>
                        <option value="outros">🗺️ Outros</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dificuldade</label>
                      <select
                        value={form.difficulty}
                        onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 outline-none focus:ring-2 focus:ring-orange-500/20"
                        style={inputStyle}
                      >
                        <option value="facil">🟢 Fácil</option>
                        <option value="medio">🟡 Médio</option>
                        <option value="dificil">🔴 Difícil</option>
                        <option value="extremo">🟣 Extremo</option>
                      </select>
                    </div>
                  </div>

                  {/* ── NOVO: Switch Seguir Estradas ───────────────────────── */}
                  <div
                    className="flex items-center justify-between px-4 py-3 rounded-2xl border transition-all"
                    style={{
                      background: followRoads ? 'linear-gradient(135deg, #FFF4F0, #FFF9F7)' : '#F7F7F7',
                      borderColor: followRoads ? '#E05300' : '#EFEFEF',
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-gray-800">
                        {followRoads ? '🛣️ Seguir Estradas' : '🌿 Linha Livre'}
                      </span>
                      <span className="text-[11px] text-gray-400 leading-tight">
                        {followRoads
                          ? 'Roteamento via OSRM (distância real)'
                          : 'Linha reta entre pontos (trilha virgem)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFollowRoads((v) => !v)}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0"
                      style={{ background: followRoads ? '#E05300' : '#D1D5DB' }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform"
                        style={{ transform: followRoads ? 'translateX(22px)' : 'translateX(4px)' }}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        Distância (km)
                        {isRouting && (
                          <span className="w-3 h-3 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={form.distanceKm}
                          onChange={(e) => setForm((p) => ({ ...p, distanceKm: e.target.value }))}
                          placeholder="Auto"
                          className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20"
                          style={{
                            ...inputStyle,
                            background: isRouting ? '#FFF4F0' : '#F7F7F7',
                            borderColor: form.distanceKm && !isRouting ? '#E05300' : '#EFEFEF',
                          }}
                        />
                        {form.distanceKm && !isRouting && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-500">AUTO</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        Tempo (min)
                        {isRouting && (
                          <span className="w-3 h-3 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={form.estimatedMinutes}
                          onChange={(e) => setForm((p) => ({ ...p, estimatedMinutes: e.target.value }))}
                          placeholder="Auto"
                          className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-500/20"
                          style={{
                            ...inputStyle,
                            background: isRouting ? '#FFF4F0' : '#F7F7F7',
                            borderColor: form.estimatedMinutes && !isRouting ? '#E05300' : '#EFEFEF',
                          }}
                        />
                        {form.estimatedMinutes && !isRouting && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-500">AUTO</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Feedback de erro de roteamento */}
                  {routeError && (
                    <div className="rounded-xl px-4 py-3 bg-amber-50 border border-amber-100 flex items-start gap-2">
                      <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                      <p className="text-amber-700 text-xs leading-relaxed">{routeError}. Tente mudar para modo Linha Livre ou ajuste os waypoints.</p>
                    </div>
                  )}

                  {/* Badge de status da rota */}
                  {waypoints.length >= 2 && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: isRouting ? '#FFF4F0' : followRoads ? '#F0FFF4' : '#F5F5F5',
                        color: isRouting ? '#C2410C' : followRoads ? '#166534' : '#6B7280',
                        border: `1px solid ${isRouting ? '#FED7AA' : followRoads ? '#BBF7D0' : '#E5E7EB'}`,
                      }}
                    >
                      {isRouting ? (
                        <>
                          <span className="w-3 h-3 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin flex-shrink-0" />
                          Calculando rota real via OSRM...
                        </>
                      ) : followRoads ? (
                        <>✅ Rota calculada via estradas reais</>
                      ) : (
                        <>📏 Distância em linha reta estimada</>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ABA: WAYPOINTS */}
              {activeTab === 'waypoints' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-100">
                    <label className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-2 block">
                      📍 Adicionar por Busca
                    </label>
                    <form onSubmit={handleSearchAndAddWaypoint} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Mirante da Pedra..."
                        value={wpSearchQuery}
                        onChange={(e) => setWpSearchQuery(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-sm text-gray-800 outline-none border border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                      <button
                        type="submit"
                        disabled={isSearchingWp || !wpSearchQuery}
                        className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isSearchingWp ? '...' : 'Adicionar'}
                      </button>
                    </form>
                  </div>

                  {waypoints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center opacity-70">
                      <div className="text-4xl">👆</div>
                      <p className="text-gray-500 text-sm font-semibold mt-2">Busque um local acima</p>
                      <p className="text-gray-400 text-xs">Ou clique diretamente no mapa ao lado</p>
                    </div>
                  ) : (
                    waypoints.map((wp, i) => (
                      <div key={wp.id} className="rounded-2xl p-4 border border-gray-200 bg-white shadow-sm relative group hover:border-orange-300 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-sm" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                              {i + 1}
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                              {wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}
                            </span>
                          </div>
                          <button onClick={() => removeWaypoint(wp.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={wp.name}
                          onChange={(e) => updateWaypoint(wp.id, 'name', e.target.value)}
                          placeholder={`Nome do ponto ${i + 1}`}
                          className="w-full px-3 py-2 rounded-lg text-sm text-gray-900 font-semibold outline-none mb-3 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white transition-all"
                        />
                        <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
                          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer hover:text-orange-600 transition-colors">
                            <input
                              type="checkbox"
                              checked={wp.requiresSelfie}
                              onChange={(e) => updateWaypoint(wp.id, 'requiresSelfie', e.target.checked)}
                              className="rounded border-gray-300 w-4 h-4 text-orange-600 focus:ring-orange-500"
                            />
                            Requer selfie
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Raio</span>
                            <input
                              type="number"
                              value={wp.radiusMeters}
                              onChange={(e) => updateWaypoint(wp.id, 'radiusMeters', parseInt(e.target.value))}
                              className="w-16 px-2 py-1.5 rounded-lg text-xs text-gray-800 outline-none text-center font-bold bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white transition-all"
                            />
                            <span className="text-xs font-bold text-gray-400">m</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mapa + Barra de Busca Geral */}
          <div className="flex-1 relative z-0">
            <div className="absolute top-4 left-6 right-6 z-[400] pointer-events-none flex justify-center">
              <form
                onSubmit={handleSearchMap}
                className="w-full max-w-lg bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-gray-200 flex items-center pointer-events-auto"
              >
                <div className="pl-3 text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                  type="text"
                  placeholder="Voar para local (apenas mover o mapa)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none bg-transparent font-medium"
                />
                <button
                  type="submit"
                  disabled={isSearchingMap || !searchQuery}
                  className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSearchingMap ? 'Voando...' : 'Buscar'}
                </button>
              </form>
            </div>

            {/* Badge flutuante de modo ativo */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400]">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-md border pointer-events-none"
                style={{
                  background: followRoads ? 'rgba(224, 83, 0, 0.9)' : 'rgba(50, 50, 50, 0.85)',
                  color: 'white',
                  borderColor: followRoads ? '#C2410C' : '#444',
                }}
              >
                {followRoads ? '🛣️ Modo: Seguir Estradas (OSRM)' : '🌿 Modo: Linha Livre'}
              </div>
            </div>

            <div ref={mapContainerRef} className="absolute inset-0" />

            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#E5E3DF] z-50">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-gray-300 border-t-orange-600 rounded-full animate-spin shadow-lg" />
                  <p className="text-sm font-bold text-gray-500 tracking-wider uppercase">Carregando Satélite...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}