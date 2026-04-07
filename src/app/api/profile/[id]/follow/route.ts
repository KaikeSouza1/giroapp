// src/app/api/profile/[id]/follow/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { users, followers, notifications } from '@/lib/db/remote/schema'
import { eq, and } from 'drizzle-orm'
import { createBrowserClient } from '@supabase/ssr'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const targetUserId = resolvedParams.id

    // 1. OBRIGATÓRIO: Pegar o token pelo Header para funcionar no celular
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]

    // 2. Valida o usuário com o Supabase usando o Token recebido
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))
    
    if (!me || me.id === targetUserId) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    // 3. Checa TODOS os registros existentes para limpar lixo duplicado
    const existingFollows = await db.select().from(followers)
      .where(and(eq(followers.followerId, me.id), eq(followers.followingId, targetUserId)))

    if (existingFollows.length > 0) {
      // DEIXAR DE SEGUIR COMPLETAMENTE (Deleta todo lixo duplicado de uma vez)
      await db.delete(followers).where(
        and(eq(followers.followerId, me.id), eq(followers.followingId, targetUserId))
      )
      
      // Apaga as notificações associadas
      await db.delete(notifications).where(
        and(
          eq(notifications.userId, targetUserId),
          eq(notifications.actorId, me.id),
          eq(notifications.type, 'follow')
        )
      )
      
      return NextResponse.json({ isFollowing: false })
    } else {
      // SEGUIR
      await db.insert(followers).values({ followerId: me.id, followingId: targetUserId })
      
      // Cria a notificação de quem foi seguido
      await db.insert(notifications).values({
        userId: targetUserId,
        actorId: me.id,
        type: 'follow'
      })
      
      return NextResponse.json({ isFollowing: true })
    }
  } catch (err: any) {
    console.error("Erro na API Follow:", err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}