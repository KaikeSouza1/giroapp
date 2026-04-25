// src/app/(mobile)/(app)/profile/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import NextImage from 'next/image'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import TabBar from '@/components/mobile/TabBar'

type Badge = {
  id: string
  name: string
  description: string | null
  imageUrl: string
  awardedAt: string
}

type CompletedRoute = {
  id: string
  routeName: string
  routeType: string
  completedAt: string
  distanceKm: string | null
  elapsedMinutes: number
  photos: string[]
  routeId: string
}

type ProfileData = {
  id: string
  displayName: string
  username: string
  bio: string | null
  avatarUrl: string | null
  followersCount: number
  followingCount: number
  isFollowing: boolean
  badges: Badge[]
  completedRoutes: CompletedRoute[]
}

export default function PublicProfilePage() {
  const router = useRouter()
  const params = useParams()
  const targetUserId = params.id as string

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'routes' | 'badges'>('routes')
  const [followLoading, setFollowLoading] = useState(false)
  
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      if (targetUserId === session.user.id) {
        router.push('/profile')
        return
      }

      try {
        const res = await fetch(`/api/profile/${targetUserId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        const data = await res.json()
        
        // CORREÇÃO: Garante que completedRoutes e photos sempre existam como arrays
        if (data.completedRoutes) {
          data.completedRoutes = data.completedRoutes
            .filter((r: any) => r.routeId !== null)
            .map((r: any) => ({
              ...r,
              photos: Array.isArray(r.photos) ? r.photos : []
            }))
        }
        
        setProfile(data)
      } catch (err) {
        console.error('Erro ao carregar perfil público:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [targetUserId, router, supabase.auth])

  async function toggleFollow() {
    setFollowLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch(`/api/profile/${targetUserId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (res.ok) {
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: !prev.isFollowing,
          followersCount: prev.isFollowing ? prev.followersCount - 1 : prev.followersCount + 1
        } : null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setFollowLoading(false)
    }
  }

  // CORREÇÃO: Formatação robusta de tempo
  const formatTime = (mins: number) => {
    if (!mins || mins <= 0) return '--'
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'caminhada': return { icon: '🥾', label: 'Caminhada', color: 'bg-green-100 text-green-700' }
      case 'cicloturismo': return { icon: '🚴', label: 'Ciclismo', color: 'bg-blue-100 text-blue-700' }
      default: return { icon: '📍', label: 'Rota Oficial', color: 'bg-orange-100 text-orange-700' }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 rounded-full animate-spin border-3 border-orange-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">

      {/* Visualizador de Foto Premium (Full Screen) */}
      {isPhotoViewerOpen && selectedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={() => setIsPhotoViewerOpen(false)}>
          <button className="absolute top-12 right-6 z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img src={selectedPhoto} alt="Visualização" className="max-w-[95%] max-h-[85%] object-contain rounded-3xl shadow-2xl shadow-orange-500/10 border-2 border-white/10" />
        </div>
      )}

      {/* Header Premium Espelhado */}
      <div className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        
        <button onClick={() => router.back()} className="absolute top-12 left-6 z-10 w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/30 active:scale-90 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div className="relative z-10 flex flex-col items-center text-center mt-6">
          <div className="relative mb-4">
            <img src={profile?.avatarUrl || ''} alt="Avatar" className="w-24 h-24 rounded-[32px] object-cover border-4 border-white/30 shadow-2xl" />
          </div>
          <h1 className="text-white font-black text-2xl leading-tight drop-shadow-md">{profile?.displayName}</h1>
          <p className="text-white/70 text-sm font-bold tracking-tight">@{profile?.username}</p>

          <button 
            onClick={toggleFollow}
            disabled={followLoading}
            className={`mt-6 px-10 py-3 rounded-[20px] font-black text-xs transition-all active:scale-95 shadow-xl ${profile?.isFollowing ? 'bg-white/10 text-white border border-white/40 backdrop-blur-md' : 'bg-white text-orange-600'}`}
          >
            {followLoading ? '...' : profile?.isFollowing ? 'SEGUINDO' : 'SEGUIR EXPLORADOR'}
          </button>
        </div>

        {/* Estatísticas com Links Ativos */}
        <div className="relative z-10 flex gap-3 mt-10">
          <div className="flex-1 text-center rounded-[24px] py-4 backdrop-blur-md border border-white/10" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-white font-black text-xl leading-none">{profile?.completedRoutes?.length ?? 0}</p>
            <p className="text-white/60 text-[9px] font-black uppercase mt-1.5 tracking-widest">Rotas</p>
          </div>
          <Link href={`/profile/${profile?.id}/network?tab=followers`} className="flex-1 text-center rounded-[24px] py-4 backdrop-blur-md border border-white/10 active:scale-95 transition-transform" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-white font-black text-xl leading-none">{profile?.followersCount ?? 0}</p>
            <p className="text-white/60 text-[9px] font-black uppercase mt-1.5 tracking-widest">Seguidores</p>
          </Link>
          <Link href={`/profile/${profile?.id}/network?tab=following`} className="flex-1 text-center rounded-[24px] py-4 backdrop-blur-md border border-white/10 active:scale-95 transition-transform" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-white font-black text-xl leading-none">{profile?.followingCount ?? 0}</p>
            <p className="text-white/60 text-[9px] font-black uppercase mt-1.5 tracking-widest">A seguir</p>
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50 rounded-t-[40px]" />
      </div>

      <div className="flex mx-6 mt-2 rounded-[22px] overflow-hidden border border-gray-100 bg-white mb-6 shadow-sm p-1">
        {(['routes', 'badges'] as const).map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`flex-1 py-3 text-[10px] font-black transition-all rounded-[18px] ${activeTab === tab ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400'}`}
          >
            {tab === 'routes' ? '🗺️ HISTÓRICO' : '🏆 CONQUISTAS'}
          </button>
        ))}
      </div>

      <div className="px-6 pb-12">
        {activeTab === 'routes' && (
          <div className="flex flex-col gap-6">
            {profile?.completedRoutes && profile.completedRoutes.length > 0 ? (
              profile.completedRoutes.map(route => {
                const info = getTypeInfo(route.routeType)
                return (
                  <div key={route.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
                    <div className="px-6 pt-5 pb-4 flex justify-between items-start border-b border-gray-50">
                      <div>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-2 ${info.color}`}>
                          <span className="text-[10px]">{info.icon}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest">{info.label}</span>
                        </div>
                        <h3 className="font-black text-gray-900 text-lg leading-tight tracking-tight">{route.routeName}</h3>
                        <p className="text-gray-400 text-xs mt-1.5 font-bold">{new Date(route.completedAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <Link href={`/routes/${route.routeId}`} className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100 active:scale-90 transition-all">VER MAPA</Link>
                    </div>

                    {/* Stats de Conclusão CORRIGIDOS */}
                    <div className="grid grid-cols-2 divide-x divide-gray-100 bg-gray-50/50 py-4 border-b border-gray-50">
                      <div className="text-center px-4">
                        <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Tempo Gasto</p>
                        <p className="font-black text-gray-800 text-base">{formatTime(route.elapsedMinutes)}</p>
                      </div>
                      <div className="text-center px-4">
                        <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">Total Percorrido</p>
                        <p className="font-black text-gray-800 text-base">{route.distanceKm || '--'} km</p>
                      </div>
                    </div>

                    {/* Galeria de Fotos CORRIGIDA */}
                    <div className="px-6 py-5">
                      <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-3">Registros da Aventura</p>
                      {route.photos && route.photos.length > 0 ? (
                        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-1">
                          {route.photos.map((p, i) => (
                            <button 
                              key={i} 
                              onClick={() => { setSelectedPhoto(p); setIsPhotoViewerOpen(true); }} 
                              className="relative w-28 h-28 flex-shrink-0 active:scale-95 transition-transform"
                            >
                              <img src={p} className="w-full h-full rounded-[24px] object-cover border-2 border-white shadow-md ring-1 ring-gray-100" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center border-2 border-dashed border-gray-100 rounded-[24px] bg-gray-50/30">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Sem fotos registradas</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-24 text-center flex flex-col items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-4xl shadow-inner">🗺️</div>
                <div>
                  <p className="text-gray-900 font-black text-base">Nenhuma rota oficial</p>
                  <p className="text-gray-400 text-xs font-medium px-10 mt-1">Este aventureiro ainda não completou rotas oficiais no Giro.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="grid grid-cols-3 gap-4">
            {profile?.badges && profile.badges.length > 0 ? (
              profile.badges.map(b => (
                <div key={b.id} className="bg-white rounded-[28px] p-4 text-center shadow-sm border border-gray-50 flex flex-col items-center justify-center gap-2">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-1">
                    <img src={b.imageUrl} className="w-10 h-10 object-contain drop-shadow-sm" />
                  </div>
                  <p className="text-[10px] font-black text-gray-900 leading-tight uppercase line-clamp-2 tracking-tighter">{b.name}</p>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-20 text-center">
                <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Sem conquistas ainda</p>
              </div>
            )}
          </div>
        )}
      </div>

      <TabBar active="feed" />
    </div>
  )
}