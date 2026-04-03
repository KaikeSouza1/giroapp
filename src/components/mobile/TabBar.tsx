'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Tab = 'home' | 'feed' | 'record' | 'profile'

export default function TabBar({ active }: { active: Tab | 'home' | 'feed' | 'profile' }) {
  const router = useRouter()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-end justify-around px-4 pt-2 pb-1">

        {/* Home */}
        <Link href="/home" className="flex flex-col items-center gap-1 min-w-[48px] pt-1">
          <svg width="22" height="22" viewBox="0 0 24 24"
            fill={active === 'home' ? '#E05300' : 'none'}
            stroke={active === 'home' ? '#E05300' : '#BBB'}
            strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="text-[10px] font-semibold" style={{ color: active === 'home' ? '#E05300' : '#BBB' }}>
            Início
          </span>
        </Link>

        {/* Feed */}
        <Link href="/feed" className="flex flex-col items-center gap-1 min-w-[48px] pt-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={active === 'feed' ? '#E05300' : '#BBB'} strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="text-[10px] font-semibold" style={{ color: active === 'feed' ? '#E05300' : '#BBB' }}>
            Feed
          </span>
        </Link>

        {/* ── Record (CTA central) ── */}
        <Link href="/activity" className="flex flex-col items-center -mt-6 relative">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, #830200, #E05300)',
              boxShadow: '0 6px 20px rgba(224,83,0,0.45)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="text-[10px] font-bold mt-1" style={{ color: active === 'record' ? '#E05300' : '#BBB' }}>
            Gravar
          </span>
        </Link>

        {/* Placeholder / Explore */}
        <Link href="/feed" className="flex flex-col items-center gap-1 min-w-[48px] pt-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#BBB" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-[10px] font-semibold text-[#BBB]">Explorar</span>
        </Link>

        {/* Profile */}
        <Link href="/profile" className="flex flex-col items-center gap-1 min-w-[48px] pt-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={active === 'profile' ? '#E05300' : '#BBB'} strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-[10px] font-semibold" style={{ color: active === 'profile' ? '#E05300' : '#BBB' }}>
            Perfil
          </span>
        </Link>

      </div>
    </div>
  )
}