import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users, followers, routeSessions, routes, userBadges, badges } from '@/lib/db/remote/schema'
import { eq, and, sql } from 'drizzle-orm'

// 👇 Mágica do Build Estático AQUI TAMBÉM (Corrigido com NextRequest)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 👇 Extrai o token enviado pelo Capacitor via Header (CORREÇÃO AQUI)
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    // Força o Supabase a validar pelo Token (Mobile) ou pelos Cookies (Web)
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

    const completedRoutesRes = await db
      .select({
        id: routeSessions.id,
        routeName: routes.name,
        completedAt: routeSessions.completedAt,
        distanceKm: routeSessions.totalDistanceKm
      })
      .from(routeSessions)
      .innerJoin(routes, eq(routeSessions.routeId, routes.id))
      .where(and(eq(routeSessions.userId, user.id), eq(routeSessions.status, 'completed')))

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
      completedRoutes: completedRoutesRes.map(r => ({
        ...r,
        completedAt: r.completedAt ? r.completedAt.toISOString() : new Date().toISOString()
      })),
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