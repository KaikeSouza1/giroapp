import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { checkins, routeSessions, userBadges, badges } from '@/lib/db/remote/schema'
import { createClient } from '@/lib/supabase/client'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Não autenticado")

    const body = await req.json()
    const sessionId = uuidv4()

    // 1. Salva a Sessão da Rota como "Concluída"
    await db.insert(routeSessions).values({
      id: sessionId,
      localId: uuidv4(),
      userId: user.id,
      routeId: body.routeId,
      status: 'completed',
      startedAt: new Date(Date.now() - (body.elapsedSecs * 1000)),
      completedAt: new Date(),
      totalDistanceKm: body.distanceKm?.toString() || '0'
    })

    // 2. Salva todos os Check-ins com as URLs das fotos do Supabase
    for (const c of body.checkins) {
      await db.insert(checkins).values({
        localId: uuidv4(),
        userId: user.id,
        waypointId: c.waypointId,
        routeSessionId: sessionId,
        capturedLatitude: c.lat.toString(),
        capturedLongitude: c.lng.toString(),
        distanceFromWaypointMeters: c.distance.toString(),
        selfieImagePath: c.photoUrl, 
        capturedAtOffline: new Date(),
        syncedAt: new Date()
      })
    }

    // 3. Libera a Insígnia (Badge) de forma SEGURA! 🏆
    const routeBadges = await db.select().from(badges).where(eq(badges.routeId, body.routeId))
    
    if (routeBadges.length > 0) {
      const badgeToGive = routeBadges[0]
      
      // CHECAGEM MÁGICA: O usuário já ganhou essa insígnia antes?
      const existingUserBadge = await db.select().from(userBadges)
        .where(
          and(
            eq(userBadges.userId, user.id),
            eq(userBadges.badgeId, badgeToGive.id)
          )
        )

      // Se ele NÃO tiver a insígnia, a gente salva! Se já tiver, ignora para não dar erro vermelho.
      if (existingUserBadge.length === 0) {
        await db.insert(userBadges).values({
          userId: user.id,
          badgeId: badgeToGive.id,
          routeSessionId: sessionId
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}