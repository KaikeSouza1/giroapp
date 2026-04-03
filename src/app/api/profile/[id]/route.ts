// src/app/api/profile/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users, followers, routeSessions, routes, userBadges, badges } from '@/lib/db/remote/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function GET(
  request: Request, 
  context: { params: Promise<{ id: string }> } // Tipagem Next 15
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
    if (me && me.id !== targetUser.id) {
      const [followCheck] = await db.select().from(followers)
        .where(and(eq(followers.followerId, me.id), eq(followers.followingId, targetUserId)))
      if (followCheck) isFollowing = true
    }

    const completedRoutesRes = await db.select({
        id: routeSessions.id, routeName: routes.name, completedAt: routeSessions.completedAt, distanceKm: routeSessions.totalDistanceKm
      })
      .from(routeSessions).innerJoin(routes, eq(routeSessions.routeId, routes.id))
      // CORRIGIDO AQUI: 'concluido' para 'concluido'
      .where(and(eq(routeSessions.userId, targetUser.id), eq(routeSessions.status, 'concluido')))

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
      isMe: me?.id === targetUser.id,
      completedRoutes: completedRoutesRes.map(r => ({ ...r, completedAt: r.completedAt?.toISOString() || new Date().toISOString() })),
      badges: badgesRes.map(b => ({ ...b, awardedAt: b.awardedAt.toISOString() }))
    })
  } catch (err: any) {
    console.error("[API /profile/[id]] Erro:", err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}