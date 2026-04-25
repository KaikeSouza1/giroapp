// src/app/(mobile)/(app)/feed/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import TabBar from '@/components/mobile/TabBar'

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
  waypointCount: number
  distanceKm: string | null
}

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
        const res = await fetch('/api/feed', { 
          headers: { Authorization: `Bearer ${session.access_token}` } 
        })
        const data = await res.json()
        // Filtra para mostrar apenas rotas oficiais concluídas (ignora treinos)
        const officialRoutes = Array.isArray(data) ? data.filter((i: any) => i.routeId !== null) : []
        setFeed(officialRoutes)
      } catch (err) {
        console.error("Erro ao carregar feed", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase.auth])

  // Lógica de Busca com Debounce (Preservada conforme diretriz)
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
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        })
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Erro na busca", error)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery, supabase.auth])

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
      
      {/* Header Premium com Gradiente Giro */}
      <div className="relative overflow-hidden px-6 pt-12 pb-8" 
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        
        {/* Padrão de Grid Visual */}
        <div className="absolute inset-0 opacity-10">
           <svg width="100%" height="100%"><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="1.5" /></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
        </div>

        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <NextImage src="/logogiroprincipal.png" alt="GIRO" width={85} height={34} priority className="drop-shadow-lg" />
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
          </div>

          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-sm text-white placeholder-white/60 outline-none backdrop-blur-md transition-all focus:bg-white/20"
              placeholder="Pesquisar aventureiros..."
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/70">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            {isSearching && (
               <div className="absolute inset-y-0 right-4 flex items-center">
                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Resultados da Pesquisa Flutuantes (Efeito Glass) */}
      {searchQuery.trim().length >= 2 && (
        <div className="absolute left-6 right-6 z-[60] mt-[-10px] bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300">
          {searchResults.length > 0 ? (
            searchResults.map(user => (
              <Link key={user.id} href={`/profile/${user.id}`} onClick={() => setSearchQuery('')}>
                <div className="flex items-center gap-4 p-4 hover:bg-orange-50 border-b border-gray-50 last:border-0 cursor-pointer active:bg-orange-100 transition-colors">
                  <img src={user.avatarUrl || ''} alt="" className="w-12 h-12 rounded-2xl object-cover border-2 border-gray-100 shadow-sm" />
                  <div>
                    <p className="font-black text-gray-900 text-sm leading-none mb-1">{user.displayName}</p>
                    <p className="text-gray-400 text-xs font-bold">@{user.username}</p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-8 text-center"><p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Nenhum resultado</p></div>
          )}
        </div>
      )}

      {/* Listagem do Feed */}
      <div className="px-5 pt-6 pb-12">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="flex flex-col gap-8">
            {feed.map(item => (
              <div key={item.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
                {/* Header do Post */}
                <Link href={`/profile/${item.userId}`}>
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="relative">
                      <img src={item.userAvatarUrl || ''} className="w-11 h-11 rounded-2xl object-cover border-2 border-orange-100 shadow-sm" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-gray-900 text-[13px] leading-tight">{item.userName}</p>
                      <p className="text-gray-400 text-[11px] font-medium tracking-tight">@{item.userUsername} • {timeAgo(item.completedAt)}</p>
                    </div>
                    <button className="text-gray-300"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg></button>
                  </div>
                </Link>

                {/* Imagem de Capa e Rota */}
                <Link href={`/routes/${item.routeId}`}>
                  <div className="w-full h-64 relative overflow-hidden">
                    <img src={item.coverImageUrl || ''} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 text-white mb-2 shadow-lg">
                        <span className="text-[9px] font-black uppercase tracking-widest">ROTA OFICIAL</span>
                      </div>
                      <h3 className="font-black text-white text-xl leading-tight drop-shadow-md">{item.routeName}</h3>
                    </div>
                  </div>
                </Link>

                {/* Estatísticas Rápidas do Card */}
                <div className="flex items-center gap-6 px-6 py-4 bg-gray-50/50">
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-[9px] uppercase font-black tracking-widest mb-0.5">Distância</span>
                    <span className="font-black text-gray-900 text-[15px]">{item.distanceKm ? `${item.distanceKm} km` : '--'}</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-[9px] uppercase font-black tracking-widest mb-0.5">Check-ins</span>
                    <span className="font-black text-gray-900 text-[15px]">{item.waypointCount}</span>
                  </div>
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