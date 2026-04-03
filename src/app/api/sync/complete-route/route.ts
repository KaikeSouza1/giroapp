import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { checkins, routeSessions, userBadges, badges, users } from '@/lib/db/remote/schema'
import { createClient } from '@/lib/supabase/client'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 👇 PEGAR O TOKEN DO HEADER COMO FIZEMOS ANTES
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const { data: { user }, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser()

    if (!user || authError) throw new Error("Não autenticado")

    // Precisamos do ID interno do nosso banco, não o do Supabase Auth
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1)

    if (!dbUser) throw new Error("Usuário não encontrado no banco de dados.")

    const body = await req.json()
    const newSessionId = uuidv4() // Gera um ID válido para o banco

    // 1. Salva a Sessão da Rota como "Concluída" usando o ID do usuário no NOSSO BANCO
    await db.insert(routeSessions).values({
      id: newSessionId,
      localId: uuidv4(),
      userId: dbUser.id, // <-- CORREÇÃO: Usando dbUser.id em vez de user.id (Auth)
      routeId: body.routeId,
      status: 'concluido',
      startedAt: new Date(Date.now() - (body.elapsedSecs * 1000)),
      completedAt: new Date(),
      totalDistanceKm: body.distanceKm?.toString() || '0'
    })

    // 2. Salva todos os Check-ins vinculados à sessão acima
    for (const c of body.checkins) {
      await db.insert(checkins).values({
        localId: uuidv4(),
        userId: dbUser.id, // <-- CORREÇÃO AQUI TAMBÉM
        waypointId: c.waypointId,
        routeSessionId: newSessionId, // Vincula corretamente a sessão que acabou de ser criada
        capturedLatitude: c.lat.toString(),
        capturedLongitude: c.lng.toString(),
        distanceFromWaypointMeters: c.distance.toString(),
        selfieImagePath: c.photoUrl, 
        capturedAtOffline: new Date(),
        syncedAt: new Date()
      })
    }

    // 3. Libera a Insígnia (Badge)
    const routeBadges = await db.select().from(badges).where(eq(badges.routeId, body.routeId))
    
    if (routeBadges.length > 0) {
      const badgeToGive = routeBadges[0]
      
      const existingUserBadge = await db.select().from(userBadges)
        .where(
          and(
            eq(userBadges.userId, dbUser.id), // <-- E AQUI!
            eq(userBadges.badgeId, badgeToGive.id)
          )
        )

      if (existingUserBadge.length === 0) {
        await db.insert(userBadges).values({
          userId: dbUser.id, // <-- E AQUI!
          badgeId: badgeToGive.id,
          routeSessionId: newSessionId
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Erro no complete-route:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}