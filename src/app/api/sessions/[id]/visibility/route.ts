import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routeSessions } from '@/lib/db/remote/schema'
import { eq, and } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { isPublic } = await request.json()

    // Atualiza apenas se a sessão pertencer ao utilizador logado (Segurança)
    await db.update(routeSessions)
      .set({ isPublic })
      .where(and(eq(routeSessions.id, sessionId), eq(routeSessions.userId, user.id)))

    return NextResponse.json({ success: true, isPublic })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}