import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { checkins } from '@/lib/db/remote/schema'

export const dynamic = 'force-static' // ← ADICIONAR

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await request.json()
  const confirmed = []
  const failed = []

  for (const item of items) {
    try {
      const payload = JSON.parse(item.payload)
      if (item.entity_type === 'checkin') {
        await db.insert(checkins).values({
          localId: payload.localId,
          userId: user.id,
          waypointId: payload.waypointId,
          routeSessionId: payload.sessionId,
          capturedLatitude: payload.latitude.toString(),
          capturedLongitude: payload.longitude.toString(),
          selfieImagePath: payload.selfieBase64,
          capturedAtOffline: new Date(payload.capturedAt),
          biometricStatus: 'pending',
        }).onConflictDoNothing({ target: checkins.localId })
        confirmed.push({ localId: payload.localId, syncedAt: new Date().toISOString() })
      }
    } catch (err: any) {
      failed.push({ localId: item.id, reason: err.message })
    }
  }

  return NextResponse.json({ confirmed, failed })
}