import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { sessionLikes, users } from '@/lib/db/remote/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const resolvedParams = await params
    const sessionId = resolvedParams.sessionId
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)

    // Verifica se já deu like
    const [existingLike] = await db.select().from(sessionLikes)
      .where(and(eq(sessionLikes.sessionId, sessionId), eq(sessionLikes.userId, dbUser.id)))

    if (existingLike) {
      // Remove o Like
      await db.delete(sessionLikes).where(eq(sessionLikes.id, existingLike.id))
      return NextResponse.json({ liked: false })
    } else {
      // Dá o Like
      await db.insert(sessionLikes).values({ sessionId, userId: dbUser.id })
      return NextResponse.json({ liked: true })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}