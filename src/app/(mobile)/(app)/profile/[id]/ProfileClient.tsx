'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import TabBar from '@/components/mobile/TabBar'
import Link from 'next/link'

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

const ACTIVITY_META: Record<string, { label: string; emoji: string }> = {
  corrida: { label: 'Corrida', emoji: '🏃' },
  cicloturismo: { label: 'Ciclismo', emoji: '🚴' },
  caminhada: { label: 'Caminhada', emoji: '🚶' },
}

export default function ProfileClient({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  
  const [profile, setProfile] = useState<PublicProfileData | null>(null)
  
  // ── NOVO: Armazenar o feed do usuário ──
  const [feed, setFeed] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'treinos' | 'trilhas' | 'badges'>('treinos')
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
        // Dispara as duas chamadas ao mesmo tempo para ser mais rápido
        const [resProfile, resFeed] = await Promise.all([
          fetch(`/api/profile/${resolvedParams.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch(`/api/feed?userId=${resolvedParams.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        ])

        if (resProfile.ok) setProfile(await resProfile.json())
        if (resFeed.ok) {
           const data = await resFeed.json()
           setFeed(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [resolvedParams.id, router, supabase.auth])

  // Lógica de Seguir (Original e intocada)
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

  // Separar treinos de trilhas
  const treinos = feed.filter(i => i.routeId === null)
  const trilhas = feed.filter(i => i.routeId !== null)

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">
      {/* ── HEADER DO PERFIL (ORIGINAL E INTOCADO) ── */}
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

        {/* ESTATÍSTICAS */}
        <div className="relative z-10 flex gap-3 mt-6">
          {[
            { label: 'Treinos', value: treinos.length },
            { label: 'Trilhas', value: trilhas.length },
            { label: 'Seguidores', value: profile.followersCount },
            { label: 'A seguir', value: profile.followingCount },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center rounded-2xl py-2.5 bg-white/15 backdrop-blur-sm">
              <p className="text-white font-black text-lg leading-none">{s.value}</p>
              <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider truncate">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50 rounded-t-3xl" />
      </div>

      {/* ── ABAS DE NAVEGAÇÃO ── */}
      <div className="flex mx-5 mt-2 rounded-2xl overflow-hidden border border-gray-100 bg-white mb-4 shadow-sm">
        {(['treinos', 'trilhas', 'badges'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-[11px] font-bold transition-all uppercase tracking-wider"
            style={{ color: activeTab === tab ? 'white' : '#999', background: activeTab === tab ? 'linear-gradient(135deg, #830200, #E05300)' : 'transparent' }}>
            {tab === 'treinos' ? `Treinos` : tab === 'trilhas' ? `Trilhas` : `Insígnias`}
          </button>
        ))}
      </div>

      {/* ── CONTEÚDO DAS ABAS ── */}
      <div className="px-5">
        
        {/* ABA: TREINOS LIVRES */}
        {activeTab === 'treinos' && (
          treinos.length === 0 ? (
             <div className="py-12 text-center"><p className="text-gray-400 font-bold text-sm">Nenhum treino livre gravado.</p></div>
          ) : (
             <div className="grid grid-cols-2 gap-3">
               {treinos.map((item: any) => {
                 const meta = ACTIVITY_META[item.activityType] || { label: item.activityType, emoji: '🔥' }
                 return (
                   <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
                     <div className="w-full aspect-square bg-[#0A0A0A] relative">
                       {item.socialImageUrl ? (
                         <img src={item.socialImageUrl} className="w-full h-full object-cover" alt="Trajeto" />
                       ) : (
                         <div className="absolute inset-0 flex items-center justify-center opacity-30 text-3xl">{meta.emoji}</div>
                       )}
                       <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold">
                         {item.distanceKm} km
                       </div>
                     </div>
                     <div className="p-3">
                       <p className="text-gray-900 text-xs font-black truncate">{meta.label}</p>
                       <p className="text-gray-400 text-[10px] mt-0.5">{item.averagePace}/km</p>
                     </div>
                   </div>
                 )
               })}
             </div>
          )
        )}

        {/* ABA: TRILHAS (Usando a sua lista de CompletedRoutes original mas pelo Feed) */}
        {activeTab === 'trilhas' && (
          trilhas.length === 0 ? (
             <div className="py-12 text-center"><p className="text-gray-400 font-bold text-sm">Nenhuma rota concluída.</p></div>
          ) : (
            <div className="flex flex-col gap-3">
              {trilhas.map((item: any) => (
                <Link key={item.id} href={`/routes/${item.routeId}`}>
                  <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50">
                    {item.coverImageUrl ? (
                      <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden">
                        <img src={item.coverImageUrl} className="w-full h-full object-cover" alt={item.routeName} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#830200] to-[#E05300]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{item.routeName}</p>
                      <p className="text-gray-400 text-xs mt-1 font-medium">
                        {new Date(item.completedAt).toLocaleDateString('pt-PT')} • {item.distanceKm} km
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* ABA: INSÍGNIAS (A sua original!) */}
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

      </div>
      <TabBar active="feed" />
    </div>
  )
}