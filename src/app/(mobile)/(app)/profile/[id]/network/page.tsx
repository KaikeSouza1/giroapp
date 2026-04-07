'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function NetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'followers'

  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab as any)
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/profile/${resolvedParams.id}/network?type=${activeTab}`)
        if (res.ok) {
          setList(await res.json())
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [resolvedParams.id, activeTab])

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
        <h1 className="text-xl font-black text-gray-900">Rede</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-white px-5 border-b border-gray-100">
        <button 
          onClick={() => setActiveTab('followers')}
          className="flex-1 py-4 text-sm font-black transition-all relative"
          style={{ color: activeTab === 'followers' ? '#E05300' : '#A3A3A3' }}
        >
          Seguidores
          {activeTab === 'followers' && <div className="absolute bottom-0 left-4 right-4 h-1 bg-[#E05300] rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('following')}
          className="flex-1 py-4 text-sm font-black transition-all relative"
          style={{ color: activeTab === 'following' ? '#E05300' : '#A3A3A3' }}
        >
          Seguindo
          {activeTab === 'following' && <div className="absolute bottom-0 left-4 right-4 h-1 bg-[#E05300] rounded-t-full" />}
        </button>
      </div>

      {/* Lista */}
      <div className="p-5 flex flex-col gap-3">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }} />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#FFF0EB] flex items-center justify-center text-2xl">
              👥
            </div>
            <p className="text-gray-400 font-bold text-sm">
              {activeTab === 'followers' ? 'Nenhum seguidor ainda.' : 'Não está seguindo ninguém.'}
            </p>
          </div>
        ) : (
          list.map(user => (
            <Link key={user.id} href={`/profile/${user.id}`}>
              <div className="bg-white p-3 rounded-2xl flex items-center gap-3 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} className="w-12 h-12 rounded-full object-cover" alt="Avatar" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500 text-lg">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-black text-sm text-gray-900">{user.displayName}</p>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">@{user.username}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}