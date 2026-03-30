// src/app/api/sessions/[id]/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { checkins, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await context.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select({ id: users.id })
      .from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const {
      waypointId,
      selfieImagePath,   // URL pública da selfie no Supabase Storage
      capturedLatitude,
      capturedLongitude,
      distanceFromWaypointMeters,
    } = await request.json()

    const localId = crypto.randomUUID()

    const [newCheckin] = await db.insert(checkins).values({
      localId,
      userId: dbUser.id,
      waypointId,
      routeSessionId: sessionId,
      capturedLatitude: capturedLatitude.toString(),
      capturedLongitude: capturedLongitude.toString(),
      distanceFromWaypointMeters: distanceFromWaypointMeters?.toString() ?? null,
      selfieImagePath,
      biometricStatus: 'pending',
      capturedAtOffline: new Date(),
    }).returning()

    return NextResponse.json({ id: newCheckin.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}