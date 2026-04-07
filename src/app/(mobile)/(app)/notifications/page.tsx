'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function NotificationsPage() {
  const router = useRouter()
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // Busca notificações completas
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        setNotifs(Array.isArray(data) ? data : [])
        
        // Marca todas como lidas instantaneamente
        if (data.length > 0) {
          await fetch('/api/notifications', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)]">
      {/* Header Fixo */}
      <div className="bg-white px-5 pt-12 pb-4 shadow-sm flex items-center gap-4 sticky top-0 z-20">
        <button 
          onClick={() => router.back()} 
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-900 active:scale-95 transition-all"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-xl font-black text-gray-900">Notificações</h1>
      </div>

      {/* Lista */}
      <div className="p-5 flex flex-col gap-3">
        {notifs.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl bg-gradient-to-br from-gray-100 to-gray-200">
              🔔
            </div>
            <p className="text-gray-400 font-bold text-sm">Você ainda não tem notificações.</p>
          </div>
        ) : (
          notifs.map(n => (
            <Link key={n.id} href={`/profile/${n.actor.id}`}>
              <div 
                className={`p-4 rounded-3xl flex items-center gap-4 transition-all active:scale-[0.98] ${
                  n.isRead ? 'bg-white border border-gray-100 shadow-sm' : 'bg-[#FFF0EB] border border-[#FFD0C0] shadow-md'
                }`}
              >
                {n.actor.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.actor.avatarUrl} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" alt="Avatar" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#830200] to-[#E05300] flex items-center justify-center font-black text-white text-xl border-2 border-white shadow-sm">
                    {n.actor.displayName.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm text-gray-900 leading-tight">
                    <span className="font-black">{n.actor.displayName}</span> começou a seguir você.
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1 font-bold tracking-wide">
                    {new Date(n.createdAt).toLocaleDateString('pt-BR', { 
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                    })}
                  </p>
                </div>
                {!n.isRead && <div className="w-2.5 h-2.5 rounded-full bg-[#E05300]"></div>}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}