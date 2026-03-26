'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'

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

const difficultyLabel: Record<string, string> = {
  easy: 'Fácil', medium: 'Médio', hard: 'Difícil', extreme: 'Extremo'
}

const difficultyColor: Record<string, string> = {
  easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444', extreme: '#7c3aed'
}

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')

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

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [profileRes, routesRes] = await Promise.all([
        fetch('/api/users/me'),
        fetch('/api/routes'),
      ])

      const profileText = await profileRes.text()
      const routesText = await routesRes.text()

      const profileData = profileText ? JSON.parse(profileText) : null
      const routesData = routesText ? JSON.parse(routesText) : []

      setUser(profileData)
      setRoutes(Array.isArray(routesData) ? routesData : [])
      setLoading(false)
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-gray-100 border-t-orange-500 rounded-full animate-spin"
            style={{ borderWidth: '3px' }} />
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>

        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 375 220" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1"/>
          <path d="M0,140 Q93,100 187,140 Q280,180 375,140" fill="none" stroke="#fff" strokeWidth="1"/>
          <path d="M0,180 Q93,140 187,180 Q280,220 375,180" fill="none" stroke="#fff" strokeWidth="0.7"/>
        </svg>

        <div className="relative z-10 flex items-center justify-between mb-8">
          <NextImage src="/logogiroprincipal.png" alt="GIRO" width={90} height={36} priority
            className="drop-shadow-lg" />
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-lg"
                style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
                {user?.displayName?.charAt(0).toUpperCase() ?? 'U'}
              </div>
            </Link>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/70 text-sm">{greeting},</p>
          <h1 className="text-white font-black text-2xl leading-tight">
            {user?.displayName?.split(' ')[0] ?? 'Aventureiro'} 👋
          </h1>
          <p className="text-white/60 text-xs mt-1">
            Pronto para uma nova aventura?
          </p>
        </div>

        <div className="relative z-10 flex gap-3 mt-6">
          {[
            { label: 'Rotas feitas', value: '0' },
            { label: 'Insígnias', value: '0' },
            { label: 'Km percorridos', value: '0' },
          ].map(stat => (
            <div key={stat.label} className="flex-1 rounded-2xl px-3 py-2.5 text-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <p className="text-white font-black text-lg leading-none">{stat.value}</p>
              <p className="text-white/60 text-[10px] mt-0.5 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50 rounded-t-3xl" />
      </div>

      {/* ── Conteúdo ─────────────────────────────────────── */}
      <div className="px-5 -mt-2">

        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar trilhas..."
            className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm text-gray-800 placeholder-gray-400 outline-none bg-white shadow-sm"
            style={{ border: '1.5px solid #F0F0F0' }}
          />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {['Todas', 'Fácil', 'Médio', 'Difícil', 'Extremo'].map((filter, i) => (
            <button key={filter}
              className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all"
              style={{
                background: i === 0 ? 'linear-gradient(135deg, #830200, #E05300)' : 'white',
                color: i === 0 ? 'white' : '#888',
                border: i === 0 ? 'none' : '1.5px solid #F0F0F0',
              }}>
              {filter}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-gray-900">Rotas disponíveis</h2>
          <Link href="/routes" className="text-xs font-bold" style={{ color: '#E05300' }}>
            Ver todas →
          </Link>
        </div>

        {routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: '#FFF0EB' }}>🗺️</div>
            <p className="text-gray-500 font-semibold text-sm">Nenhuma rota disponível ainda</p>
            <p className="text-gray-400 text-xs text-center">
              O admin ainda não publicou nenhuma trilha.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {routes.map(route => (
              <Link key={route.id} href={`/routes/${route.id}`}>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm"
                  style={{ border: '1.5px solid #F5F5F5' }}>

                  <div className="h-36 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #FFF0EB, #FFE4D6)' }}>
                    {route.coverImageUrl ? (
                      <img src={route.coverImageUrl} alt={route.name}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                          stroke="#E05300" strokeWidth="1.5" opacity="0.4">
                          <path d="M3 12h18M3 6h18M3 18h18"/>
                          <circle cx="12" cy="12" r="10"/>
                        </svg>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: 'rgba(255,255,255,0.9)',
                        color: difficultyColor[route.difficulty],
                        backdropFilter: 'blur(8px)',
                      }}>
                      {difficultyLabel[route.difficulty] ?? route.difficulty}
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Organização e Tipo Adicionados Aqui */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {route.type}
                      </span>
                      {route.organizationName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-600">
                          {route.organizationName}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-gray-900 text-sm mb-1">{route.name}</h3>
                    {route.description && (
                      <p className="text-gray-400 text-xs leading-relaxed mb-3 line-clamp-2">
                        {route.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4">
                      {route.distanceKm && (
                        <div className="flex items-center gap-1.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="#E05300" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <span className="text-xs text-gray-500 font-medium">
                            {route.distanceKm} km
                          </span>
                        </div>
                      )}
                      {route.estimatedMinutes && (
                        <div className="flex items-center gap-1.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                            stroke="#E05300" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <span className="text-xs text-gray-500 font-medium">
                            {route.estimatedMinutes >= 60
                              ? `${Math.floor(route.estimatedMinutes / 60)}h${route.estimatedMinutes % 60 > 0 ? `${route.estimatedMinutes % 60}min` : ''}`
                              : `${route.estimatedMinutes} min`}
                          </span>
                        </div>
                      )}
                      <div className="ml-auto">
                        <div className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                          Iniciar →
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab Bar ───────────────────────────────────────── */}
      <TabBar active="home" />
    </div>
  )
}

export function TabBar({ active }: { active: 'home' | 'feed' | 'profile' }) {
  const tabs = [
    {
      key: 'home', href: '/home', label: 'Início',
      icon: (on: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24"
          fill={on ? '#E05300' : 'none'} stroke={on ? '#E05300' : '#BBB'} strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      key: 'feed', href: '/feed', label: 'Feed',
      icon: (on: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke={on ? '#E05300' : '#BBB'} strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      key: 'profile', href: '/profile', label: 'Perfil',
      icon: (on: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke={on ? '#E05300' : '#BBB'} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 z-50"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-around">
        {tabs.map(tab => (
          <Link key={tab.key} href={tab.href}
            className="flex flex-col items-center gap-1 min-w-[60px]">
            {tab.icon(active === tab.key)}
            <span className="text-[10px] font-semibold"
              style={{ color: active === tab.key ? '#E05300' : '#BBB' }}>
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}