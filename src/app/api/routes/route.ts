import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, users, waypoints, organizations } from '@/lib/db/remote/schema'
import { eq, desc, and } from 'drizzle-orm'

// GET — Lista apenas as rotas PUBLICADAS para a Home e Mapa dos usuários
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const publicRoutes = await db.select({
      id: routes.id,
      name: routes.name,
      description: routes.description,
      difficulty: routes.difficulty,
      status: routes.status,
      type: routes.type,
      distanceKm: routes.distanceKm,
      estimatedMinutes: routes.estimatedMinutes,
      coverImageUrl: routes.coverImageUrl,
      startLatitude: waypoints.latitude,
      startLongitude: waypoints.longitude,
      createdAt: routes.createdAt,
      organizationName: organizations.name,
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    .leftJoin(waypoints, and(eq(waypoints.routeId, routes.id), eq(waypoints.order, 1)))
    // 👇 Uso obrigatório do termo 'publicado' devido ao Schema do Drizzle 👇
    .where(eq(routes.status, 'publicado'))
    .orderBy(desc(routes.createdAt))

    return NextResponse.json(publicRoutes)
  } catch (err: any) {
    console.error("[API /routes] Erro no GET:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Cria nova rota (Apenas Admins)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select().from(users)
      .where(eq(users.supabaseAuthId, user.id)).limit(1)

    if (!dbUser || (dbUser.role !== 'superadmin' && dbUser.role !== 'admin_org')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const organizationId = dbUser.role === 'admin_org'
      ? dbUser.organizationId
      : body.organizationId || null

    const slug = body.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now()

    const [newRoute] = await db.insert(routes).values({
      name: body.name,
      slug,
      description: body.description || null,
      coverImageUrl: body.coverImageUrl || null,
      difficulty: body.difficulty || 'medio',
      type: body.type || 'caminhada',
      distanceKm: body.distanceKm ? body.distanceKm.toString() : null,
      estimatedMinutes: body.estimatedMinutes ? parseInt(body.estimatedMinutes) : null,
      organizationId,
      status: 'rascunho', // Uso obrigatório do termo 'rascunho' devido ao Schema
    }).returning()

    if (body.waypoints?.length > 0) {
      await db.insert(waypoints).values(
        body.waypoints.map((wp: any, i: number) => ({
          routeId: newRoute.id,
          order: i + 1,
          name: wp.name || `Ponto ${i + 1}`,
          description: wp.description || null,
          latitude: wp.latitude.toString(),
          longitude: wp.longitude.toString(),
          radiusMeters: wp.radiusMeters || 50,
          requiresSelfie: wp.requiresSelfie ?? true,
        }))
      )
    }

    return NextResponse.json(newRoute, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}