// src/app/api/profile/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users, followers, routeSessions, routes, userBadges, badges, checkins } from '@/lib/db/remote/schema'
import { eq, and, sql, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const { data: { user: authUser }, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser()

    if (!authUser || authError) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, authUser.id))
      .limit(1)

    if (!user) {
      return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 })
    }

    const [followersRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(followers)
      .where(eq(followers.followingId, user.id))
      
    const [followingRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(followers)
      .where(eq(followers.followerId, user.id))

    // 👇 BUSCA AS ROTAS CONCLUÍDAS COM AS FOTOS, TEMPO E DATAS
    const completedRoutesRes = await db
      .select({
        id: routeSessions.id,
        routeName: routes.name,
        routeType: routes.type, // Pega o ícone/tipo da rota
        startedAt: routeSessions.startedAt,
        completedAt: routeSessions.completedAt,
        distanceKm: routeSessions.totalDistanceKm,
        // Agrupa as URLs das fotos num array
        photos: sql<string[]>`array_remove(array_agg(${checkins.selfieImagePath}), NULL)`
      })
      .from(routeSessions)
      .innerJoin(routes, eq(routeSessions.routeId, routes.id))
      // Faz um join na tabela de checkins para pegar as fotos dessa sessão
      .leftJoin(checkins, eq(checkins.routeSessionId, routeSessions.id))
      // CORRIGIDO AQUI: 'concluido' para 'concluido'
      .where(and(eq(routeSessions.userId, user.id), eq(routeSessions.status, 'concluido')))
      .groupBy(routeSessions.id, routes.name, routes.type)
      .orderBy(desc(routeSessions.completedAt)) // As mais recentes primeiro

    const badgesRes = await db
      .select({
        id: badges.id,
        name: badges.name,
        description: badges.description,
        imageUrl: badges.imageUrl,
        awardedAt: userBadges.awardedAt
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, user.id))

    const profileData = {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      isSelfieCaptured: user.isSelfieCaptured ?? false,
      followersCount: Number(followersRes?.count || 0),
      followingCount: Number(followingRes?.count || 0),
      completedRoutes: completedRoutesRes.map(r => {
        // Calcula o tempo gasto em minutos
        let elapsedMinutes = 0
        if (r.startedAt && r.completedAt) {
           const diffMs = new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
           elapsedMinutes = Math.floor(diffMs / 60000)
        }

        return {
          id: r.id,
          routeName: r.routeName,
          routeType: r.routeType,
          completedAt: r.completedAt ? r.completedAt.toISOString() : new Date().toISOString(),
          distanceKm: r.distanceKm,
          elapsedMinutes,
          // Garante que é um array único de fotos (remove duplicadas se houver)
          photos: Array.from(new Set(r.photos || [])).filter(Boolean)
        }
      }),
      badges: badgesRes.map(b => ({
        ...b,
        awardedAt: b.awardedAt.toISOString()
      }))
    }

    return NextResponse.json(profileData)
  } catch (err: any) {
    console.error("[API /profile/me] Erro:", err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}