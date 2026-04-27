// src/app/api/feed/[sessionId]/like/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { sessionLikes, users } from '@/lib/db/remote/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest, 
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const resolvedParams = await context.params
    const sessionId = resolvedParams.sessionId
    
    // Captura o token explicitamente igual ao feed/route.ts
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)

    const [existingLike] = await db.select().from(sessionLikes)
      .where(and(eq(sessionLikes.sessionId, sessionId), eq(sessionLikes.userId, dbUser.id)))

    if (existingLike) {
      await db.delete(sessionLikes).where(eq(sessionLikes.id, existingLike.id))
      return NextResponse.json({ liked: false })
    } else {
      await db.insert(sessionLikes).values({ sessionId, userId: dbUser.id })
      return NextResponse.json({ liked: true })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}