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

    // BUSCA AS ROTAS CONCLUÍDAS COM AS FOTOS, TEMPO E DATAS
    const completedRoutesRes = await db
      .select({
        id: routeSessions.id,
        routeName: routes.name,
        routeType: routes.type, 
        startedAt: routeSessions.startedAt,
        completedAt: routeSessions.completedAt,
        distanceKm: routeSessions.totalDistanceKm,
        photos: sql<string[]>`array_remove(array_agg(${checkins.selfieImagePath}), NULL)`
      })
      .from(routeSessions)
      .innerJoin(routes, eq(routeSessions.routeId, routes.id))
      .leftJoin(checkins, eq(checkins.routeSessionId, routeSessions.id))
      .where(and(eq(routeSessions.userId, user.id), eq(routeSessions.status, 'concluido')))
      .groupBy(routeSessions.id, routes.name, routes.type)
      .orderBy(desc(routeSessions.completedAt))

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

    // ─── LÓGICA DE SINCRONIZAÇÃO RETROATIVA DE INSÍGNIAS (AUTO-HEALING) ───
    const totalCompleted = completedRoutesRes.length;
    const currentBadgeNames = badgesRes.map(b => b.name);
    
    // Regras de conquista
    const badgeRules = [
      { count: 1, name: 'Primeira Pegada', desc: 'Concluiu a primeira rota oficial no Giro.', img: 'https://api.dicebear.com/7.x/glass/svg?seed=Pegada&backgroundColor=e05300' },
      { count: 5, name: 'Desbravador', desc: 'Alcançou a marca de 5 rotas oficiais.', img: 'https://api.dicebear.com/7.x/glass/svg?seed=Desbravador&backgroundColor=830200' },
      { count: 10, name: 'Lenda do Giro', desc: 'Sobreviveu a 10 rotas oficiais épicas.', img: 'https://api.dicebear.com/7.x/glass/svg?seed=Lenda&backgroundColor=ffb300' }
    ];

    // Verifica se o usuário bateu a meta de alguma insígnia que ele AINDA NÃO TEM
    const missingRules = badgeRules.filter(rule => totalCompleted >= rule.count && !currentBadgeNames.includes(rule.name));

    if (missingRules.length > 0) {
      for (const rule of missingRules) {
        // 1. Verifica se a insígnia existe no banco de dados geral, se não, cria
        let [badgeObj] = await db.select().from(badges).where(eq(badges.name, rule.name)).limit(1);
        
        if (!badgeObj) {
          [badgeObj] = await db.insert(badges).values({
            name: rule.name,
            description: rule.desc,
            imageUrl: rule.img,
            type: 'conclusao_rota'
          }).returning();
        }

        // 2. Entrega a insígnia retroativamente para o usuário
        const [newAward] = await db.insert(userBadges).values({
          userId: user.id,
          badgeId: badgeObj.id
        }).returning();

        // 3. Adiciona a nova insígnia na resposta para aparecer imediatamente na tela
        badgesRes.push({
          id: badgeObj.id,
          name: badgeObj.name,
          description: badgeObj.description,
          imageUrl: badgeObj.imageUrl,
          awardedAt: newAward.awardedAt
        });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

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