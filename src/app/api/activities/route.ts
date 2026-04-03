import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { activities, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabase = await createClient()
    const { data: { user }, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser()

    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1)

    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await request.json()

    const [newActivity] = await db.insert(activities).values({
      userId: dbUser.id,
      type: body.type,
      title: body.title ?? null,
      startedAt: new Date(body.startedAt),
      completedAt: new Date(body.completedAt),
      durationSeconds: body.durationSeconds,
      distanceKm: body.distanceKm?.toString(),
      avgPaceSecPerKm: body.avgPaceSecPerKm,
      avgSpeedKmH: body.avgSpeedKmH?.toString(),
      coordinates: body.coordinates,
    }).returning()

    return NextResponse.json(newActivity, { status: 201 })
  } catch (err: any) {
    console.error('[API /activities]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabase = await createClient()
    const { data: { user } } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1)

    if (!dbUser) return NextResponse.json([])

    const userActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.userId, dbUser.id))
      .orderBy(activities.completedAt)

    return NextResponse.json(userActivities)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}