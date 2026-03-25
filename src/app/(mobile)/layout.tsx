import type { Metadata } from 'next'
import { Bebas_Neue, DM_Sans } from 'next/font/google'
import '@/styles/giro-tokens.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
})

export const metadata: Metadata = {
  title: 'GIRO',
  description: 'Explore rotas e trilhas ao ar livre',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bebasNeue.variable} ${dmSans.variable} min-h-screen`}>
      {children}
    </div>
  )
}