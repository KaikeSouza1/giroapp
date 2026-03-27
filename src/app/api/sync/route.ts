import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { checkins, routeSessions } from '@/lib/db/remote/schema'

export async function POST(request: NextRequest) {
  // ADICIONADO O AWAIT AQUI 👇
  const supabase = await createClient()
  
  // Autentica o usuário pelo header Authorization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await request.json()
  const confirmed = []
  const failed = []

  for (const item of items) {
    try {
      const payload = JSON.parse(item.payload)

      if (item.entity_type === 'checkin') {
        // IDEMPOTÊNCIA: usa ON CONFLICT para não duplicar
        await db.insert(checkins).values({
          localId: payload.localId,
          userId: user.id,
          waypointId: payload.waypointId,
          routeSessionId: payload.sessionId,
          capturedLatitude: payload.latitude.toString(),
          capturedLongitude: payload.longitude.toString(),
          selfieImagePath: payload.selfieBase64,  // depois envia pro Storage
          capturedAtOffline: new Date(payload.capturedAt),
          biometricStatus: 'pending',
        }).onConflictDoNothing({ target: checkins.localId })  // ← chave da idempotência!

        confirmed.push({ localId: payload.localId, syncedAt: new Date().toISOString() })
      }

      // Disparar validação biométrica em background (via Supabase Edge Function)
      // await supabase.functions.invoke('validate-biometric', { body: { checkinId: payload.localId } })

    } catch (err: any) {
      failed.push({ localId: item.id, reason: err.message })
    }
  }

  return NextResponse.json({ confirmed, failed })
}