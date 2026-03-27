// src/app/api/profile/[id]/follow/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users, followers } from '@/lib/db/remote/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await context.params
    const targetUserId = resolvedParams.id

    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // Descobrir o ID interno de quem clicou
    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))
    if (!me || me.id === targetUserId) return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })

    // Verifica se já segue
    const [existingFollow] = await db.select().from(followers)
      .where(and(eq(followers.followerId, me.id), eq(followers.followingId, targetUserId)))

    if (existingFollow) {
      // Deixar de seguir (Unfollow)
      await db.delete(followers).where(eq(followers.id, existingFollow.id))
      return NextResponse.json({ isFollowing: false })
    } else {
      // Seguir (Follow)
      await db.insert(followers).values({
        followerId: me.id,
        followingId: targetUserId
      })
      return NextResponse.json({ isFollowing: true })
    }
  } catch (err: any) {
    console.error("[API /follow] Erro:", err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}