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
  routeName: string
  routeId: string
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
  const [token, setToken] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)

      const res = await fetch('/api/feed', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
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

      {/* Header */}
      <div className="relative overflow-hidden px-6 pt-12 pb-6"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 375 120" preserveAspectRatio="xMidYMid slice">
          <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,30 Q93,70 187,30 Q280,-10 375,30" fill="none" stroke="#fff" strokeWidth="1"/>
          <path d="M0,90 Q93,50 187,90 Q280,130 375,90" fill="none" stroke="#fff" strokeWidth="0.8"/>
        </svg>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <NextImage src="/logogiroprincipal.png" alt="GIRO" width={80} height={32} priority className="drop-shadow-lg" />
            <p className="text-white/60 text-xs mt-0.5">Feed da comunidade</p>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50 rounded-t-3xl" />
      </div>

      <div className="px-5 pt-2">
        {loading ? (
          <div className="flex flex-col gap-4 mt-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded w-24 mb-1.5" />
                    <div className="h-2.5 bg-gray-100 rounded w-16" />
                  </div>
                </div>
                <div className="h-32 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
              style={{ background: '#FFF0EB' }}>🌍</div>
            <div className="text-center">
              <p className="text-gray-700 font-bold text-base">Feed vazio por enquanto</p>
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                Siga outros aventureiros para ver as trilhas que eles completaram!
              </p>
            </div>
            <Link href="/home"
              className="px-6 py-3 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
              Explorar rotas →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-2">
            {feed.map(item => (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm"
                style={{ border: '1.5px solid #F5F5F5' }}>

                {/* Header do post */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                    {item.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{item.userName}</p>
                    <p className="text-gray-400 text-xs">@{item.userUsername} · {timeAgo(item.completedAt)}</p>
                  </div>
                  <button className="text-gray-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                    </svg>
                  </button>
                </div>

                {/* Card da conquista */}
                <div className="mx-4 mb-3 rounded-2xl p-4"
                  style={{ background: 'linear-gradient(135deg, #FFF8F5, #FFF0E8)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <circle cx="12" cy="8" r="6"/>
                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">Rota concluída!</p>
                      <p className="font-black text-gray-900 text-sm leading-tight truncate">{item.routeName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {item.waypointCount > 0 && (
                          <span className="text-xs text-gray-500">
                            📍 {item.waypointCount} pontos
                          </span>
                        )}
                        {item.distanceKm && (
                          <span className="text-xs text-gray-500">
                            📏 {item.distanceKm} km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Badge conquistada */}
                {item.badgeName && (
                  <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <span className="text-base">🏆</span>
                    <p className="text-xs font-bold text-yellow-700">
                      Insígnia desbloqueada: {item.badgeName}
                    </p>
                  </div>
                )}

                {/* Ações */}
                <div className="flex items-center gap-4 px-4 pb-4 pt-1">
                  <button className="flex items-center gap-1.5 text-gray-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span className="text-xs font-semibold">Curtir</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-gray-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span className="text-xs font-semibold">Comentar</span>
                  </button>
                  <Link href={`/routes/${item.routeId}`}
                    className="ml-auto text-xs font-bold px-3 py-1.5 rounded-xl"
                    style={{ background: '#FFF0EB', color: '#E05300' }}>
                    Ver rota →
                  </Link>
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