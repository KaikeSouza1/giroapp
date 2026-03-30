'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NextImage from 'next/image'
import { createBrowserClient } from '@supabase/ssr'
import TabBar from '@/components/mobile/TabBar'
// Importação do plugin nativo da Câmera
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

type Badge = {
  id: string
  name: string
  description: string | null
  imageUrl: string
  awardedAt: string
}

type CompletedRoute = {
  id: string
  routeName: string
  completedAt: string
  distanceKm: string | null
}

type ProfileData = {
  id: string
  displayName: string
  username: string
  bio: string | null
  avatarUrl: string | null
  isSelfieCaptured: boolean
  followersCount: number
  followingCount: number
  badges: Badge[]
  completedRoutes: CompletedRoute[]
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false) // Estado de carregamento da foto
  const [activeTab, setActiveTab] = useState<'badges' | 'routes'>('badges')

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
        const data = text ? JSON.parse(text) : null
        setProfile(data)
      } catch (err) {
        console.error("Erro ao carregar perfil:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase.auth])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 📸 FUNÇÃO PARA TROCAR A FOTO DE PERFIL
  async function handleChangeAvatar() {
    try {
      // 1. Abre o menu nativo perguntando: "Câmera ou Galeria?"
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: true, // Permite cortar a foto em formato quadrado
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt // Deixa o usuário escolher de onde quer a foto
      })

      if (!image.dataUrl || !profile) return
      setIsUpdatingAvatar(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Não autenticado")

      // 2. Converte a foto para enviar
      const resBlob = await fetch(image.dataUrl)
      const blob = await resBlob.blob()
      
      // Um nome de arquivo único para não ficar no cache do navegador
      const filePath = `avatars/${session.user.id}/profile-${Date.now()}.jpg`

      // 3. Faz o upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('giro-media')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw new Error('Erro ao enviar a imagem para a nuvem.')

      // 4. Pega a URL pública gerada
      const { data: { publicUrl } } = supabase.storage
        .from('giro-media')
        .getPublicUrl(filePath)

      // 5. Salva a nova URL no banco de dados (na API que acabamos de criar)
      const dbRes = await fetch('/api/profile/update-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseAuthId: session.user.id,
          avatarUrl: publicUrl
        })
      })

      if (!dbRes.ok) throw new Error("Erro ao salvar no banco de dados.")

      // 6. Atualiza a foto na tela instantaneamente!
      setProfile(prev => prev ? { ...prev, avatarUrl: publicUrl } : null)

    } catch (err: any) {
      if (err.message !== 'User cancelled photos app') {
        alert("Erro ao trocar foto: " + err.message)
      }
    } finally {
      setIsUpdatingAvatar(false)
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
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24">

      {/* Header com Gradiente */}
      <div className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{ background: 'linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" viewBox="0 0 375 200" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 Q93,60 187,100 Q280,140 375,100" fill="none" stroke="#fff" strokeWidth="1.5"/>
          <path d="M0,60 Q93,20 187,60 Q280,100 375,60" fill="none" stroke="#fff" strokeWidth="1"/>
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

        {/* Avatar + info (AGORA CLICÁVEL) */}
        <div className="relative z-10 flex items-center gap-4">
          <button 
            onClick={handleChangeAvatar}
            disabled={isUpdatingAvatar}
            className="relative rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-70 group"
          >
            {isUpdatingAvatar && (
              <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center z-20">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            {/* Ícone de câmera no cantinho (pista visual) */}
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md z-10 text-orange-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>

            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover" style={{ border: '2px solid rgba(255,255,255,0.4)' }} />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white" style={{ background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                {profile?.displayName?.charAt(0).toUpperCase() ?? 'U'}
              </div>
            )}
          </button>
          
          <div>
            <h1 className="text-white font-black text-xl leading-tight">
              {profile?.displayName ?? 'Aventureiro'}
            </h1>
            <p className="text-white/60 text-sm font-medium mt-0.5">@{profile?.username ?? ''}</p>
          </div>
        </div>

        {/* Estatísticas */}
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

      {/* Tabs */}
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

      <div className="px-5">

        {/* Aba Insígnias */}
        {activeTab === 'badges' && (
          profile?.badges?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-2"><span className="text-3xl">🏆</span></div>
              <p className="text-gray-500 font-bold text-sm">Nenhuma insígnia ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {profile?.badges?.map(badge => (
                <div key={badge.id} className="bg-white rounded-2xl p-3 text-center shadow-sm" style={{ border: '1.5px solid #F5F5F5' }}>
                  <img src={badge.imageUrl} alt={badge.name} className="w-12 h-12 rounded-xl mx-auto mb-2 object-cover" />
                  <p className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2">{badge.name}</p>
                </div>
              ))}
            </div>
          )
        )}

        {/* Aba Rotas concluídas */}
        {activeTab === 'routes' && (
          profile?.completedRoutes?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mb-2"><span className="text-3xl">🗺️</span></div>
              <p className="text-gray-500 font-bold text-sm">Nenhuma rota concluída</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {profile?.completedRoutes?.map(route => (
                <div key={route.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm" style={{ border: '1.5px solid #F5F5F5' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{route.routeName}</p>
                    <p className="text-gray-400 text-xs mt-1 font-medium">{new Date(route.completedAt).toLocaleDateString('pt-PT')} {route.distanceKm ? ` • ${route.distanceKm} km` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <TabBar active="profile" />
    </div>
  )
}