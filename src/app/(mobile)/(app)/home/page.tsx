// src/app/(mobile)/(app)/home/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import RouteCard from '@/components/mobile/RouteCard'
import TabBar from '@/components/mobile/TabBar'

type UserProfile = {
  id: string
  displayName: string
  username: string
  avatarUrl: string | null
  isSelfieCaptured: boolean
}

type Route = {
  id: string
  name: string
  description: string | null
  difficulty: string
  type: string
  distanceKm: string | null
  estimatedMinutes: number | null
  coverImageUrl: string | null
  status: string
  organizationName: string | null
}

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const [filter, setFilter] = useState<string>('Todas')
  
  // Estado para a bolinha do sininho
  const [unreadCount, setUnreadCount] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Bom dia')
    else if (hour < 18) setGreeting('Boa tarde')
    else setGreeting('Boa noite')
  }, [])

  // Carregamento inicial pesado (Perfil, Rotas e Notificações)
  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const headers = { Authorization: `Bearer ${session.access_token}` }

      const [profileRes, routesRes, notificationsRes] = await Promise.all([
        fetch('/api/users/me', { headers }),
        fetch('/api/routes', { headers }),
        fetch('/api/notifications?countOnly=true', { headers })
      ])

      const profileData = profileRes.ok ? await profileRes.json() : null
      const routesData = routesRes.ok ? await routesRes.json() : []
      const notifData = notificationsRes.ok ? await notificationsRes.json() : { count: 0 }

      setUser(profileData)
      setRoutes(Array.isArray(routesData) ? routesData : [])
      setUnreadCount(notifData.count || 0)
      setLoading(false)
    }

    loadData()
  }, [router, supabase.auth])

  // -- POLLING SUAVE (Sem Realtime) --
  // Atualiza apenas o contador de notificações a cada 30 segundos
  useEffect(() => {
    async function checkUnreadNotifications() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      try {
        const res = await fetch('/api/notifications?countOnly=true', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.count || 0)
        }
      } catch (err) {
        console.error("Erro ao checar notificações em background")
      }
    }

    // Configura o intervalo para rodar a cada 30 segundos (30000 milissegundos)
    const intervalId = setInterval(checkUnreadNotifications, 30000)

    // Limpa o intervalo se o usuário sair da tela Home
    return () => clearInterval(intervalId)
  }, [supabase.auth])

  const difficultyMap: Record<string, string> = {
    Fácil: 'facil',
    Médio: 'medio',
    Difícil: 'dificil',
    Extremo: 'extremo',
  }

  const filteredRoutes =
    filter === 'Todas'
      ? routes
      : routes.filter((r) => r.difficulty === difficultyMap[filter])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full animate-spin"
            style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }}
          />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">

      {/* ── Header ───────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{
          background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)',
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.1]"
          viewBox="0 0 375 220"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M0,100 Q93,60 187,100 Q280,140 375,100"
            fill="none" stroke="#fff" strokeWidth="1.5"
          />
          <path
            d="M0,60 Q93,20 187,60 Q280,100 375,60"
            fill="none" stroke="#fff" strokeWidth="1"
          />
          <path
            d="M0,140 Q93,100 187,140 Q280,180 375,140"
            fill="none" stroke="#fff" strokeWidth="1"
          />
        </svg>

        <div className="relative z-10 flex items-center justify-between mb-8">
          <NextImage
            src="/logogiroprincipal.png"
            alt="GIRO"
            width={90}
            height={36}
            priority
            className="drop-shadow-lg"
          />
          <div className="flex items-center gap-3">
            
            {/* ── BOTÃO DE NOTIFICAÇÃO (SININHO) ── */}
            <Link
              href="/notifications"
              className="relative w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {/* Bolinha vermelha de notificação via Polling */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border-2 border-[#E05300] text-[8px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <Link href="/profile">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="Perfil" className="w-9 h-9 rounded-full object-cover shadow-lg border-2 border-white/40" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-lg" style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
                  {user?.displayName?.charAt(0).toUpperCase() ?? 'U'}
                </div>
              )}
            </Link>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/70 text-sm">{greeting},</p>
          <h1 className="text-white font-black text-2xl leading-tight">
            {user?.displayName?.split(' ')[0] ?? 'Aventureiro'} 👋
          </h1>
          <p className="text-white/60 text-xs mt-1">Pronto para uma nova aventura?</p>
        </div>

        <div className="relative z-10 flex gap-3 mt-6">
          {[
            { label: 'Rotas feitas', value: '0' },
            { label: 'Insígnias', value: '0' },
            { label: 'Km percorridos', value: '0' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex-1 rounded-2xl px-3 py-2.5 text-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <p className="text-white font-black text-lg leading-none">{stat.value}</p>
              <p className="text-white/60 text-[10px] mt-0.5 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50 rounded-t-3xl" />
      </div>

      {/* ── Conteúdo ─────────────────────────────────────── */}
      <div className="px-5 -mt-2">

        <div className="relative mb-5">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar trilhas..."
            className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm text-gray-800 placeholder-gray-400 outline-none bg-white shadow-sm"
            style={{ border: '1.5px solid #F0F0F0' }}
          />
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {['Todas', 'Fácil', 'Médio', 'Difícil', 'Extremo'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all"
              style={{
                background: filter === f ? 'linear-gradient(135deg, #830200, #E05300)' : 'white',
                color: filter === f ? 'white' : '#888',
                border: filter === f ? 'none' : '1.5px solid #F0F0F0',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-black text-gray-900">Rotas disponíveis</h2>
            {filter !== 'Todas' && (
              <p className="text-xs text-gray-400 mt-0.5">
                {filteredRoutes.length} rota{filteredRoutes.length !== 1 ? 's' : ''} encontrada
                {filteredRoutes.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <Link href="/routes" className="text-xs font-bold" style={{ color: '#E05300' }}>
            Ver todas →
          </Link>
        </div>

        {filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: '#FFF0EB' }}>
              🗺️
            </div>
            <p className="text-gray-500 font-semibold text-sm">
              {filter === 'Todas'
                ? 'Nenhuma rota disponível ainda'
                : `Nenhuma rota "${filter}" disponível`}
            </p>
            {filter !== 'Todas' && (
              <button onClick={() => setFilter('Todas')} className="text-xs font-bold" style={{ color: '#E05300' }}>
                Ver todas as rotas →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredRoutes.map((route) => (
              <RouteCard
                key={route.id}
                id={route.id}
                name={route.name}
                description={route.description}
                difficulty={route.difficulty}
                type={route.type}
                distanceKm={route.distanceKm}
                estimatedMinutes={route.estimatedMinutes}
                coverImageUrl={route.coverImageUrl}
                organizationName={route.organizationName}
              />
            ))}
          </div>
        )}
      </div>

      <TabBar active="home" />
    </div>
  )
}