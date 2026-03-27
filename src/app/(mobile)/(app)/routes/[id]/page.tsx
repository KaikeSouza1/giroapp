// src/app/(mobile)/(app)/routes/[id]/page.tsx (NOVO ARQUIVO)
import RouteClient from './RouteClient'

export function generateStaticParams() {
  return [] // Permite o build estático para o Capacitor
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RouteClient params={params} />
}