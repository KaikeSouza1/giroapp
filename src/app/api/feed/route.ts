// src/app/api/feed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routeSessions, routes, users, followers, waypoints, organizations } from '@/lib/db/remote/schema'
import { eq, inArray, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json([], { status: 401 })

    const supabase = await createClient()
    const { data } = await supabase.auth.getUser(token)
    
    if (!data.user) return NextResponse.json([], { status: 401 })

    const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, data.user.id)).limit(1)
    if (!dbUser) return NextResponse.json([])

    // ── NOVO: Verifica se a URL pede o feed de um usuário específico (Perfil) ──
    const url = new URL(request.url)
    const profileUserId = url.searchParams.get('userId')

    let targetUserIds: string[] = []

    if (profileUserId) {
      // Se tiver userId na URL, puxa só as atividades desse usuário
      targetUserIds = [profileUserId]
    } else {
      // Lógica original: puxar de quem eu sigo + eu mesmo
      const followingList = await db.select({ followingId: followers.followingId }).from(followers).where(eq(followers.followerId, dbUser.id))
      const followingIds = followingList.map(f => f.followingId)
      targetUserIds = [...followingIds, dbUser.id]
    }

    if (targetUserIds.length === 0) return NextResponse.json([])

    // ── NOVO: Adicionado activityType, pace, duration e socialImage ──
    const sessions = await db.select({
      sessionId: routeSessions.id,
      userId: routeSessions.userId,
      routeId: routeSessions.routeId,
      completedAt: routeSessions.completedAt,
      totalDistanceKm: routeSessions.totalDistanceKm,
      activityType: routeSessions.activityType,
      averagePace: routeSessions.averagePace,
      durationSeconds: routeSessions.durationSeconds,
      socialImageUrl: routeSessions.socialImageUrl,
    })
      .from(routeSessions)
      .where(inArray(routeSessions.userId, targetUserIds))
      .orderBy(desc(routeSessions.completedAt))
      .limit(30)

    if (sessions.length === 0) return NextResponse.json([])

    // Filtra IDs de rotas válidos (Treinos livres tem routeId = null)
    const routeIds = [...new Set(sessions.map(s => s.routeId).filter(Boolean))] as string[]
    const userIds = [...new Set(sessions.map(s => s.userId))]

    let routeList: any[] = []
    let waypointCounts: any[] = []

    if (routeIds.length > 0) {
      routeList = await db.select({
          id: routes.id,
          name: routes.name,
          coverImageUrl: routes.coverImageUrl,
          type: routes.type,
          organizationName: organizations.name
      })
      .from(routes)
      .leftJoin(organizations, eq(routes.organizationId, organizations.id))
      .where(inArray(routes.id, routeIds))

      waypointCounts = await db.select({ routeId: waypoints.routeId }).from(waypoints).where(inArray(waypoints.routeId, routeIds))
    }

    const userList = await db.select().from(users).where(inArray(users.id, userIds))

    const routeMap = Object.fromEntries(routeList.map(r => [r.id, r]))
    const userMap = Object.fromEntries(userList.map(u => [u.id, u]))

    const wpCountMap: Record<string, number> = {}
    waypointCounts.forEach(w => { wpCountMap[w.routeId] = (wpCountMap[w.routeId] ?? 0) + 1 })

    const feed = sessions.map(s => {
      const r = s.routeId ? routeMap[s.routeId] : null
      
      return {
        id: s.sessionId,
        userId: s.userId,
        userName: userMap[s.userId]?.displayName ?? 'Usuário',
        userUsername: userMap[s.userId]?.username ?? '',
        userAvatarUrl: userMap[s.userId]?.avatarUrl ?? null,
        
        // Se for trilha, usa os dados da trilha. Se for treino livre, usa os dados da sessão
        routeName: r?.name ?? null,
        routeId: s.routeId,
        coverImageUrl: r?.coverImageUrl ?? null,
        type: r?.type ?? s.activityType ?? 'outros',
        organizationName: r?.organizationName ?? null,
        completedAt: s.completedAt?.toISOString() ?? new Date().toISOString(),
        badgeName: null,
        badgeImageUrl: null,
        waypointCount: s.routeId ? (wpCountMap[s.routeId] ?? 0) : 0,
        distanceKm: s.totalDistanceKm,
        
        // Novos campos pro front-end
        socialImageUrl: s.socialImageUrl,
        averagePace: s.averagePace,
        durationSeconds: s.durationSeconds,
        activityType: s.activityType
      }
    })

    return NextResponse.json(feed)
  } catch (err: any) {
    console.error("Erro no feed API:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}