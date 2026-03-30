// src/app/(mobile)/(app)/routes/[id]/checkin/page.tsx
import CheckinClient from './CheckinClient'

// Necessário para o build do Next.js com rotas dinâmicas aninhadas.
// Retornar [] significa "não gerar nenhuma página estática" —
// o JavaScript do Capacitor resolve o ID em runtime.
export function generateStaticParams() {
  return []
}

export default function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  return <CheckinClient params={params} />
}