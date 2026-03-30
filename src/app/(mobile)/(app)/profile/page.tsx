'use client'

// src/app/(mobile)/(app)/profile/page.tsx
// Adicionado: botão de editar foto de perfil com câmera ou galeria

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import TabBar from '@/components/mobile/TabBar'

type Badge = { id: string; name: string; description: string | null; imageUrl: string; awardedAt: string }
type CompletedRoute = { id: string; routeName: string; completedAt: string; distanceKm: string | null }
type ProfileData = {
  id: string; displayName: string; username: string; bio: string | null;
  avatarUrl: string | null; isSelfieCaptured: boolean;
  followersCount: number; followingCount: number;
  badges: Badge[]; completedRoutes: CompletedRoute[]
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'badges' | 'routes'>('badges')

  // Estados para edição de foto
  const [showPhotoSheet, setShowPhotoSheet] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      try {
        const res = await fetch('/api/profile/me', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        const text = await res.text()
        setProfile(text ? JSON.parse(text) : null)
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Troca foto de perfil ──────────────────────────────────────────────────
  async function changeProfilePhoto(source: 'camera' | 'gallery') {
    setShowPhotoSheet(false)
    setPhotoUploading(true)
    setPhotoError('')

    try {
      // Import dinâmico — Capacitor não existe no servidor
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera')

      const image = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        quality: 88,
        width: 512,
        height: 512,
        correctOrientation: true,
      })

      if (!image.dataUrl) throw new Error('Nenhuma foto selecionada')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      // Converte dataUrl → Blob e faz upload para o Supabase Storage
      const blob = await fetch(image.dataUrl).then(r => r.blob())
      const filePath = `avatars/${session.user.id}/avatar.jpg`

      const { error: uploadErr } = await supabase.storage
        .from('giro-app')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })

      if (uploadErr) throw new Error('Falha no upload da foto')

      const { data: { publicUrl } } = supabase.storage
        .from('giro-app')
        .getPublicUrl(filePath)

      // Salva a URL no banco via API
      const updateRes = await fetch('/api/users/update-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      })
      if (!updateRes.ok) throw new Error('Falha ao atualizar perfil')

      // Atualiza o estado local para ver a nova foto imediatamente
      setProfile(prev => prev ? { ...prev, avatarUrl: publicUrl } : null)

    } catch (err: any) {
      // Cancelo silencioso
      const isCancelled = ['cancel', 'cancelled', 'canceled', 'dismissed', 'no image']
        .some(w => err?.message?.toLowerCase().includes(w))
      if (!isCancelled) {
        setPhotoError('Não foi possível trocar a foto. Tente novamente.')
      }
    } finally {
      setPhotoUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full animate-spin"
          style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">

      {/* ── Header com gradiente ────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1"/>
          <path d="M0,140 Q93,100 187,140 Q280,180 375,140" fill="none" stroke="#fff" strokeWidth="0.8"/>
        </svg>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between mb-6">
          <NextImage src="/logogiroprincipal.png" alt="GIRO" width={80} height={32} priority className="drop-shadow-lg" />
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>
        </div>

        {/* Avatar + info + botão de editar ───────────────────────────────── */}
        <div className="relative z-10 flex items-center gap-4">

          {/* Avatar com botão de edição sobreposto */}
          <div className="relative flex-shrink-0">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.displayName}
                className="w-16 h-16 rounded-2xl object-cover shadow-lg"
                style={{ border: '2px solid rgba(255,255,255,0.4)' }} />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-lg"
                style={{ background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                {profile?.displayName?.charAt(0).toUpperCase() ?? 'U'}
              </div>
            )}

            {/* Botão de câmera sobre o avatar */}
            <button
              onClick={() => setShowPhotoSheet(true)}
              disabled={photoUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'white' }}
            >
              {photoUploading ? (
                <div className="w-3.5 h-3.5 border border-gray-300 border-t-orange-500 rounded-full animate-spin" />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E05300" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </button>
          </div>

          {/* Nome + usuário */}
          <div className="min-w-0">
            <h1 className="text-white font-black text-xl leading-tight truncate">
              {profile?.displayName ?? 'Aventureiro'}
            </h1>
            <p className="text-white/60 text-sm font-medium mt-0.5">@{profile?.username ?? ''}</p>
            {profile?.bio && (
              <p className="text-white/80 text-xs mt-1.5 line-clamp-2">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Erro de foto */}
        {photoError && (
          <div className="relative z-10 mt-3 rounded-xl px-3 py-2 bg-red-500/20 border border-red-400/30">
            <p className="text-white text-xs">{photoError}</p>
          </div>
        )}

        {/* Stats */}
        <div className="relative z-10 flex gap-3 mt-6">
          {[
            { label: 'Rotas', value: profile?.completedRoutes?.length ?? 0 },
            { label: 'Insígnias', value: profile?.badges?.length ?? 0 },
            { label: 'Seguidores', value: profile?.followersCount ?? 0 },
            { label: 'A seguir', value: profile?.followingCount ?? 0 },
          ].map(s => (
            <div key={s.label} className="flex-1 text-center rounded-2xl py-2.5 backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <p className="text-white font-black text-lg leading-none">{s.value}</p>
              <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50 rounded-t-3xl" />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex mx-5 mt-2 rounded-2xl overflow-hidden border border-gray-100 bg-white mb-4 shadow-sm">
        {(['badges', 'routes'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-sm font-bold transition-all"
            style={{
              color: activeTab === tab ? 'white' : '#999',
              background: activeTab === tab ? 'linear-gradient(135deg, #830200, #E05300)' : 'transparent',
            }}>
            {tab === 'badges' ? `🏆 Insígnias (${profile?.badges?.length ?? 0})` : `🗺️ Rotas (${profile?.completedRoutes?.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* ── Conteúdo das tabs ─────────────────────────────────────────────── */}
      <div className="px-5">
        {activeTab === 'badges' && (
          profile?.badges?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-2">
                <span className="text-3xl">🏆</span>
              </div>
              <p className="text-gray-500 font-bold text-sm">Nenhuma insígnia ainda</p>
              <p className="text-gray-400 text-xs text-center max-w-[200px]">
                Complete rotas épicas para desbloquear recompensas!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {profile?.badges?.map(badge => (
                <div key={badge.id} className="bg-white rounded-2xl p-3 text-center shadow-sm"
                  style={{ border: '1.5px solid #F5F5F5' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badge.imageUrl} alt={badge.name} className="w-12 h-12 rounded-xl mx-auto mb-2 object-cover" />
                  <p className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2">{badge.name}</p>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'routes' && (
          profile?.completedRoutes?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-2">
                <span className="text-3xl">🗺️</span>
              </div>
              <p className="text-gray-500 font-bold text-sm">Nenhuma rota concluída</p>
              <p className="text-gray-400 text-xs text-center max-w-[200px]">
                Saia para uma trilha e guarde sua primeira aventura!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {profile?.completedRoutes?.map(route => (
                <div key={route.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                  style={{ border: '1.5px solid #F5F5F5' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{route.routeName}</p>
                    <p className="text-gray-400 text-xs mt-1 font-medium">
                      {new Date(route.completedAt).toLocaleDateString('pt-BR')}
                      {route.distanceKm ? ` • ${route.distanceKm} km` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Bottom sheet: escolher câmera ou galeria ──────────────────────── */}
      {showPhotoSheet && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={() => setShowPhotoSheet(false)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-5 pt-4 pb-10 shadow-2xl">
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            <p className="text-sm font-black text-gray-900 mb-4">Trocar foto de perfil</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => changeProfilePhoto('camera')}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}
              >
                <span className="text-lg">📷</span>
                Tirar foto com a câmera
              </button>

              <button
                onClick={() => changeProfilePhoto('gallery')}
                className="w-full py-4 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ borderColor: '#E05300', color: '#E05300', background: '#FFF8F5' }}
              >
                <span className="text-lg">🖼️</span>
                Escolher da galeria
              </button>

              <button
                onClick={() => setShowPhotoSheet(false)}
                className="w-full py-3 text-sm text-gray-400 font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      <TabBar active="profile" />
    </div>
  )
}