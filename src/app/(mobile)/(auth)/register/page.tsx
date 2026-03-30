'use client'

// ─────────────────────────────────────────────────────────────────────────────
// src/app/(mobile)/(auth)/register/page.tsx
//
// CORREÇÃO: A versão anterior usava navigator.mediaDevices.getUserMedia, que
// é uma Web API que NÃO funciona de forma confiável dentro de um WebView do
// Capacitor (especialmente no iOS, que exige entitlements nativos específicos).
// Agora usamos o plugin @capacitor/camera, que lida com permissões nativas
// automaticamente nas duas plataformas.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
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

  // A foto agora vem do Capacitor Camera como dataUrl (base64 prefixado)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const inputClass = 'w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all duration-200'
  const inputStyle = (field: Field) => ({
    background: focused === field ? '#FFF8F5' : '#F7F7F7',
    border: focused === field ? '1.5px solid #E05300' : '1.5px solid #EFEFEF',
    boxShadow: focused === field ? '0 0 0 3px rgba(224,83,0,0.08)' : 'none',
  })

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) { setError('As senhas não coincidem.'); return }
    if (form.password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    setStep('selfie')
  }

  // ─── Abre câmera ou galeria via Capacitor ─────────────────────────────────
  // POR QUE IMPORT DINÂMICO: o módulo @capacitor/camera não existe no Node.js
  // (ambiente de build do Next.js). O import dentro da função garante que ele
  // só é carregado no browser/nativo, quando o usuário pressiona o botão.
  async function openCapacitorCamera(source: 'camera' | 'gallery') {
    setPhotoLoading(true)
    setError('')

    try {
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera')

      const image = await Camera.getPhoto({
        
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        quality: 88,
      
        width: 640,
        height: 640,
        correctOrientation: true, // corrige rotação EXIF automaticamente
      })

      if (image.dataUrl) {
        setPhotoDataUrl(image.dataUrl)
      }
    } catch (err: any) {
      // Cancelar a câmera não é um erro — ignoramos silenciosamente
      const isCancelled = ['cancel', 'cancelled', 'canceled', 'dismissed', 'no image']
        .some(word => err?.message?.toLowerCase().includes(word))

      if (!isCancelled) {
        setError('Erro ao acessar câmera. Verifique as permissões nas configurações.')
      }
    } finally {
      setPhotoLoading(false)
    }
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

    // Converte o dataUrl para Blob para upload no Supabase Storage
    // fetch() em um dataUrl converte para Blob nativamente — sem biblioteca extra
    const res = await fetch(photoDataUrl)
    const blob = await res.blob()
    const filePath = `selfies/${data.user.id}/reference.jpg`

    const { error: uploadError } = await supabase.storage
      .from('giro-app')
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

  const HeaderLogo = ({ showLogin = false }: { showLogin?: boolean }) => (
    <div className="relative overflow-hidden px-6 pt-12 pb-10"
      style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,90 Q93,130 187,90 Q280,50 375,90" fill="none" stroke="#fff" strokeWidth="1.5"/>
        <path d="M0,50 Q93,90 187,50 Q280,10 375,50" fill="none" stroke="#fff" strokeWidth="1"/>
        <path d="M0,130 Q93,170 187,130 Q280,90 375,130" fill="none" stroke="#fff" strokeWidth="0.8"/>
      </svg>
      <div className={`relative z-10 mb-6 ${showLogin ? 'flex items-center justify-between' : ''}`}>
        <NextImage src="/logogiroprincipal.png" alt="GIRO" width={showLogin ? 110 : 130} height={showLogin ? 42 : 50} priority className="drop-shadow-lg" />
        {showLogin && (
          <Link href="/login" className="text-xs font-semibold px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
            Entrar
          </Link>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl" />
    </div>
  )

  // ── TELA: Foto de Referência (substitui a tela de vídeo) ──────────────────
  if (step === 'selfie' || step === 'uploading') {
    return (
      <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">

        <div className="relative overflow-hidden px-6 pt-12 pb-10"
          style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
          <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
            <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
          </svg>
          <div className="relative z-10 mb-4">
            <NextImage src="/logogiroprincipal.png" alt="GIRO" width={130} height={50} priority className="drop-shadow-lg" />
          </div>
          <div className="relative z-10">
            <h1 className="text-white font-bold text-2xl leading-tight">
              {photoDataUrl ? 'Ficou boa? 📸' : 'Foto de referência'}
            </h1>
            <p className="text-white/70 text-sm mt-1">
              {photoDataUrl
                ? 'Use esta foto ou escolha outra'
                : 'Usaremos para validar seus check-ins nas trilhas'}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-3xl" />
        </div>

        <div className="flex-1 px-6 pt-6 pb-10 flex flex-col">

          {/* Preview ou placeholder */}
          <div
            className="w-full rounded-3xl overflow-hidden mb-5 flex items-center justify-center relative"
            style={{ height: '240px', background: '#F5F5F5', border: '2px solid #EFEFEF' }}
          >
            {photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoDataUrl} alt="Foto de referência" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center">
                  <span className="text-4xl">🤳</span>
                </div>
                <p className="text-gray-500 text-sm font-semibold">
                  Tire uma selfie ou escolha<br />uma foto da galeria
                </p>
                <p className="text-gray-400 text-xs">
                  Olhe diretamente para a câmera com boa iluminação
                </p>
              </div>
            )}

            {photoLoading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
                  <p className="text-xs text-gray-500">Abrindo câmera...</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100 mb-4">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {/* Botões de ação */}
          {!photoDataUrl ? (
            // Sem foto: mostrar opções de câmera e galeria
            <div className="flex flex-col gap-3">
              <button
                onClick={() => openCapacitorCamera('camera')}
                disabled={photoLoading}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-60 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #830200 0%, #E05300 60%, #FF8C00 100%)' }}
              >
                <span className="text-lg">📷</span>
                Tirar selfie com a câmera
              </button>

              <button
                onClick={() => openCapacitorCamera('gallery')}
                disabled={photoLoading}
                className="w-full py-4 rounded-2xl font-bold text-sm border-2 disabled:opacity-60 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ borderColor: '#E05300', color: '#E05300', background: '#FFF8F5' }}
              >
                <span className="text-lg">🖼️</span>
                Escolher da galeria
              </button>

              <button
                onClick={() => setStep('form')}
                className="w-full py-3 text-sm text-gray-400 underline"
              >
                ← Voltar ao formulário
              </button>
            </div>
          ) : (
            // Com foto: confirmar ou trocar
            <div className="flex flex-col gap-3">
              <button
                onClick={handleFinalSubmit}
                disabled={step === 'uploading'}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm disabled:opacity-60 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #830200 0%, #E05300 60%, #FF8C00 100%)' }}
              >
                {step === 'uploading' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando conta...
                  </>
                ) : '✓ Usar esta foto e criar conta'}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => openCapacitorCamera('camera')}
                  disabled={step === 'uploading' || photoLoading}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{ borderColor: '#E05300', color: '#E05300' }}
                >
                  📷 Câmera
                </button>
                <button
                  onClick={() => openCapacitorCamera('gallery')}
                  disabled={step === 'uploading' || photoLoading}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{ borderColor: '#E05300', color: '#E05300' }}
                >
                  🖼️ Galeria
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── TELA: Sucesso ─────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm)]">
        <HeaderLogo />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
            <span className="text-5xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Conta criada!</h2>
          <p className="text-gray-400 text-sm text-center leading-relaxed mb-2">
            Sua foto de referência foi salva com sucesso.
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

  // ── TELA: Formulário ──────────────────────────────────────────────────────
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
              style={{ background: '#E05300' }}>
              📷
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#830200' }}>Foto de referência obrigatória</p>
              <p className="text-xs text-orange-700/60 mt-0.5 leading-relaxed">
                Na próxima etapa você vai tirar uma selfie ou escolher uma foto para validar seus check-ins nas trilhas.
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
            Continuar para foto →
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