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
        const res = await fetch('/api/feed', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await res.json()
        // Filtra para mostrar apenas rotas oficiais concluídas
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

  // Lógica de Busca com Debounce (Preservada)
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
      <div className="relative overflow-hidden px-6 pt-12 pb-6" style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <div className="absolute inset-0 opacity-10">
           <svg width="100%" height="100%"><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="1.5" /></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
        </div>

        <div className="relative z-10 flex flex-col gap-4">
          <NextImage src="/logogiroprincipal.png" alt="GIRO" width={80} height={32} priority className="drop-shadow-lg" />
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/60 outline-none backdrop-blur-md"
              placeholder="Encontrar aventureiros..."
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            {isSearching && (
               <div className="absolute inset-y-0 right-3 flex items-center"><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>
            )}
          </div>
        </div>
      </div>

      {/* Resultados da Pesquisa Flutuantes */}
      {searchQuery.trim().length >= 2 && (
        <div className="absolute left-4 right-4 z-50 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-80 overflow-y-auto">
          {searchResults.map(user => (
            <Link key={user.id} href={`/profile/${user.id}`} onClick={() => setSearchQuery('')}>
              <div className="flex items-center gap-3 p-3 hover:bg-orange-50 border-b border-gray-50 last:border-0 cursor-pointer">
                <img src={user.avatarUrl || ''} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-bold text-gray-900 text-sm">{user.displayName}</p>
                  <p className="text-gray-400 text-xs">@{user.username}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="flex flex-col gap-6">
            {feed.map(item => (
              <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 pb-2">
                <Link href={`/profile/${item.userId}`}>
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <img src={item.userAvatarUrl || ''} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{item.userName}</p>
                      <p className="text-gray-400 text-xs">@{item.userUsername} • {timeAgo(item.completedAt)}</p>
                    </div>
                  </div>
                </Link>

                <Link href={`/routes/${item.routeId}`}>
                  <div className="w-full h-56 relative overflow-hidden bg-gray-100">
                    <img src={item.coverImageUrl || ''} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Rota Concluída</p>
                      <h3 className="font-black text-white text-lg leading-tight">{item.routeName}</h3>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-[9px] uppercase font-bold">Distância</span>
                    <span className="font-black text-gray-800 text-sm">{item.distanceKm ? `${item.distanceKm} km` : '--'}</span>
                  </div>
                  <div className="w-px h-6 bg-gray-100" />
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-[9px] uppercase font-bold">Check-ins</span>
                    <span className="font-black text-gray-800 text-sm">{item.waypointCount}</span>
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