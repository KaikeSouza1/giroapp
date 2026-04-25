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
  
  // Estado para visualização de foto em tela cheia
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

      // Se o ID for o meu próprio, redireciona para o meu perfil
      if (targetUserId === session.user.id) {
        router.push('/profile')
        return
      }

      try {
        const res = await fetch(`/api/profile/${targetUserId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        const data = await res.json()
        
        // Filtra para garantir que apenas Rotas Oficiais apareçam (remove treinos)
        if (data.completedRoutes) {
          data.completedRoutes = data.completedRoutes.filter((r: any) => r.routeId !== null)
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

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 rounded-full animate-spin border-2 border-orange-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">

      {/* Visualizador de Foto em Tela Cheia */}
      {isPhotoViewerOpen && selectedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={() => setIsPhotoViewerOpen(false)}>
          <button className="absolute top-10 right-6 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img src={selectedPhoto} alt="Foto da Rota" className="max-w-[90%] max-h-[85%] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}

      {/* Header Premium */}
      <div className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        
        <button onClick={() => router.back()} className="absolute top-12 left-6 z-10 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-md">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div className="relative z-10 flex flex-col items-center text-center mt-4">
          <div className="relative mb-4">
            <img src={profile?.avatarUrl || ''} alt="Avatar" className="w-24 h-24 rounded-[32px] object-cover border-4 border-white/20 shadow-2xl" />
          </div>
          <h1 className="text-white font-black text-2xl leading-tight">{profile?.displayName}</h1>
          <p className="text-white/60 text-sm font-medium">@{profile?.username}</p>

          <button 
            onClick={toggleFollow}
            disabled={followLoading}
            className={`mt-5 px-8 py-2.5 rounded-2xl font-black text-sm transition-all active:scale-95 ${profile?.isFollowing ? 'bg-white/20 text-white border border-white/30' : 'bg-white text-orange-600 shadow-lg'}`}
          >
            {followLoading ? '...' : profile?.isFollowing ? 'SEGUINDO' : 'SEGUIR'}
          </button>
        </div>

        {/* ESTATÍSTICAS */}
        <div className="relative z-10 flex gap-3 mt-8">
          <div className="flex-1 text-center rounded-2xl py-3 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-white font-black text-xl leading-none">{profile?.completedRoutes?.length ?? 0}</p>
            <p className="text-white/60 text-[9px] font-bold uppercase mt-1 tracking-wider">Rotas</p>
          </div>
          <div className="flex-1 text-center rounded-2xl py-3 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-white font-black text-xl leading-none">{profile?.followersCount ?? 0}</p>
            <p className="text-white/60 text-[9px] font-bold uppercase mt-1 tracking-wider">Seguidores</p>
          </div>
          <div className="flex-1 text-center rounded-2xl py-3 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <p className="text-white font-black text-xl leading-none">{profile?.followingCount ?? 0}</p>
            <p className="text-white/60 text-[9px] font-bold uppercase mt-1 tracking-wider">A seguir</p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50 rounded-t-3xl" />
      </div>

      {/* Tabs */}
      <div className="flex mx-5 mt-2 rounded-2xl overflow-hidden border border-gray-100 bg-white mb-6 shadow-sm">
        {(['routes', 'badges'] as const).map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`flex-1 py-3.5 text-[11px] font-black transition-all ${activeTab === tab ? 'bg-orange-500 text-white' : 'text-gray-400'}`}
          >
            {tab === 'routes' ? '🗺️ HISTÓRICO DE ROTAS' : '🏆 CONQUISTAS'}
          </button>
        ))}
      </div>

      <div className="px-5">
        {activeTab === 'routes' && (
          <div className="flex flex-col gap-5">
            {profile?.completedRoutes && profile.completedRoutes.length > 0 ? (
              profile.completedRoutes.map(route => (
                <div key={route.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                  {/* Cabeçalho do Card */}
                  <div className="px-5 pt-4 pb-3 flex justify-between items-start border-b border-gray-50">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md mb-1.5 bg-orange-50 text-orange-700">
                        <span className="text-[10px]">📍</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Rota Oficial</span>
                      </div>
                      <h3 className="font-black text-gray-900 text-lg leading-tight">{route.routeName}</h3>
                      <p className="text-gray-400 text-xs mt-1 font-medium">{new Date(route.completedAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {/* Link para a rota oficial caso queira ver os detalhes da trilha */}
                    <Link href={`/routes/${route.routeId}`} className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">VER MAPA</Link>
                  </div>

                  {/* Stats da Conclusão */}
                  <div className="grid grid-cols-2 divide-x divide-gray-50 bg-gray-50/30 py-3 border-b border-gray-50">
                    <div className="text-center">
                      <p className="text-gray-400 text-[9px] font-bold uppercase">Tempo</p>
                      <p className="font-black text-gray-800">{formatTime(route.elapsedMinutes)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-[9px] font-bold uppercase">Distância</p>
                      <p className="font-black text-gray-800">{route.distanceKm || '--'} km</p>
                    </div>
                  </div>

                  {/* Galeria de Fotos do Usuário */}
                  <div className="px-5 py-4">
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Fotos capturadas</p>
                    {route.photos && route.photos.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {route.photos.map((p, i) => (
                          <button 
                            key={i} 
                            onClick={() => { setSelectedPhoto(p); setIsPhotoViewerOpen(true); }} 
                            className="relative w-24 h-24 flex-shrink-0 active:scale-95 transition-transform"
                          >
                            <img src={p} className="w-full h-full rounded-2xl object-cover border-2 border-white shadow-md" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center border border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Nenhum registro visual</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-3xl">🗺️</div>
                <p className="text-gray-500 font-bold text-sm">Nenhuma rota oficial concluída ainda</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="grid grid-cols-3 gap-3">
            {profile?.badges && profile.badges.length > 0 ? (
              profile.badges.map(b => (
                <div key={b.id} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-50">
                  <img src={b.imageUrl} className="w-12 h-12 mx-auto mb-2 object-contain" />
                  <p className="text-[10px] font-black text-gray-900 leading-tight uppercase line-clamp-2">{b.name}</p>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-20 text-center">
                <p className="text-gray-400 font-bold text-sm">Nenhuma insígnia conquistada</p>
              </div>
            )}
          </div>
        )}
      </div>

      <TabBar active="feed" />
    </div>
  )
}