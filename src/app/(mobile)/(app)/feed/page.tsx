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
  likesCount: number
  commentsCount: number
  hasLiked: boolean
}

type SearchResult = {
  id: string
  displayName: string
  username: string
  avatarUrl: string | null
}

type Comment = {
  id: string
  content: string
  createdAt: string
  user: { id: string; displayName: string; username: string; avatarUrl: string | null }
}

export default function FeedPage() {
  const router = useRouter()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Estados de comentários
  const [activeCommentSession, setActiveCommentSession] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newCommentText, setNewCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Instância do Supabase
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    async function load() {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) { 
        console.error("Erro de sessão no carregamento:", error);
        router.push('/login'); 
        return; 
      }

      try {
        const res = await fetch('/api/feed', { 
          headers: { Authorization: `Bearer ${session.access_token}` } 
        })
        
        if (!res.ok) throw new Error(`Erro API: ${res.status}`)
          
        const data = await res.json()
        
        const officialRoutes = Array.isArray(data)
          ? data
              .filter((i: any) => i.routeId !== null)
              .map((i: any) => ({
                ...i,
                likesCount: Number(i.likesCount) || 0,
                commentsCount: Number(i.commentsCount) || 0,
                hasLiked: i.hasLiked === true || String(i.hasLiked) === 'true',
              }))
          : []
        setFeed(officialRoutes)
      } catch (err) {
        console.error("Erro ao carregar feed", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  
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
        if (!session) return;
        
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
    }, 500)

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery, supabase])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}min atrás`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h atrás`
    return `${Math.floor(hours / 24)}d atrás`
  }

  
  async function toggleLike(sessionId: string, currentLiked: boolean) {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) {
      alert("Sua sessão expirou! Por favor, faça login novamente.")
      router.push('/login')
      return
    }

    
    setFeed(prev => prev.map(item =>
      item.id === sessionId
        ? { 
            ...item, 
            hasLiked: !currentLiked, 
            likesCount: currentLiked ? Math.max(0, item.likesCount - 1) : item.likesCount + 1 
          }
        : item
    ))

    try {
      const res = await fetch(`/api/feed/${sessionId}/like`, { 
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!res.ok) {
        
        const body = await res.json().catch(() => ({}))
        console.error("Erro ao curtir:", res.status, body)
        throw new Error(`Status ${res.status}: ${body?.error ?? 'Erro desconhecido'}`)
      }

      
      const result = await res.json()
      setFeed(prev => prev.map(item =>
        item.id === sessionId
          ? { 
              ...item, 
              hasLiked: result.liked,
              
              likesCount: result.likesCount != null ? Number(result.likesCount) : item.likesCount
            }
          : item
      ))
    } catch (e: any) {
      console.error("Erro ao curtir:", e)
      
      setFeed(prev => prev.map(item =>
        item.id === sessionId
          ? { 
              ...item, 
              hasLiked: currentLiked, 
              likesCount: currentLiked ? item.likesCount + 1 : Math.max(0, item.likesCount - 1) 
            }
          : item
      ))
      alert(`Não foi possível curtir: ${e.message}`)
    }
  }

  async function openComments(sessionId: string) {
    setActiveCommentSession(sessionId)
    setLoadingComments(true)
    setComments([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const res = await fetch(`/api/feed/${sessionId}/comments`, {
        headers: session ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      })
      if (!res.ok) throw new Error("Erro ao buscar comentários")
      const data = await res.json()
      setComments(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingComments(false)
    }
  }

  async function submitComment() {
    if (!newCommentText.trim() || !activeCommentSession) return
    
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) {
      alert("Sua sessão expirou! Por favor, faça login novamente.")
      router.push('/login')
      return
    }

    setSubmittingComment(true)

    try {
      const res = await fetch(`/api/feed/${activeCommentSession}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ content: newCommentText })
      })
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(`Status ${res.status}: ${body?.error ?? 'Erro desconhecido'}`)
      }
      
      const newComment = await res.json()
      setComments(prev => [...prev, newComment])
      setNewCommentText('')
      
      // FIX: Usa adição segura com Number() para evitar NaN ou concatenação de string
      setFeed(prev => prev.map(item =>
        item.id === activeCommentSession
          ? { ...item, commentsCount: (Number(item.commentsCount) || 0) + 1 }
          : item
      ))
    } catch (e: any) {
      console.error("Erro ao enviar comentário:", e)
      alert(`Erro ao enviar comentário: ${e.message}`)
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">
      
      {/* ── MODAL DE COMENTÁRIOS ── */}
      {activeCommentSession && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={() => setActiveCommentSession(null)}>
          <div className="bg-white w-full h-[75vh] rounded-t-[32px] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900">Comentários</h3>
              <button onClick={() => setActiveCommentSession(null)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {loadingComments ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10"><p className="text-gray-400 text-sm font-bold">Seja o primeiro a comentar! 💬</p></div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <img src={c.user?.avatarUrl || ''} className="w-9 h-9 rounded-xl object-cover border border-gray-100 shadow-sm" />
                    <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-none p-3.5 border border-gray-100">
                      <div className="flex justify-between items-end mb-1">
                        <p className="text-[12px] font-black text-gray-900">{c.user?.displayName || 'Usuário'}</p>
                        <span className="text-[9px] text-gray-400 font-bold">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-snug">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-white pb-8">
              <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-3xl p-1.5 focus-within:border-orange-500 focus-within:bg-white transition-colors shadow-inner">
                <textarea 
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escreva um comentário..."
                  className="flex-1 max-h-24 bg-transparent outline-none text-sm p-3 resize-none scrollbar-hide text-gray-800"
                  rows={1}
                />
                <button 
                  onClick={submitComment}
                  disabled={submittingComment || !newCommentText.trim()}
                  className="w-10 h-10 mb-1 mr-1 flex-shrink-0 flex items-center justify-center bg-orange-600 text-white rounded-full shadow-md disabled:opacity-50 active:scale-95 transition-transform"
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      <div className="relative overflow-hidden px-6 pt-12 pb-8" 
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        
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

      {}
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

      {/* Feed */}
      <div className="px-5 pt-6 pb-12">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="flex flex-col gap-8">
            {feed.map(item => (
              <div key={item.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
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

                <div className="flex items-center gap-6 px-6 py-4 bg-gray-50/50 border-b border-gray-50">
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

                <div className="px-6 py-4 flex items-center gap-6">
                  <button onClick={() => toggleLike(item.id, item.hasLiked)} className="flex items-center gap-2 transition-all active:scale-95 group">
                    {item.hasLiked ? (
                      <svg width="24" height="24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24" className="drop-shadow-sm"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    ) : (
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400 group-hover:text-red-500 transition-colors"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    )}
                    <span className={`text-sm font-black ${item.hasLiked ? 'text-red-500' : 'text-gray-500'}`}>{item.likesCount}</span>
                  </button>

                  <button onClick={() => openComments(item.id)} className="flex items-center gap-2 transition-all active:scale-95 group">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400 group-hover:text-orange-500 transition-colors"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    <span className="text-sm font-black text-gray-500">{Number(item.commentsCount) || 0}</span>
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