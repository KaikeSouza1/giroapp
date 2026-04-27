
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routeSessions, badges, userBadges } from '@/lib/db/remote/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const sessionId = resolvedParams.id

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { totalDistanceKm } = await request.json()

    
    const [currentSession] = await db.select().from(routeSessions).where(eq(routeSessions.id, sessionId)).limit(1)
    if (!currentSession) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })

    
    await db.update(routeSessions)
      .set({
        status: 'concluido',
        completedAt: new Date(),
        totalDistanceKm: totalDistanceKm ? totalDistanceKm.toString() : null,
      })
      .where(eq(routeSessions.id, sessionId))

    
    
    
    const [completedRes] = await db.select({ count: sql<number>`count(*)` })
      .from(routeSessions)
      .where(and(eq(routeSessions.userId, currentSession.userId), eq(routeSessions.status, 'concluido')))
      
    const totalCompleted = Number(completedRes?.count || 0)

    
    let badgeAward = null

    if (totalCompleted === 1) {
      badgeAward = { 
        name: 'Primeira Pegada', 
        desc: 'Concluiu a primeira rota oficial no Giro.', 
        img: 'https://api.dicebear.com/7.x/glass/svg?seed=Pegada&backgroundColor=e05300' 
      }
    } else if (totalCompleted === 5) {
      badgeAward = { 
        name: 'Desbravador', 
        desc: 'Alcançou a marca de 5 rotas oficiais.', 
        img: 'https://api.dicebear.com/7.x/glass/svg?seed=Desbravador&backgroundColor=830200' 
      }
    } else if (totalCompleted === 10) {
      badgeAward = { 
        name: 'Lenda do Giro', 
        desc: 'Sobreviveu a 10 rotas oficiais épicas.', 
        img: 'https://api.dicebear.com/7.x/glass/svg?seed=Lenda&backgroundColor=ffb300' 
      }
    }

    
    if (badgeAward) {
      
      let [badgeObj] = await db.select().from(badges).where(eq(badges.name, badgeAward.name)).limit(1)
      
      
      if (!badgeObj) {
        [badgeObj] = await db.insert(badges).values({
          name: badgeAward.name,
          description: badgeAward.desc,
          imageUrl: badgeAward.img,
          type: 'conclusao_rota'
        }).returning()
      }

      
      const [alreadyHas] = await db.select().from(userBadges)
        .where(and(eq(userBadges.userId, currentSession.userId), eq(userBadges.badgeId, badgeObj.id))).limit(1)

      
      if (!alreadyHas) {
        await db.insert(userBadges).values({
          userId: currentSession.userId,
          badgeId: badgeObj.id,
          routeSessionId: sessionId
        })
      }
    }

    return NextResponse.json({ success: true, newTotalRoutes: totalCompleted })
  } catch (err: any) {
    console.error("Erro no Complete API:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}