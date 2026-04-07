// src/app/api/profile/[id]/follow/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { users, followers, notifications } from '@/lib/db/remote/schema'
import { eq, and } from 'drizzle-orm'
import { createClient as createSupabaseServerClient } from '@supabase/supabase-js'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const targetUserId = resolvedParams.id

    // Pega o token pelo Header — funciona tanto no web quanto no Capacitor
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]

    // USA O CLIENTE DO SERVIDOR (não o createBrowserClient) com o token explícito
    // Isso garante que o token do Capacitor seja validado corretamente no servidor
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Sessão inválida ou expirada' }, { status: 401 })
    }

    const [me] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseAuthId, authUser.id))
      .limit(1)

    if (!me) {
      return NextResponse.json({ error: 'Usuário autenticado não encontrado no banco' }, { status: 404 })
    }

    if (me.id === targetUserId) {
      return NextResponse.json({ error: 'Você não pode seguir a si mesmo' }, { status: 400 })
    }

    // Verifica o alvo existe
    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1)

    if (!target) {
      return NextResponse.json({ error: 'Usuário alvo não encontrado' }, { status: 404 })
    }

    // Busca TODOS os registros existentes (pode haver duplicatas por bug anterior)
    const existingFollows = await db
      .select({ id: followers.id })
      .from(followers)
      .where(
        and(
          eq(followers.followerId, me.id),
          eq(followers.followingId, targetUserId)
        )
      )

    if (existingFollows.length > 0) {
      // DEIXAR DE SEGUIR — deleta todos os registros duplicados de uma vez
      await db.delete(followers).where(
        and(
          eq(followers.followerId, me.id),
          eq(followers.followingId, targetUserId)
        )
      )

      // Remove notificações associadas
      await db.delete(notifications).where(
        and(
          eq(notifications.userId, targetUserId),
          eq(notifications.actorId, me.id),
          eq(notifications.type, 'follow')
        )
      )

      return NextResponse.json({ isFollowing: false })
    } else {
      // SEGUIR — insere um único registro
      await db.insert(followers).values({
        followerId: me.id,
        followingId: targetUserId,
      })

      // Cria notificação para o usuário que foi seguido
      await db.insert(notifications).values({
        userId: targetUserId,
        actorId: me.id,
        type: 'follow',
      })

      return NextResponse.json({ isFollowing: true })
    }
  } catch (err: any) {
    console.error('[API Follow] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}