import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GIRO Admin',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)]">
      {children}
    </div>
  )
}