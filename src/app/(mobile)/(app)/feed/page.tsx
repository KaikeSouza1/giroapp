'use client'

import { useEffect, useState, useRef } from 'react'
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

// Tipo para os resultados da pesquisa
type SearchResult = {
  id: string
  displayName: string
  username: string
  avatarUrl: string | null
}

export default function FeedPage() {
  const router = useRouter()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  // Estados para a pesquisa
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      try {
        const res = await fetch('/api/feed', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const text = await res.text()
        const data = text ? JSON.parse(text) : []
        setFeed(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error("Erro ao carregar feed", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Lógica de Busca com Debounce ──────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Erro na busca", error)
      } finally {
        setIsSearching(false)
      }
    }, 500) // Aguarda 500ms depois que o user parar de digitar

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}min atrás`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h atrás`
    return `${Math.floor(hours / 24)}d atrás`
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">

      {/* Header Fixo Premium */}
      <div className="relative overflow-hidden px-6 pt-12 pb-6" style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        {/* Padrão de fundo */}
        <div className="absolute inset-0 opacity-10">
           <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                 <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="1.5" />
                 </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
           </svg>
        </div>

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <NextImage src="/logogiroprincipal.png" alt="GIRO" width={80} height={32} priority className="drop-shadow-lg" />
              <p className="text-white/80 text-xs mt-0.5 font-medium tracking-wide">Comunidade</p>
            </div>
          </div>

          {/* BARRA DE PESQUISA */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/70" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/60 outline-none focus:bg-white/20 focus:border-white/40 transition-all backdrop-blur-md font-medium"
              placeholder="Encontrar aventureiros..."
            />
            {isSearching && (
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               </div>
            )}
          </div>
        </div>
      </div>

      {/* RESULTADOS DA PESQUISA FLUTUANTES */}
      {searchQuery.trim().length >= 2 && (
        <div className="absolute left-4 right-4 z-50 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-80 overflow-y-auto">
          {isSearching && searchResults.length === 0 ? (
             <div className="p-4 text-center text-sm text-gray-500">A procurar...</div>
          ) : searchResults.length > 0 ? (
            <div className="flex flex-col">
              <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resultados ({searchResults.length})</span>
              </div>
              {searchResults.map(user => (
                <Link key={user.id} href={`/profile/${user.id}`} onClick={() => setSearchQuery('')}>
                  <div className="flex items-center gap-3 p-3 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{user.displayName}</p>
                      <p className="text-gray-400 text-xs">@{user.username}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
             <div className="p-4 text-center text-sm text-gray-500">Nenhum utilizador encontrado para "{searchQuery}"</div>
          )}
        </div>
      )}

      {/* FEED DE POSTS (MANTIDO) */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20"><div className="w-8 h-8 border-3 border-gray-200 border-t-orange-500 rounded-full animate-spin" /></div>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl" style={{ background: '#FFF0EB' }}>🌍</div>
            <div className="text-center">
              <p className="text-gray-700 font-bold text-base">Feed vazio por enquanto</p>
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">Usa a barra de pesquisa para encontrar e seguir aventureiros!</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {feed.map(item => (
              <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 pb-2">

                {/* Header do Usuário */}
                <Link href={`/profile/${item.userId}`}>
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    {item.userAvatarUrl ? (
                        <img src={item.userAvatarUrl} alt={item.userName} className="w-10 h-10 rounded-full object-cover shadow-sm border border-gray-100" />
                    ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-inner" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                        {item.userName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{item.userName}</p>
                        <p className="text-gray-400 text-xs">@{item.userUsername} • {timeAgo(item.completedAt)}</p>
                    </div>
                    </div>
                </Link>

                {/* BANNER DA ROTA */}
                <Link href={`/routes/${item.routeId}`}>
                  {item.coverImageUrl ? (
                    <div className="w-full h-56 relative overflow-hidden bg-gray-100">
                      <img src={item.coverImageUrl} alt={item.routeName} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      
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