// src/app/api/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routeSessions, users } from '@/lib/db/remote/schema'
import { eq, and } from 'drizzle-orm'

// POST — inicia uma nova sessão de rota
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select({ id: users.id })
      .from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)

    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { routeId } = await request.json()

    // Se já existe uma sessão em andamento para esta rota, retorna ela
    const [existing] = await db.select()
      .from(routeSessions)
      .where(and(
        eq(routeSessions.userId, dbUser.id),
        eq(routeSessions.routeId, routeId),
        eq(routeSessions.status, 'in_progress')
      ))
      .limit(1)

    if (existing) {
      return NextResponse.json({ id: existing.id, resumed: true })
    }

    // Cria nova sessão
    const localId = crypto.randomUUID()
    const [newSession] = await db.insert(routeSessions).values({
      localId,
      userId: dbUser.id,
      routeId,
      status: 'in_progress',
      startedAt: new Date(),
    }).returning()

    return NextResponse.json({ id: newSession.id, resumed: false }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}