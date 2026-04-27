
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

export default function EditRoutePage() {
  const router = useRouter()
  const { id: routeId } = useParams() 
  
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
    status: 'rascunho'
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'waypoints'>('info')
  const [userRole, setUserRole] = useState<string>('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [wpSearchQuery, setWpSearchQuery] = useState('')

  useEffect(() => {
    async function loadAll() {
      try {
        const [resUser, resRoute] = await Promise.all([
          fetch('/api/users/me'),
          fetch(`/api/admin/routes/${routeId}`)
        ])

        const user = await resUser.json()
        setUserRole(user?.role || '')

        if (user?.role === 'superadmin') {
          const resOrgs = await fetch('/api/admin/organizations')
          if (resOrgs.ok) setOrganizations(await resOrgs.json())
        }

        if (resRoute.ok) {
          const data = await resRoute.json()
          setForm({
            name: data.name || '',
            description: data.description || '',
            difficulty: data.difficulty || 'medio',
            type: data.type || 'caminhada',
            distanceKm: data.distanceKm || '',
            estimatedMinutes: data.estimatedMinutes?.toString() || '',
            organizationId: data.organizationId || '',
            coverImageUrl: data.coverImageUrl || '',
            status: data.status || 'rascunho'
          })
          if (data.coverImageUrl) setPreviewUrl(data.coverImageUrl)
          
          setWaypoints(data.waypoints.map((wp: any) => ({
            ...wp,
            latitude: parseFloat(wp.latitude),
            longitude: parseFloat(wp.longitude)
          })))
        } else {
            setError("Não foi possível encontrar os dados desta rota.")
        }
      } catch (err) {
        setError('Falha de conexão ao carregar dados.')
      } finally {
        setLoadingData(false)
      }
    }
    loadAll()
  }, [routeId])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || loadingData) return

    async function initMap() {
      const L = (await import('leaflet')).default
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const center: [number, number] = waypoints.length > 0 
        ? [waypoints[0].latitude, waypoints[0].longitude] 
        : [-15.78, -47.92]

      const map = L.map(mapContainerRef.current!, { center, zoom: waypoints.length > 0 ? 15 : 4 })
      
      
      L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google Maps',
      }).addTo(map)

      map.on('click', (e: any) => {
        const newWaypoint: Waypoint = {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
          order: waypoints.length + 1,
          radiusMeters: 50,
          requiresSelfie: true,
        }
        setWaypoints((prev) => [...prev, newWaypoint])
        setActiveTab('waypoints')
      })

      mapRef.current = map
      setMapReady(true)
    }
    initMap()
  }, [loadingData])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    async function updateMarkers() {
      const L = (await import('leaflet')).default
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      waypoints.forEach((wp, i) => {
        const icon = L.divIcon({
          html: `<div style="background:linear-gradient(135deg,#830200,#E05300);color:white;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid white;"><span style="transform:rotate(45deg)">${i + 1}</span></div>`,
          className: '', iconSize: [26, 26], iconAnchor: [13, 26],
        })
        const marker = L.marker([wp.latitude, wp.longitude], { icon }).addTo(mapRef.current).bindPopup(wp.name || `Ponto ${i + 1}`)
        markersRef.current.push(marker)
      })
    }
    updateMarkers()
  }, [waypoints, mapReady])

  async function handleSearchMap(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim() || !mapRef.current) return
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data?.[0]) mapRef.current.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16)
    } catch {}
  }

  async function handleSearchAndAddWaypoint(e: React.FormEvent) {
    e.preventDefault()
    if (!wpSearchQuery.trim() || !mapRef.current) return
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(wpSearchQuery)}`)
      const data = await res.json()
      if (data?.[0]) {
        const lat = parseFloat(data[0].lat); const lon = parseFloat(data[0].lon)
        const newWp: Waypoint = {
          id: crypto.randomUUID(),
          name: data[0].display_name.split(',')[0],
          description: '', latitude: lat, longitude: lon, order: waypoints.length + 1, radiusMeters: 50, requiresSelfie: true,
        }
        setWaypoints(prev => [...prev, newWp])
        mapRef.current.flyTo([lat, lon], 17)
        setWpSearchQuery('')
      }
    } catch {}
  }

  function removeWaypoint(id: string) {
    setWaypoints(prev => prev.filter(wp => wp.id !== id).map((wp, i) => ({ ...wp, order: i + 1 })))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { setImageFile(file); setPreviewUrl(URL.createObjectURL(file)) }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome obrigatório.'); return }
    setSaving(true); setError('')
    let finalImageUrl = form.coverImageUrl
    if (imageFile) {
      try {
        finalImageUrl = await uploadImageToBucket(imageFile, 'giro-app', 'routes')
      } catch {
        setError('Erro no upload da imagem.'); setSaving(false); return
      }
    }
    const res = await fetch(`/api/admin/routes/${routeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, coverImageUrl: finalImageUrl, waypoints }),
    })
    if (res.ok) router.push('/dashboard/routes')
    else { const d = await res.json(); setError(d.error || 'Erro ao salvar.'); setSaving(false) }
  }

  if (loadingData) return (
    <div className="flex h-screen items-center justify-center bg-white font-black text-orange-600 animate-pulse">
        CARREGANDO DADOS DA ROTA...
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100 shadow-sm z-10">
          <div>
            <h1 className="text-xl font-black text-gray-900">Editar Rota Oficial</h1>
            <p className="text-gray-400 text-xs">ID: {routeId}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
              {saving ? 'Guardando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          <div className="w-[440px] bg-white border-r border-gray-100 flex flex-col overflow-hidden shadow-2xl z-20">
            <div className="flex border-b border-gray-100">
              {['info', 'waypoints'].map((t) => (
                <button key={t} onClick={() => setActiveTab(t as any)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all" style={{ color: activeTab === t ? '#E05300' : '#9CA3AF', borderBottom: activeTab === t ? '3px solid #E05300' : 'none' }}>
                  {t === 'info' ? 'ℹ️ Geral' : `📍 Waypoints (${waypoints.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'info' && (
                <div className="flex flex-col gap-5">
                  {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100">{error}</div>}
                  
                  {userRole === 'superadmin' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Organização Responsável</label>
                      <select value={form.organizationId} onChange={(e) => setForm(p => ({ ...p, organizationId: e.target.value }))} className="w-full p-3.5 rounded-2xl text-sm bg-gray-50 border border-gray-100 outline-none focus:ring-2 focus:ring-orange-500/20">
                        <option value="">Selecione...</option>
                        {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome da Rota</label>
                    <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full p-3.5 rounded-2xl text-sm bg-gray-50 border border-gray-100 outline-none" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Imagem de Capa (Bucket Supabase)</label>
                    <div className="relative w-full h-40 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 overflow-hidden flex items-center justify-center group">
                      {previewUrl ? (
                        <>
                          <img src={previewUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <button onClick={() => {setImageFile(null); setPreviewUrl(null); setForm(p => ({...p, coverImageUrl: ''}))}} className="bg-red-600 p-2 rounded-full text-white shadow-xl hover:bg-red-700">
                               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                             </button>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer text-orange-600 text-xs font-black uppercase flex flex-col items-center gap-2">
                           <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">📸</div>
                           Substituir Foto
                           <input type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dificuldade</label>
                      <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} className="w-full p-3.5 rounded-2xl text-sm bg-gray-50 border border-gray-100 outline-none">
                        <option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status da Rota</label>
                      <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full p-3.5 rounded-2xl text-sm font-bold bg-orange-50 border border-orange-100 text-orange-700 outline-none">
                        <option value="rascunho">Rascunho</option><option value="publicado">Publicado</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'waypoints' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-gray-900 p-4 rounded-2xl shadow-xl">
                    <p className="text-[9px] font-black text-orange-500 uppercase mb-2 tracking-widest">Adicionar Ponto Geográfico</p>
                    <form onSubmit={handleSearchAndAddWaypoint} className="flex gap-2">
                      <input type="text" placeholder="Nome do local ou morro..." value={wpSearchQuery} onChange={e => setWpSearchQuery(e.target.value)} className="flex-1 p-2.5 rounded-xl text-xs outline-none bg-white/10 text-white border border-white/10" />
                      <button type="submit" className="px-4 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase">Add</button>
                    </form>
                  </div>
                  {waypoints.map((wp, i) => (
                    <div key={wp.id} className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm hover:border-orange-200 transition-all group">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center text-[10px] font-black">{i+1}</div>
                          <span className="text-[9px] font-mono text-gray-400">{wp.latitude.toFixed(4)}, {wp.longitude.toFixed(4)}</span>
                        </div>
                        <button onClick={() => removeWaypoint(wp.id)} className="text-gray-300 hover:text-red-600 transition-colors">
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                      <input type="text" value={wp.name} onChange={e => setWaypoints(prev => prev.map(w => w.id === wp.id ? {...w, name: e.target.value} : w))} className="w-full p-2 text-sm font-black text-gray-900 border-b border-gray-100 outline-none focus:border-orange-500" placeholder="Nome do checkpoint..." />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 relative z-0">
             <div className="absolute top-6 left-6 right-6 z-[400] flex justify-center pointer-events-none">
              <form onSubmit={handleSearchMap} className="w-full max-w-xl bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl flex items-center pointer-events-auto border border-white">
                <div className="pl-3 text-gray-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
                <input type="text" placeholder="Explorar Satélite do Google..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 px-3 text-sm font-bold outline-none bg-transparent" />
                <button type="submit" className="px-6 py-2.5 bg-gray-900 text-white text-xs font-black uppercase rounded-xl hover:bg-black transition-all">Buscar</button>
              </form>
            </div>
            <div ref={mapContainerRef} className="absolute inset-0 bg-[#E5E3DF]" />
          </div>
        </div>
      </main>
    </div>
  )
}