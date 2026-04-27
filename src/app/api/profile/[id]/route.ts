import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users, followers, routeSessions, routes, userBadges, badges, checkins } from '@/lib/db/remote/schema'
import { eq, and, sql, desc } from 'drizzle-orm'

export async function GET(
  request: Request, 
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const targetUserId = resolvedParams.id

    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    
    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))

    
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId))
    if (!targetUser) return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 })

    
    const [followersRes] = await db.select({ count: sql<number>`count(*)` }).from(followers).where(eq(followers.followingId, targetUser.id))
    const [followingRes] = await db.select({ count: sql<number>`count(*)` }).from(followers).where(eq(followers.followerId, targetUser.id))
    
    let isFollowing = false
    const isMe = me?.id === targetUser.id

    if (me && !isMe) {
      const [followCheck] = await db.select().from(followers)
        .where(and(eq(followers.followerId, me.id), eq(followers.followingId, targetUserId)))
      if (followCheck) isFollowing = true
    }

    
    const routeConditions = [
      eq(routeSessions.userId, targetUser.id),
      eq(routeSessions.status, 'concluido')
    ]

    if (!isMe) {
      routeConditions.push(eq(routeSessions.isPublic, true))
    }

    
    const completedRoutesRes = await db
      .select({
        id: routeSessions.id,
        routeName: routes.name,
        routeType: routes.type,
        routeId: routes.id,
        startedAt: routeSessions.startedAt,
        completedAt: routeSessions.completedAt,
        distanceKm: routeSessions.totalDistanceKm,
        isPublic: routeSessions.isPublic,
        
        photos: sql<string[]>`array_remove(array_agg(${checkins.selfieImagePath}), NULL)`
      })
      .from(routeSessions)
      .innerJoin(routes, eq(routeSessions.routeId, routes.id))
      .leftJoin(checkins, eq(checkins.routeSessionId, routeSessions.id))
      .where(and(...routeConditions))
      .groupBy(routeSessions.id, routes.name, routes.type, routes.id)
      .orderBy(desc(routeSessions.completedAt))

    
    const badgesRes = await db.select({
        id: badges.id, name: badges.name, description: badges.description, imageUrl: badges.imageUrl, awardedAt: userBadges.awardedAt
      })
      .from(userBadges).innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, targetUser.id))

    return NextResponse.json({
      id: targetUser.id,
      displayName: targetUser.displayName,
      username: targetUser.username,
      bio: targetUser.bio,
      avatarUrl: targetUser.avatarUrl,
      followersCount: Number(followersRes?.count || 0),
      followingCount: Number(followingRes?.count || 0),
      isFollowing, 
      isMe,
      completedRoutes: completedRoutesRes.map(r => {
        
        let elapsedMinutes = 0
        if (r.startedAt && r.completedAt) {
           const diffMs = new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
           elapsedMinutes = Math.floor(diffMs / 60000)
        }
        return {
          ...r,
          elapsedMinutes,
          completedAt: r.completedAt?.toISOString() || new Date().toISOString(),
          
          photos: Array.from(new Set(r.photos || [])).filter(Boolean)
        }
      }),
      badges: badgesRes.map(b => ({ ...b, awardedAt: b.awardedAt.toISOString() }))
    })
  } catch (err: any) {
    console.error("[API /profile/[id]] Erro:", err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}