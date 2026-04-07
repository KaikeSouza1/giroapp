// src/app/(mobile)/(app)/profile/[id]/page.tsx
// ATENÇÃO: Este arquivo substitui AMBOS os arquivos duplicados que existiam:
// - src/app/(mobile)/(app)/profile/[id]/page.tsx  (antigo, com bug)
// - src/app/(mobile)/(app)/profile/[id]/ProfileClient.tsx  (pode ser deletado)
//
// A lógica foi consolidada aqui para evitar confusão e inconsistências.

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

export function generateStaticParams() {
  return []
}

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()

  const [profile, setProfile] = useState<PublicProfileData | null>(null)
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'treinos' | 'trilhas' | 'badges'>('treinos')
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const [followError, setFollowError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      try {
        const [resProfile, resFeed] = await Promise.all([
          fetch(`/api/profile/${resolvedParams.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          fetch(`/api/feed?userId=${resolvedParams.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ])

        if (resProfile.ok) setProfile(await resProfile.json())
        if (resFeed.ok) {
          const data = await resFeed.json()
          setFeed(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [resolvedParams.id, router, supabase.auth])

  // LÓGICA DE SEGUIR CORRIGIDA:
  // 1. Obtém o token fresco da sessão (nunca usa um token guardado em estado)
  // 2. Atualiza a UI SOMENTE se a API retornar sucesso (res.ok)
  // 3. Nunca decrementa o contador quando a ação falha
  async function handleToggleFollow() {
    if (!profile || isFollowLoading) return
    setIsFollowLoading(true)
    setFollowError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const res = await fetch(`/api/profile/${profile.id}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await res.json()

      // SÓ atualiza a tela se a API retornou sucesso
      if (!res.ok) {
        throw new Error(data.error || 'Falha na comunicação com o servidor.')
      }

      // Atualiza o estado local com o valor REAL que veio do servidor
      setProfile((prev) => {
        if (!prev) return null

        const newFollowersCount = data.isFollowing
          ? prev.followersCount + 1
          : Math.max(0, prev.followersCount - 1)

        return {
          ...prev,
          isFollowing: data.isFollowing,
          followersCount: newFollowersCount,
        }
      })
    } catch (err: any) {
      console.error('Erro ao seguir:', err)
      setFollowError(err.message || 'Não foi possível concluir a ação.')
    } finally {
      setIsFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-bold">
        Aventureiro não encontrado.
      </div>
    )
  }

  const treinos = feed.filter((i) => i.routeId === null)
  const trilhas = feed.filter((i) => i.routeId !== null)

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">
      {/* Header */}
      <div
        className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}
      >
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5" />
          <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1" />
        </svg>

        <div className="relative z-10 flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all backdrop-blur-md"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white/40"
              />
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
              className={`px-5 py-2 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-1 disabled:opacity-60 ${
                profile.isFollowing
                  ? 'bg-transparent text-white border border-white/30 backdrop-blur-md'
                  : 'bg-white text-[#E05300] border border-transparent'
              }`}
            >
              {isFollowLoading ? (
                <span className="animate-pulse">Aguarde...</span>
              ) : profile.isFollowing ? (
                <>✓ Seguindo</>
              ) : (
                <>+ Seguir</>
              )}
            </button>
          )}
        </div>

        {/* Mensagem de erro de seguir (não intrusiva) */}
        {followError && (
          <div className="relative z-10 mt-3 px-3 py-2 rounded-xl bg-red-500/20 border border-red-300/30">
            <p className="text-white/80 text-xs font-medium">{followError}</p>
          </div>
        )}

        {profile.bio && (
          <p className="relative z-10 text-white/80 text-sm mt-4 line-clamp-2 px-1">{profile.bio}</p>
        )}

        <div className="relative z-10 flex gap-3 mt-6">
          <div className="flex-1 text-center rounded-2xl py-2.5 bg-white/15 backdrop-blur-sm">
            <p className="text-white font-black text-lg leading-none">{treinos.length}</p>
            <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider truncate">Treinos</p>
          </div>
          <div className="flex-1 text-center rounded-2xl py-2.5 bg-white/15 backdrop-blur-sm">
            <p className="text-white font-black text-lg leading-none">{trilhas.length}</p>
            <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider truncate">Trilhas</p>
          </div>

          {/* Links de rede usando profile.id (que já sabemos que existe aqui) */}
          <Link
            href={`/profile/${profile.id}/network?tab=followers`}
            className="flex-1 text-center rounded-2xl py-2.5 bg-white/15 backdrop-blur-sm active:scale-95 transition-transform block"
          >
            <p className="text-white font-black text-lg leading-none">{Math.max(0, profile.followersCount)}</p>
            <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider truncate">Seguidores</p>
          </Link>

          <Link
            href={`/profile/${profile.id}/network?tab=following`}
            className="flex-1 text-center rounded-2xl py-2.5 bg-white/15 backdrop-blur-sm active:scale-95 transition-transform block"
          >
            <p className="text-white font-black text-lg leading-none">{Math.max(0, profile.followingCount)}</p>
            <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider truncate">A seguir</p>
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50 rounded-t-3xl" />
      </div>

      {/* Abas */}
      <div className="flex mx-5 mt-2 rounded-2xl overflow-hidden border border-gray-100 bg-white mb-4 shadow-sm">
        {(['treinos', 'trilhas', 'badges'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-[11px] font-bold transition-all uppercase tracking-wider"
            style={{
              color: activeTab === tab ? 'white' : '#999',
              background: activeTab === tab ? 'linear-gradient(135deg, #830200, #E05300)' : 'transparent',
            }}
          >
            {tab === 'treinos' ? 'Treinos' : tab === 'trilhas' ? 'Trilhas' : 'Insígnias'}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      <div className="px-5">
        {activeTab === 'treinos' && (
          treinos.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-400 font-bold text-sm">Nenhum treino livre gravado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {treinos.map((item: any) => {
                const meta = ACTIVITY_META[item.activityType] || { label: item.activityType, emoji: '🔥' }
                return (
                  <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
                    <div className="w-full aspect-square bg-[#0A0A0A] relative">
                      {item.socialImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.socialImageUrl} className="w-full h-full object-cover" alt="Trajeto" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-30 text-3xl">
                          {meta.emoji}
                        </div>
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

        {activeTab === 'trilhas' && (
          trilhas.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-400 font-bold text-sm">Nenhuma rota concluída.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {trilhas.map((item: any) => (
                <Link key={item.id} href={`/routes/${item.routeId}`}>
                  <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 active:scale-[0.98] transition-transform">
                    {item.coverImageUrl ? (
                      <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.coverImageUrl} className="w-full h-full object-cover" alt={item.routeName} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#830200] to-[#E05300]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-sm truncate">{item.routeName}</p>
                      <p className="text-gray-400 text-[11px] mt-1 font-bold">
                        {new Date(item.completedAt).toLocaleDateString('pt-BR')} • {item.distanceKm} km
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {activeTab === 'badges' && (
          profile.badges.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-400 font-bold text-sm">Nenhuma insígnia conquistada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {profile.badges.map((badge: any) => (
                <div key={badge.id} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100 flex flex-col items-center justify-center aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badge.imageUrl} alt={badge.name} className="w-12 h-12 rounded-full mb-2 object-cover border border-gray-100" />
                  <p className="text-[10px] font-black text-gray-900 leading-tight line-clamp-2">{badge.name}</p>
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