'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'
import 'leaflet/dist/leaflet.css'
import { uploadImageToBucket } from '@/lib/supabase/storage' // ← Função de upload importada

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

export default function NewRoutePage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])

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

  // ── ESTADOS DA IMAGEM ─────────────────────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'waypoints'>('info')

  const [userRole, setUserRole] = useState<string>('')
  const [organizations, setOrganizations] = useState<Organization[]>([])

  // ── Carrega dados de sessão ───────────────────────────────────────────────
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

  // ── Mapa Leaflet ──────────────────────────────────────────────────────────
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

      const map = L.map(mapContainerRef.current!, { center: [-27.5954, -48.548], zoom: 13 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

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

  // ── Atualiza marcadores ───────────────────────────────────────────────────
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

  // ── Helpers de waypoint ───────────────────────────────────────────────────
  function updateWaypoint(id: string, field: keyof Waypoint, value: any) {
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, [field]: value } : wp)))
  }

  function removeWaypoint(id: string) {
    setWaypoints((prev) =>
      prev
        .filter((wp) => wp.id !== id)
        .map((wp, i) => ({ ...wp, order: i + 1 }))
    )
  }

  // ── Lógica de Imagem ──────────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
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

    // Se o utilizador selecionou um ficheiro, fazemos o upload primeiro
    if (imageFile) {
      try {
        finalImageUrl = await uploadImageToBucket(imageFile, 'giro-app', 'routes')
      } catch (err) {
        setError('Erro ao fazer upload da imagem de capa. Tente novamente.')
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

  // ── Render ────────────────────────────────────────────────────────────────
  const inputStyle = {
    background: '#F7F7F7',
    border: '1.5px solid #EFEFEF',
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        {/* Topbar */}
        <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
          <div>
            <h1 className="text-xl font-black text-gray-900">Nova Rota</h1>
            <p className="text-gray-400 text-xs mt-0.5">Clique no mapa para adicionar waypoints</p>
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

        <div className="flex flex-1 overflow-hidden">
          {/* ── Painel lateral ─────────────────────────────── */}
          <div className="w-96 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
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

              {/* ── ABA: INFORMAÇÕES ─────────────────────── */}
              {activeTab === 'info' && (
                <div className="flex flex-col gap-4">
                  {error && (
                    <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
                      <p className="text-red-500 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Organização (Superadmin only) */}
                  {userRole === 'superadmin' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Organização *
                      </label>
                      <select
                        value={form.organizationId}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, organizationId: e.target.value }))
                        }
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 outline-none"
                        style={inputStyle}
                      >
                        <option value="">Selecione a organização...</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Nome */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Nome da rota *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Trilha da Serra"
                      className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none"
                      style={inputStyle}
                    />
                  </div>

                  {/* Descrição */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Descrição
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Descreva a rota..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none resize-none"
                      style={inputStyle}
                    />
                  </div>

                  {/* ── FOTO DE CAPA (UPLOAD LOCAL) ──────────── */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Imagem de Capa da Rota</label>
                    
                    {!previewUrl ? (
                      <label 
                        htmlFor="image-upload" 
                        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer bg-orange-50/50 border-[#E05300]/40 hover:bg-orange-50 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg className="w-8 h-8 mb-3 text-[#E05300]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                          </svg>
                          <p className="mb-2 text-sm text-gray-600">
                            <span className="font-semibold text-[#E05300]">Clique para fazer upload</span> ou arraste
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG ou WEBP (Max. 5MB)</p>
                        </div>
                        <input 
                          id="image-upload" 
                          type="file" 
                          accept="image/png, image/jpeg, image/webp" 
                          className="hidden" 
                          onChange={handleImageChange}
                        />
                      </label>
                    ) : (
                      <div className="relative w-full rounded-2xl overflow-hidden mt-1"
                        style={{ height: '140px', border: '1.5px solid #F0F0F0' }}>
                        <img
                          src={previewUrl}
                          alt="Preview da capa"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-end p-2"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }}>
                          <span className="text-white text-[10px] font-bold uppercase tracking-wider">
                            Ficheiro pronto para upload
                          </span>
                        </div>
                        <button
                          onClick={removeImage}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors"
                          style={{ background: 'rgba(0,0,0,0.6)' }}
                          type="button"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tipo + Dificuldade */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Tipo
                      </label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 outline-none"
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
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Dificuldade
                      </label>
                      <select
                        value={form.difficulty}
                        onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 outline-none"
                        style={inputStyle}
                      >
                        <option value="facil">🟢 Fácil</option>
                        <option value="medio">🟡 Médio</option>
                        <option value="dificil">🔴 Difícil</option>
                        <option value="extremo">🟣 Extremo</option>
                      </select>
                    </div>
                  </div>

                  {/* Distância + Tempo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Distância (km)
                      </label>
                      <input
                        type="number"
                        value={form.distanceKm}
                        onChange={(e) => setForm((p) => ({ ...p, distanceKm: e.target.value }))}
                        placeholder="Ex: 12.5"
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Tempo (min)
                      </label>
                      <input
                        type="number"
                        value={form.estimatedMinutes}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, estimatedMinutes: e.target.value }))
                        }
                        placeholder="Ex: 180"
                        className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── ABA: WAYPOINTS ───────────────────────── */}
              {activeTab === 'waypoints' && (
                <div className="flex flex-col gap-3">
                  {waypoints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                      <div className="text-4xl">📍</div>
                      <p className="text-gray-500 text-sm font-semibold">Nenhum waypoint ainda</p>
                      <p className="text-gray-400 text-xs">Clique no mapa para adicionar pontos</p>
                    </div>
                  ) : (
                    waypoints.map((wp, i) => (
                      <div
                        key={wp.id}
                        className="rounded-2xl p-4 border border-gray-100 bg-gray-50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold"
                              style={{
                                background: 'linear-gradient(135deg, #830200, #E05300)',
                              }}
                            >
                              {i + 1}
                            </div>
                            <span className="text-xs font-bold text-gray-500">
                              {wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}
                            </span>
                          </div>
                          <button
                            onClick={() => removeWaypoint(wp.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={wp.name}
                          onChange={(e) => updateWaypoint(wp.id, 'name', e.target.value)}
                          placeholder={`Nome do ponto ${i + 1}`}
                          className="w-full px-3 py-2 rounded-lg text-sm text-gray-800 placeholder-gray-400 outline-none mb-2"
                          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={wp.requiresSelfie}
                              onChange={(e) =>
                                updateWaypoint(wp.id, 'requiresSelfie', e.target.checked)
                              }
                              className="rounded"
                            />
                            Requer selfie
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">Raio:</span>
                            <input
                              type="number"
                              value={wp.radiusMeters}
                              onChange={(e) =>
                                updateWaypoint(wp.id, 'radiusMeters', parseInt(e.target.value))
                              }
                              className="w-16 px-2 py-1 rounded-lg text-xs text-gray-800 outline-none text-center"
                              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                            />
                            <span className="text-xs text-gray-400">m</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Mapa ───────────────────────────────────────── */}
          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="absolute inset-0" />
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-8 h-8 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin"
                  />
                  <p className="text-sm text-gray-400">Carregando mapa...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}