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

    const followingList = await db.select({ followingId: followers.followingId }).from(followers).where(eq(followers.followerId, dbUser.id))
    const followingIds = followingList.map(f => f.followingId)
    const allIds = [...followingIds, dbUser.id]

    if (allIds.length === 0) return NextResponse.json([])

    const sessions = await db.select({
      sessionId: routeSessions.id,
      userId: routeSessions.userId,
      routeId: routeSessions.routeId,
      completedAt: routeSessions.completedAt,
      totalDistanceKm: routeSessions.totalDistanceKm,
    })
      .from(routeSessions)
      .where(inArray(routeSessions.userId, allIds))
      .orderBy(desc(routeSessions.completedAt))
      .limit(20)

    if (sessions.length === 0) return NextResponse.json([])

    const routeIds = [...new Set(sessions.map(s => s.routeId))]
    const userIds = [...new Set(sessions.map(s => s.userId))]

    const routeList = await db.select({
        id: routes.id,
        name: routes.name,
        coverImageUrl: routes.coverImageUrl,
        type: routes.type,
        organizationName: organizations.name
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    .where(inArray(routes.id, routeIds))

    const userList = await db.select().from(users).where(inArray(users.id, userIds))

    const routeMap = Object.fromEntries(routeList.map(r => [r.id, r]))
    const userMap = Object.fromEntries(userList.map(u => [u.id, u]))

    const waypointCounts = await db.select({ routeId: waypoints.routeId }).from(waypoints).where(inArray(waypoints.routeId, routeIds))
    const wpCountMap: Record<string, number> = {}
    waypointCounts.forEach(w => { wpCountMap[w.routeId] = (wpCountMap[w.routeId] ?? 0) + 1 })

    const feed = sessions.map(s => {
      const r = routeMap[s.routeId]
      return {
        id: s.sessionId,
        userId: s.userId,
        userName: userMap[s.userId]?.displayName ?? 'Usuário',
        userUsername: userMap[s.userId]?.username ?? '',
        userAvatarUrl: userMap[s.userId]?.avatarUrl ?? null,
        routeName: r?.name ?? 'Rota',
        routeId: s.routeId,
        coverImageUrl: r?.coverImageUrl ?? null,
        type: r?.type ?? 'Outros',
        organizationName: r?.organizationName ?? null,
        completedAt: s.completedAt?.toISOString() ?? new Date().toISOString(),
        badgeName: null,
        badgeImageUrl: null,
        waypointCount: wpCountMap[s.routeId] ?? 0,
        distanceKm: s.totalDistanceKm,
      }
    })

    return NextResponse.json(feed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}