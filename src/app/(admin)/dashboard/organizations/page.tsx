"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Sidebar from "@/components/admin/Sidebar"
import { Building2, Pencil, Trash2, ExternalLink } from "lucide-react"

type Organization = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Dados do formulário
  const [formData, setFormData] = useState({ 
    name: "", slug: "", adminEmail: "", adminPassword: "", isActive: true 
  })

  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/organizations")
      if (!res.ok) throw new Error("Erro ao buscar organizações")
      const data = await res.json()
      setOrgs(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const openCreateModal = () => {
    setModalMode('create')
    setFormData({ name: "", slug: "", adminEmail: "", adminPassword: "", isActive: true })
    setIsModalOpen(true)
  }

  const openEditModal = (org: Organization) => {
    setModalMode('edit')
    setEditingId(org.id)
    setFormData({ name: org.name, slug: org.slug, adminEmail: "", adminPassword: "", isActive: org.isActive })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (modalMode === 'create') {
        const res = await fetch("/api/admin/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        })
        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Falha ao criar organização")
        }
      } else {
        const res = await fetch(`/api/admin/organizations/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.name, slug: formData.slug, isActive: formData.isActive })
        })
        if (!res.ok) throw new Error("Falha ao atualizar organização")
      }
      
      setIsModalOpen(false)
      fetchOrganizations()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ATENÇÃO: Tem certeza que deseja excluir a organização "${name}"? Todas as rotas vinculadas a ela serão apagadas permanentemente. Isso não pode ser desfeito.`)) {
      return
    }
    
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Falha ao excluir organização")
      fetchOrganizations()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-orange-600" />
              Organizações
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">Gerencie os clientes e parceiros do GIRO</p>
          </div>
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98] shadow-md shadow-orange-600/20"
            style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Organização
          </button>
        </div>

        {error && <div className="mb-6 rounded-xl px-4 py-3 bg-red-50 border border-red-100 text-red-500 text-sm font-medium">{error}</div>}

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Building2 className="h-12 w-12 text-gray-300" />
              <p className="text-gray-500 font-semibold">Nenhuma organização cadastrada ainda</p>
              <button onClick={openCreateModal} className="text-sm font-bold text-orange-600 hover:text-orange-700">Criar a primeira →</button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nome & Identificador</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cadastro</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org, i) => (
                  <tr key={org.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 text-sm">{org.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">/{org.slug}</p>
                    </td>
                    <td className="px-6 py-4">
                      {org.isActive ? (
                        <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Ativa</span>
                      ) : (
                        <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">Inativa</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/dashboard/organizations/${org.id}/routes`} className="text-gray-400 hover:text-orange-600 transition-colors group relative" title="Ver Rotas">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button onClick={() => openEditModal(org)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(org.id, org.name)} className="text-gray-400 hover:text-red-600 transition-colors" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Estilo Giro */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            
            {/* Card do Modal */}
            <div className="relative bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-black text-gray-900 mb-6">
                {modalMode === 'create' ? 'Nova Organização' : 'Editar Organização'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Nome da Organização</label>
                    <input 
                      type="text" required value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Ex: Prefeitura de Ituiutaba"
                      className="w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      style={{ background: '#F7F7F7', border: '1.5px solid #EFEFEF' }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Identificador (Slug)</label>
                    <input 
                      type="text" required value={formData.slug} 
                      onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})}
                      placeholder="pref-ituiutaba"
                      className="w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      style={{ background: '#F7F7F7', border: '1.5px solid #EFEFEF' }}
                    />
                  </div>

                  {modalMode === 'edit' && (
                    <div className="flex items-center gap-3 mt-2">
                      <input 
                        type="checkbox" id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                        className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                      />
                      <label htmlFor="isActive" className="text-sm font-bold text-gray-700 cursor-pointer">Organização Ativa</label>
                    </div>
                  )}
                </div>

                {/* Exibe criação de credenciais apenas ao criar */}
                {modalMode === 'create' && (
                  <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                    <div className="mb-2">
                        <h3 className="text-sm font-black text-gray-900">Conta do Administrador</h3>
                        <p className="text-xs text-gray-500">Credenciais para o cliente acessar o painel.</p>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">E-mail de Acesso</label>
                      <input 
                        type="email" required value={formData.adminEmail} 
                        onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                        placeholder="admin@prefeitura.gov.br"
                        className="w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                        style={{ background: '#F7F7F7', border: '1.5px solid #EFEFEF' }}
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Senha Provisória</label>
                      <input 
                        type="text" required value={formData.adminPassword} 
                        onChange={(e) => setFormData({...formData, adminPassword: e.target.value})}
                        placeholder="Ex: Mudar@123"
                        className="w-full px-4 py-3.5 rounded-xl text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                        style={{ background: '#F7F7F7', border: '1.5px solid #EFEFEF' }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                  <button 
                    type="button" onClick={() => setIsModalOpen(false)} 
                    className="px-5 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" disabled={isSaving} 
                    className="flex items-center justify-center min-w-[120px] px-5 py-3 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #830200, #E05300)' }}
                  >
                    {isSaving ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : modalMode === 'create' ? 'Salvar Organização' : 'Atualizar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}