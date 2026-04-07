// src/app/(mobile)/(app)/profile/[id]/network/page.tsx
// CORREÇÃO: useSearchParams() no Next.js 15 requer um Suspense boundary.
// Separamos o componente que usa useSearchParams em um arquivo Client Component
// e envolvemos em Suspense aqui, no arquivo da página (Server Component).

import { Suspense } from 'react'
import NetworkContent from './NetworkContent'

export function generateStaticParams() {
  return []
}

export default function NetworkPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: '3px solid #F0F0F0', borderTop: '3px solid #E05300' }}
          />
        </div>
      }
    >
      <NetworkContent params={params} />
    </Suspense>
  )
}