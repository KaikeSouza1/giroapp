'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push('/home')
  }

  const inputClass = 'w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200'
  const inputStyle = (field: string) => ({
    background: focused === field ? '#FFF8F5' : '#F7F7F7',
    border: focused === field ? '1.5px solid #E05300' : '1.5px solid #EFEFEF',
    boxShadow: focused === field ? '0 0 0 3px rgba(224,83,0,0.08)' : 'none',
  })

  return (
    <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">

      {/* Header laranja */}
      <div className="relative overflow-hidden px-6 pt-12 pb-10"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>

        <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,120 Q93,80 187,120 Q280,160 375,120" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,80 Q93,40 187,80 Q280,120 375,80" fill="none" stroke="#fff" strokeWidth="1"/>
          <path d="M0,160 Q93,120 187,160 Q280,200 375,160" fill="none" stroke="#fff" strokeWidth="1"/>
          <path d="M0,40 Q93,80 187,40 Q280,0 375,40" fill="none" stroke="#fff" strokeWidth="0.7"/>
        </svg>

        {/* Logo */}
        <div className="relative z-10 mb-6">
          <NextImage
            src="/logogiroprincipal.png"
            alt="GIRO"
            width={130}
            height={50}
            priority
            className="drop-shadow-lg"
          />
        </div>

        <div className="relative z-10">
          <h1 className="text-white font-bold text-2xl leading-tight">
            Bem-vindo<br />de volta 👋
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Entre para continuar sua jornada
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl" />
      </div>

      {/* Formulário */}
      <div className="flex-1 px-6 pt-4 pb-10 bg-white">
        <form onSubmit={handleLogin} className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="seuemail@exemplo.com"
              required
              className={inputClass}
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
              className={inputClass}
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
            className="w-full py-4 rounded-xl text-white font-bold text-sm mt-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #830200 0%, #E05300 60%, #FF8C00 100%)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>

        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-gray-300 text-xs">ou</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <p className="text-center text-gray-400 text-sm">
          Não tem conta?{' '}
          <Link href="/register" className="font-bold" style={{ color: '#E05300' }}>
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}