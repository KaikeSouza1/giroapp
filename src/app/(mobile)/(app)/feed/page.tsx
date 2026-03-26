'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import { TabBar } from '../home/page'

type FeedItem = {
  id: string
  userId: string
  userName: string
  userUsername: string
  userAvatarUrl: string | null
  routeName: string
  routeId: string
  coverImageUrl: string | null
  type: string
  organizationName: string | null
  completedAt: string
  badgeName: string | null
  badgeImageUrl: string | null
  waypointCount: number
  distanceKm: string | null
}

export default function FeedPage() {
  const router = useRouter()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch('/api/feed', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const text = await res.text()
      const data = text ? JSON.parse(text) : []
      setFeed(Array.isArray(data) ? data : [])
      setLoading(false)
    }
    load()
  }, [])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}min atrás`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h atrás`
    return `${Math.floor(hours / 24)}d atrás`
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24">

      {/* Header Fixo Premium */}
      <div className="relative overflow-hidden px-6 pt-12 pb-6" style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 375 120" preserveAspectRatio="xMidYMid slice">
          <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,30 Q93,70 187,30 Q280,-10 375,30" fill="none" stroke="#fff" strokeWidth="1"/>
        </svg>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <NextImage src="/logogiroprincipal.png" alt="GIRO" width={80} height={32} priority className="drop-shadow-lg" />
            <p className="text-white/80 text-xs mt-0.5 font-medium tracking-wide">Comunidade</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20"><div className="w-8 h-8 border-3 border-gray-200 border-t-orange-500 rounded-full animate-spin" /></div>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl" style={{ background: '#FFF0EB' }}>🌍</div>
            <div className="text-center">
              <p className="text-gray-700 font-bold text-base">Feed vazio por enquanto</p>
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">Siga aventureiros para ver as trilhas deles!</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {feed.map(item => (
              <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 pb-2">

                {/* Header do Usuário */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-inner" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                    {item.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{item.userName}</p>
                    <p className="text-gray-400 text-xs">@{item.userUsername} • {timeAgo(item.completedAt)}</p>
                  </div>
                </div>

                {/* BANNER DA ROTA */}
                <Link href={`/routes/${item.routeId}`}>
                  {item.coverImageUrl ? (
                    <div className="w-full h-56 relative overflow-hidden bg-gray-100">
                      <img src={item.coverImageUrl} alt={item.routeName} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                      
                      {/* Overlay Gradiente Escuro na base da imagem */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      
                      {/* Badges Flutuantes (Tipo e Organização) no Topo */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/95 text-gray-800 uppercase tracking-wider shadow-sm">
                            {item.type}
                        </span>
                        {item.organizationName && (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-orange-600/90 text-white uppercase tracking-wider shadow-sm backdrop-blur-sm">
                                {item.organizationName}
                            </span>
                        )}
                      </div>

                      {/* Nome da Rota sobre a Imagem */}
                      <div className="absolute bottom-4 left-4 right-4">
                         <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1 drop-shadow-md">Concluiu a rota</p>
                         <h3 className="font-black text-white text-xl leading-tight drop-shadow-lg">{item.routeName}</h3>
                      </div>
                    </div>
                  ) : (
                    /* Fallback se não tiver foto */
                    <div className="w-full h-32 relative overflow-hidden flex flex-col justify-end p-4" style={{ background: 'linear-gradient(135deg, #FFF0EB, #FFE4D6)' }}>
                       <div className="absolute top-3 left-3 flex gap-2">
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-white/80 text-gray-800 uppercase tracking-wider">{item.type}</span>
                          {item.organizationName && <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-orange-500/80 text-white uppercase tracking-wider">{item.organizationName}</span>}
                       </div>
                       <p className="text-xs font-bold text-orange-800/60 uppercase tracking-widest mb-0.5">Concluiu a rota</p>
                       <h3 className="font-black text-gray-900 text-lg leading-tight">{item.routeName}</h3>
                    </div>
                  )}
                </Link>

                {/* Estatísticas do Post */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-50">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Distância</span>
                        <span className="font-black text-gray-800 text-sm">{item.distanceKm ? `${item.distanceKm} km` : '--'}</span>
                    </div>
                    <div className="w-px h-6 bg-gray-200"></div>
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Pontos</span>
                        <span className="font-black text-gray-800 text-sm">{item.waypointCount}</span>
                    </div>
                </div>

                {/* Ações (Curtir / Comentar) */}
                <div className="flex items-center gap-6 px-5 pt-3 pb-1">
                  <button className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </button>
                  <button className="flex items-center gap-2 text-gray-500 hover:text-orange-600 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      <TabBar active="feed" />
    </div>
  )
}