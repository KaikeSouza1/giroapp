'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/admin/Sidebar'

type Route = {
  id: string
  name: string
  difficulty: string
  status: string
  distanceKm: string | null
  createdAt: string
}

const difficultyLabel: Record<string, string> = {
  easy: 'Fácil', medium: 'Médio', hard: 'Difícil', extreme: 'Extremo'
}

const difficultyColor: Record<string, string> = {
  easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444', extreme: '#7c3aed'
}

const statusLabel: Record<string, string> = {
  draft: 'Rascunho', published: 'Publicada', archived: 'Arquivada'
}

const statusColor: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  published: { bg: '#DCFCE7', text: '#16A34A' },
  archived: { bg: '#FEF9C3', text: '#CA8A04' },
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/routes')
      .then(r => r.json())
      .then(data => { setRoutes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/routes/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Rotas</h1>
            <p className="text-gray-400 text-sm mt-0.5">Gerencie todas as trilhas do GIRO</p>
          </div>
          <Link
            href="/dashboard/routes/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nova rota
          </Link>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : routes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">🗺️</div>
              <p className="text-gray-500 font-semibold">Nenhuma rota cadastrada ainda</p>
              <Link href="/dashboard/routes/new"
                className="text-sm font-bold"
                style={{ color: '#E05300' }}>
                Criar primeira rota →
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Dificuldade</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Distância</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route, i) => (
                  <tr key={route.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    style={{ animationDelay: `${i * 50}ms` }}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 text-sm">{route.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{
                          background: `${difficultyColor[route.difficulty]}20`,
                          color: difficultyColor[route.difficulty]
                        }}>
                        {difficultyLabel[route.difficulty] ?? route.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {route.distanceKm ? `${route.distanceKm} km` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={statusColor[route.status] ?? { bg: '#F3F4F6', text: '#6B7280' }}>
                        {statusLabel[route.status] ?? route.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {route.status === 'draft' && (
                          <button
                            onClick={() => updateStatus(route.id, 'published')}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: '#DCFCE7', color: '#16A34A' }}>
                            Publicar
                          </button>
                        )}
                        {route.status === 'published' && (
                          <button
                            onClick={() => updateStatus(route.id, 'archived')}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: '#FEF9C3', color: '#CA8A04' }}>
                            Arquivar
                          </button>
                        )}
                        <Link
                          href={`/dashboard/routes/${route.id}/edit`}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: '#F3F4F6', color: '#6B7280' }}>
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}