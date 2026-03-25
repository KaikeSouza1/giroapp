'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'

type Field = 'displayName' | 'username' | 'email' | 'password' | 'confirmPassword'
type Step = 'form' | 'selfie' | 'uploading' | 'success'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [form, setForm] = useState({
    displayName: '', username: '', email: '', password: '', confirmPassword: '',
  })
  const [focused, setFocused] = useState<Field | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('form')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const inputClass = 'w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200'
  const inputStyle = (field: Field) => ({
    background: focused === field ? '#FFF8F5' : '#F7F7F7',
    border: focused === field ? '1.5px solid #E05300' : '1.5px solid #EFEFEF',
    boxShadow: focused === field ? '0 0 0 3px rgba(224,83,0,0.08)' : 'none',
  })

  const HeaderLogo = ({ showLogin = false }: { showLogin?: boolean }) => (
    <div className="relative overflow-hidden px-6 pt-12 pb-10"
      style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,90 Q93,130 187,90 Q280,50 375,90" fill="none" stroke="#fff" strokeWidth="1.5"/>
        <path d="M0,50 Q93,90 187,50 Q280,10 375,50" fill="none" stroke="#fff" strokeWidth="1"/>
        <path d="M0,130 Q93,170 187,130 Q280,90 375,130" fill="none" stroke="#fff" strokeWidth="0.8"/>
      </svg>
      <div className={`relative z-10 mb-6 ${showLogin ? 'flex items-center justify-between' : ''}`}>
        <NextImage
          src="/logogiroprincipal.png"
          alt="GIRO"
          width={showLogin ? 110 : 130}
          height={showLogin ? 42 : 50}
          priority
          className="drop-shadow-lg"
        />
        {showLogin && (
          <Link href="/login"
            className="text-xs font-semibold px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
            Entrar
          </Link>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl" />
    </div>
  )

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) { setError('As senhas não coincidem.'); return }
    if (form.password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    setStep('selfie')
    setTimeout(() => startCamera(), 300)
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 640 }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões.')
      setStep('form')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85))
    stopCamera()
  }

  async function handleFinalSubmit() {
    if (!photoDataUrl) return
    setStep('uploading')

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { display_name: form.displayName, username: form.username },
      },
    })

    if (authError || !data.user) {
      setError(authError?.message || 'Erro ao criar conta.')
      setStep('selfie')
      return
    }

    await supabase.auth.signInWithPassword({ email: form.email, password: form.password })

    const res = await fetch(photoDataUrl)
    const blob = await res.blob()
    const filePath = `selfies/${data.user.id}/reference.jpg`

    const { error: uploadError } = await supabase.storage
      .from('giro-media')
      .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError) {
      setError('Erro ao enviar a selfie. Tente novamente.')
      setStep('selfie')
      return
    }

    await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseAuthId: data.user.id,
        email: form.email,
        displayName: form.displayName,
        username: form.username,
        selfiePath: filePath,
      }),
    })

    setStep('success')
  }

  // ── TELA: Selfie ──────────────────────────────────────
  if (step === 'selfie' || step === 'uploading') {
    return (
      <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">
        <div className="relative overflow-hidden px-6 pt-12 pb-10"
          style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
          <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1"/>
          </svg>
          <div className="relative z-10 mb-6">
            <NextImage src="/logogiroprincipal.png" alt="GIRO" width={130} height={50} priority className="drop-shadow-lg" />
          </div>
          <div className="relative z-10">
            <h1 className="text-white font-bold text-2xl leading-tight">
              {photoDataUrl ? 'Ficou boa? 📸' : 'Selfie de referência 🤳'}
            </h1>
            <p className="text-white/70 text-sm mt-1">
              {photoDataUrl ? 'Use esta foto ou tire outra' : 'Posicione seu rosto no centro'}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl" />
        </div>

        <div className="flex-1 px-6 pt-6 pb-10 flex flex-col items-center">
          {photoDataUrl ? (
            <div className="w-full flex flex-col items-center gap-4">
              <img src={photoDataUrl} alt="Selfie"
                className="w-56 h-56 object-cover rounded-3xl shadow-lg"
                style={{ border: '3px solid #E05300' }} />
              {error && (
                <div className="w-full rounded-xl px-4 py-3 bg-red-50 border border-red-100">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => { setPhotoDataUrl(null); startCamera() }}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm border-2 transition-all"
                  style={{ borderColor: '#E05300', color: '#E05300' }}>
                  Tirar outra
                </button>
                <button onClick={handleFinalSubmit} disabled={step === 'uploading'}
                  className="flex-1 py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                  {step === 'uploading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </span>
                  ) : 'Usar esta ✓'}
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-4">
              <div className="w-full bg-orange-50 rounded-2xl p-4 mb-2">
                {['Boa iluminação no rosto', 'Olhe direto para a câmera', 'Sem óculos de sol'].map(tip => (
                  <p key={tip} className="text-xs text-orange-700 mb-1">✓ {tip}</p>
                ))}
              </div>
              <div className="relative w-56 h-56 rounded-3xl overflow-hidden bg-gray-100"
                style={{ border: '3px solid #E05300' }}>
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="w-36 h-44 rounded-full border-2 border-white/70" />
                </div>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <button onClick={capturePhoto}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                <div className="w-10 h-10 rounded-full bg-white" />
              </button>
              <button onClick={() => { stopCamera(); setStep('form') }}
                className="text-sm text-gray-400 underline">
                Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── TELA: Sucesso ─────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">
        <div className="relative overflow-hidden px-6 pt-12 pb-10"
          style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
          <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
          </svg>
          <div className="relative z-10 mb-6">
            <NextImage src="/logogiroprincipal.png" alt="GIRO" width={130} height={50} priority className="drop-shadow-lg" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
            <span className="text-5xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Conta criada!</h2>
          <p className="text-gray-400 text-sm text-center leading-relaxed mb-2">
            Sua selfie de referência foi salva com sucesso.
          </p>
          <p className="text-gray-400 text-sm text-center leading-relaxed mb-8">
            Verifique seu e-mail <span className="font-semibold text-gray-600">{form.email}</span> para ativar a conta.
          </p>
          <button onClick={() => router.push('/login')}
            className="w-full py-4 rounded-xl text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
            Ir para o login →
          </button>
        </div>
      </div>
    )
  }

  // ── TELA: Formulário ──────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">
      <HeaderLogo showLogin />

      <div className="flex-1 px-6 pt-4 pb-10 bg-white overflow-y-auto">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">Crie sua conta</h2>
          <p className="text-gray-400 text-sm">Explore rotas e conquiste insígnias</p>
        </div>

        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Nome completo</label>
            <input name="displayName" type="text" value={form.displayName} onChange={handleChange}
              onFocus={() => setFocused('displayName')} onBlur={() => setFocused(null)}
              placeholder="Seu nome completo" required className={inputClass} style={inputStyle('displayName')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Usuário</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm" style={{ color: '#E05300' }}>@</span>
              <input name="username" type="text" value={form.username} onChange={handleChange}
                onFocus={() => setFocused('username')} onBlur={() => setFocused(null)}
                placeholder="seu_usuario" required
                className={inputClass} style={{ ...inputStyle('username'), paddingLeft: '2rem' }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">E-mail</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              placeholder="seuemail@exemplo.com" required className={inputClass} style={inputStyle('email')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Senha</label>
              <input name="password" type="password" value={form.password} onChange={handleChange}
                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                placeholder="••••••••" required className={inputClass} style={inputStyle('password')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Confirmar</label>
              <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
                onFocus={() => setFocused('confirmPassword')} onBlur={() => setFocused(null)}
                placeholder="••••••••" required className={inputClass} style={inputStyle('confirmPassword')} />
            </div>
          </div>

          <div className="rounded-2xl p-4 flex items-start gap-3 mt-1"
            style={{ background: '#FFF8F5', border: '1.5px dashed #E05300' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#E05300' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#830200' }}>Selfie obrigatória</p>
              <p className="text-xs text-orange-700/60 mt-0.5 leading-relaxed">
                Na próxima etapa você vai tirar uma selfie para validar seus check-ins nas trilhas.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          <button type="submit"
            className="w-full py-4 rounded-xl text-white font-bold text-sm mt-2 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #830200 0%, #E05300 60%, #FF8C00 100%)' }}>
            Continuar para selfie →
          </button>

          <p className="text-center text-gray-400 text-sm">
            Já tem conta?{' '}
            <Link href="/login" className="font-bold" style={{ color: '#E05300' }}>Entrar</Link>
          </p>

        </form>
      </div>
    </div>
  )
}