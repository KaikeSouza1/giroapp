'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import TabBar from '@/components/mobile/TabBar'

// 👇 DEFINIÇÃO DO TIPO QUE ESTAVA FALTANDO
export type PublicProfileData = {
  id: string
  displayName: string
  username: string
  bio: string | null
  avatarUrl: string | null
  followersCount: number
  followingCount: number
  isFollowing: boolean
  isMe: boolean
  badges: any[]
  completedRoutes: any[]
}

export default function ProfileClient({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  
  const [profile, setProfile] = useState<PublicProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'badges' | 'routes'>('badges')
  const [isFollowLoading, setIsFollowLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      try {
        const res = await fetch(`/api/profile/${resolvedParams.id}`, { 
            headers: { Authorization: `Bearer ${session.access_token}` } 
        })
        if (res.ok) setProfile(await res.json())
      } catch (err) {
        console.error("Erro ao carregar perfil:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [resolvedParams.id, router, supabase.auth])

  async function handleToggleFollow() {
    if (!profile || isFollowLoading) return
    setIsFollowLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/profile/${profile.id}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const data = await res.json()
      
      // 👇 TIPAGEM DO PREV CORRIGIDA
      setProfile((prev: PublicProfileData | null) => prev ? {
        ...prev,
        isFollowing: data.isFollowing,
        followersCount: data.isFollowing ? prev.followersCount + 1 : prev.followersCount - 1
      } : null)
    } catch (err) {
      console.error("Erro ao seguir:", err)
    } finally {
      setIsFollowLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} /></div>
  if (!profile) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-bold">Aventureiro não encontrado.</div>

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">
      <div className="relative overflow-hidden px-6 pt-12 pb-16" style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1"/>
        </svg>

        <div className="relative z-10 flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all backdrop-blur-md">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white/40" />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-lg bg-white/25 border-2 border-white/40">
                {profile.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-white font-black text-xl leading-tight">{profile.displayName}</h1>
              <p className="text-white/60 text-sm font-medium mt-0.5">@{profile.username}</p>
            </div>
          </div>

          {!profile.isMe && (
            <button 
                onClick={handleToggleFollow}
                disabled={isFollowLoading}
                className={`px-5 py-2 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 ${
                    profile.isFollowing 
                    ? 'bg-white/20 text-white border border-white/30 backdrop-blur-md' 
                    : 'bg-white text-[#E05300]' 
                }`}
            >
                {isFollowLoading ? '...' : profile.isFollowing ? 'A seguir' : 'Seguir'}
            </button>
          )}
        </div>

        {profile.bio && <p className="relative z-10 text-white/80 text-sm mt-4 line-clamp-2 px-1">{profile.bio}</p>}

        <div className="relative z-10 flex gap-3 mt-6">
          {[
            { label: 'Rotas', value: profile.completedRoutes.length },
            { label: 'Insígnias', value: profile.badges.length },
            { label: 'Seguidores', value: profile.followersCount },
            { label: 'A seguir', value: profile.followingCount },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center rounded-2xl py-2.5 bg-white/15 backdrop-blur-sm">
              <p className="text-white font-black text-lg leading-none">{s.value}</p>
              <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50 rounded-t-3xl" />
      </div>

      <div className="flex mx-5 mt-2 rounded-2xl overflow-hidden border border-gray-100 bg-white mb-4 shadow-sm">
        {(['badges', 'routes'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-sm font-bold transition-all"
            style={{ color: activeTab === tab ? 'white' : '#999', background: activeTab === tab ? 'linear-gradient(135deg, #830200, #E05300)' : 'transparent' }}>
            {tab === 'badges' ? `🏆 Insígnias (${profile.badges.length})` : `🗺️ Rotas (${profile.completedRoutes.length})`}
          </button>
        ))}
      </div>

      <div className="px-5">
        {activeTab === 'badges' && (
          profile.badges.length === 0 ? (
             <div className="py-12 text-center"><p className="text-gray-400 font-bold text-sm">Nenhuma insígnia conquistada.</p></div>
          ) : (
             <div className="grid grid-cols-3 gap-3">
               {profile.badges.map((badge: any) => (
                 <div key={badge.id} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
                   <img src={badge.imageUrl} alt={badge.name} className="w-12 h-12 rounded-xl mx-auto mb-2 object-cover" />
                   <p className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2">{badge.name}</p>
                 </div>
               ))}
             </div>
          )
        )}

        {activeTab === 'routes' && (
          profile.completedRoutes.length === 0 ? (
             <div className="py-12 text-center"><p className="text-gray-400 font-bold text-sm">Nenhuma rota concluída.</p></div>
          ) : (
            <div className="flex flex-col gap-3">
              {profile.completedRoutes.map((route: any) => (
                <div key={route.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#830200] to-[#E05300]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{route.routeName}</p>
                    <p className="text-gray-400 text-xs mt-1 font-medium">{new Date(route.completedAt).toLocaleDateString('pt-PT')} {route.distanceKm ? `• ${route.distanceKm} km` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      <TabBar active="feed" />
    </div>
  )
}