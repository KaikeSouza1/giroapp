'use client'

import { use } from 'react'
import Link from 'next/link'
// Adicione aqui os seus outros imports que já estavam na página (Supabase, ícones, etc)

export default function RoutesClient({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const orgId = resolvedParams.id

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Rotas da Organização</h1>
      <p className="text-gray-500 mb-8">ID da Org: {orgId}</p>
      
      {/* TODO: Cole aqui dentro todo o conteúdo da sua interface 
          que estava no return() do seu page.tsx antigo.
      */}

      <Link href="/dashboard/organizations" className="text-orange-600 font-bold">
        ← Voltar para Organizações
      </Link>
    </div>
  )
}