// src/app/api/feed/[sessionId]/like/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { sessionLikes, users } from '@/lib/db/remote/schema'
import { eq, and, count } from 'drizzle-orm'

export async function POST(
  request: NextRequest, 
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const resolvedParams = await context.params
    const sessionId = resolvedParams.sessionId
    
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error("Erro de autenticação no like:", authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1)

    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [existingLike] = await db
      .select()
      .from(sessionLikes)
      .where(and(eq(sessionLikes.sessionId, sessionId), eq(sessionLikes.userId, dbUser.id)))

    let liked: boolean

    if (existingLike) {
      await db.delete(sessionLikes).where(eq(sessionLikes.id, existingLike.id))
      liked = false
    } else {
      await db.insert(sessionLikes).values({ sessionId, userId: dbUser.id })
      liked = true
    }

    // FIX: Retorna o total atualizado para o frontend sincronizar corretamente
    const [{ value: likesCount }] = await db
      .select({ value: count() })
      .from(sessionLikes)
      .where(eq(sessionLikes.sessionId, sessionId))

    return NextResponse.json({ liked, likesCount: Number(likesCount) })
  } catch (err: any) {
    console.error("Erro na rota de like:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}