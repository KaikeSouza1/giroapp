'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    // Busca os dados do usuário no nosso banco para checar a ROLE (SaaS)
    const res = await fetch('/api/users/me')
    const user = await res.json()

    // Verifica se tem permissão para acessar o painel (Superadmin ou Admin de Organização)
    if (user?.role !== 'superadmin' && user?.role !== 'admin_org') {
      await supabase.auth.signOut()
      setError('Acesso negado. Esta conta não tem permissão de administrador.')
      setLoading(false)
      return
    }

    // Redirecionamento inteligente baseado no nível de acesso
    if (user.role === 'superadmin') {
      router.push('/dashboard/organizations')
    } else {
      router.push('/dashboard/routes')
    }
  }

  const inputStyle = (field: string) => ({
    background: focused === field ? '#FFF8F5' : '#F7F7F7',
    border: focused === field ? '1.5px solid #E05300' : '1.5px solid #EFEFEF',
    boxShadow: focused === field ? '0 0 0 3px rgba(224,83,0,0.08)' : 'none',
  })

  return (
    <div className="min-h-screen flex" style={{ background: '#F9F9F9' }}>

      {/* Painel esquerdo — laranja */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 60%, #FF8C00 100%)' }}>

        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,200 Q150,120 300,200 Q450,280 600,200" fill="none" stroke="#fff" strokeWidth="2"/>
          <path d="M0,350 Q150,270 300,350 Q450,430 600,350" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,500 Q150,420 300,500 Q450,580 600,500" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,650 Q150,570 300,650 Q450,730 600,650" fill="none" stroke="#fff" strokeWidth="1"/>
          <path d="M0,100 Q150,180 300,100 Q450,20 600,100" fill="none" stroke="#fff" strokeWidth="1"/>
        </svg>

        <div className="relative z-10">
          <NextImage src="/logogiroprincipal.png" alt="GIRO" width={150} height={60} priority className="drop-shadow-lg brightness-0 invert" />
        </div>

        <div className="relative z-10">
          <h2 className="text-white text-4xl font-black leading-tight mb-4">
            Painel de<br />Administração
          </h2>
          <p className="text-white/70 text-base leading-relaxed">
            Gerencie rotas, waypoints e acompanhe os aventureiros do GIRO.
          </p>

          <div className="flex flex-col gap-3 mt-8">
            {[
              { icon: '🗺️', text: 'Cadastre rotas e waypoints' },
              { icon: '✅', text: 'Publique e arquive trilhas' },
              { icon: '👥', text: 'Gerencie usuários e check-ins' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {item.icon}
                </div>
                <span className="text-white/80 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/30 text-xs">
          © {new Date().getFullYear()} GIRO — Área restrita
        </div>
      </div>

      {/* Painel direito — form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden mb-8">
            <NextImage src="/logogiroprincipal.png" alt="GIRO" width={120} height={48} priority />
          </div>

          <h1 className="text-3xl font-black text-gray-900 mb-1">Bem-vindo</h1>
          <p className="text-gray-400 text-sm mb-8">Acesso exclusivo para parceiros e administradores</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="admin@exemplo.com"
                required
                className="w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all"
                style={inputStyle('email')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all"
                style={inputStyle('password')}
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #830200 0%, #E05300 60%, #FF8C00 100%)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : 'Acessar painel'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}