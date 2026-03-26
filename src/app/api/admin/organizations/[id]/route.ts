import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { organizations, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

// Função auxiliar para verificar se é superadmin
async function checkSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)
  return dbUser?.role === 'superadmin'
}

// EDITAR (PATCH)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isSuperAdmin = await checkSuperAdmin()
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
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
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isSuperAdmin = await checkSuperAdmin()
    if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    // O Drizzle vai deletar em cascata as rotas vinculadas porque configuramos onDelete: 'cascade' no schema
    await db.delete(organizations).where(eq(organizations.id, id))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}