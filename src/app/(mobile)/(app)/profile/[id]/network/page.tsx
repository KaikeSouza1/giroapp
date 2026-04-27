




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