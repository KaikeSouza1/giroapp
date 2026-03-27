// src/app/(mobile)/(app)/profile/[id]/page.tsx (NOVO ARQUIVO)
import ProfileClient from './ProfileClient'

export function generateStaticParams() {
  return [] // Permite o build estático para o Capacitor
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProfileClient params={params} />
}