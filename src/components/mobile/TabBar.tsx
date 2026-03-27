'use client'

import Link from 'next/link'

export default function TabBar({ active }: { active: 'home' | 'feed' | 'profile' }) {
  const tabs = [
    {
      key: 'home',
      href: '/home',
      label: 'Início',
      icon: (on: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? '#E05300' : 'none'} stroke={on ? '#E05300' : '#BBB'} strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      key: 'feed',
      href: '/feed',
      label: 'Feed',
      icon: (on: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? '#E05300' : '#BBB'} strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      key: 'profile',
      href: '/profile',
      label: 'Perfil',
      icon: (on: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? '#E05300' : '#BBB'} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 z-50" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-around">
        {tabs.map((tab) => (
          <Link key={tab.key} href={tab.href} className="flex flex-col items-center gap-1 min-w-[60px]">
            {tab.icon(active === tab.key)}
            <span className="text-[10px] font-semibold" style={{ color: active === tab.key ? '#E05300' : '#BBB' }}>
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}