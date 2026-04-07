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
    // 1. Resolve o ID da URL com segurança no Next.js 15+
    const resolvedParams = await params
    const targetUserId = resolvedParams.id

    // 2. Pega o token de autenticação que o Front-End enviou
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]

    // 3. Valida o usuário com o Supabase usando apenas o Token
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    // 4. Busca nosso usuário no banco de dados
    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))
    
    if (!me || me.id === targetUserId) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    // 5. Verifica se JÁ SEGUE
    const [existingFollow] = await db.select().from(followers)
      .where(and(eq(followers.followerId, me.id), eq(followers.followingId, targetUserId)))

    if (existingFollow) {
      // DEIXAR DE SEGUIR
      await db.delete(followers).where(eq(followers.id, existingFollow.id))
      
      // Remove a notificação (se existir)
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
      
      // Cria notificação para a pessoa que foi seguida
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