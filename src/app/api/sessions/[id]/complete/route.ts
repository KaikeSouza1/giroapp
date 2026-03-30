// src/app/api/sessions/[id]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routeSessions } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await context.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { totalDistanceKm } = await request.json()

    await db.update(routeSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        totalDistanceKm: totalDistanceKm ? totalDistanceKm.toString() : null,
      })
      .where(eq(routeSessions.id, sessionId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}