'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Route = {
  id: string
  name: string
  difficulty: string
  status: string
  type: string
  distanceKm: string | null
}

const difficultyLabel: Record<string, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil', extreme: 'Extremo' }
const statusLabel: Record<string, string> = { draft: 'Rascunho', published: 'Publicada', archived: 'Arquivada' }

export default function SuperadminOrgRoutesPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string

  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Passamos o orgId na query para a API filtrar
    fetch(`/api/admin/routes?orgId=${orgId}`)
      .then(r => r.json())
      .then(data => { setRoutes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [orgId])

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 font-bold">← Voltar</button>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Rotas da Organização</h1>
          <p className="text-gray-500 text-sm">Visualização de administrador global</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando rotas...</div>
        ) : routes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Nenhuma rota cadastrada por esta organização.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase">Nome & Tipo</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase">Dificuldade</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase">Distância</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900 text-sm">{route.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{route.type}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{difficultyLabel[route.difficulty]}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{route.distanceKm ? `${route.distanceKm} km` : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{statusLabel[route.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}