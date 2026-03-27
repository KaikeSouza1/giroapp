// src/app/api/admin/organizations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { organizations, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

// 👇 CONFIGURAÇÃO OBRIGATÓRIA PARA O BUILD ESTÁTICO (CAPACITOR)
export const dynamic = 'force-static'
export function generateStaticParams() {
  return [] // Retorna vazio para o build ignorar a pré-geração de IDs
}

// Função auxiliar para verificar se é superadmin
async function checkSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)
  return dbUser?.role === 'superadmin'
}

// EDITAR (PATCH)
export async function PATCH(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> } // Corrigido para o padrão assíncrono do Next 15
) {
  try {
    const isSuperAdmin = await checkSuperAdmin()
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const resolvedParams = await context.params
    const id = resolvedParams.id
    const body = await request.json()

    await db.update(organizations)
      .set({
        name: body.name,
        slug: body.slug,
        isActive: body.isActive,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// EXCLUIR (DELETE)
export async function DELETE(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> } // Corrigido para o padrão assíncrono do Next 15
) {
  try {
    const isSuperAdmin = await checkSuperAdmin()
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const resolvedParams = await context.params
    const id = resolvedParams.id

    // O Drizzle vai deletar em cascata as rotas vinculadas
    await db.delete(organizations).where(eq(organizations.id, id))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}