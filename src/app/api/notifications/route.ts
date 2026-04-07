import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users, notifications } from '@/lib/db/remote/schema'
import { eq, desc, and } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const countOnly = url.searchParams.get('countOnly') === 'true'

    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))
    if (!me) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    // Retorna apenas o número de não lidas para o sininho na Home
    if (countOnly) {
      const unreadList = await db.select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, me.id), eq(notifications.isRead, false)))
      return NextResponse.json({ count: unreadList.length })
    }

    // Retorna a lista completa com os dados de quem seguiu
    const list = await db.select({
      id: notifications.id,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      actor: {
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl
      }
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))

    return NextResponse.json(list)
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Rota para marcar todas as notificações como Lidas
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))
    
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, me.id))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}