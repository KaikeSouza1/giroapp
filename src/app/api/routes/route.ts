// src/app/api/routes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, users, waypoints, organizations } from '@/lib/db/remote/schema'
import { eq, desc, and } from 'drizzle-orm'

// GET — lista todas as rotas (puxando início do primeiro waypoint)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // Query otimizada para buscar a coordenada do waypoint de ordem 1
    const allRoutes = await db.select({
      id: routes.id,
      name: routes.name,
      description: routes.description,
      difficulty: routes.difficulty,
      status: routes.status,
      type: routes.type,
      distanceKm: routes.distanceKm,
      estimatedMinutes: routes.estimatedMinutes,
      coverImageUrl: routes.coverImageUrl,
      // Coordenadas extraídas dinamicamente do primeiro waypoint
      startLatitude: waypoints.latitude,
      startLongitude: waypoints.longitude,
      createdAt: routes.createdAt,
      organizationName: organizations.name,
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    // Join específico para pegar apenas o ponto de início (Ordem 1)
    .leftJoin(waypoints, and(eq(waypoints.routeId, routes.id), eq(waypoints.order, 1)))
    .orderBy(desc(routes.createdAt))

    return NextResponse.json(allRoutes)
  } catch (err: any) {
    console.error("[API /routes] Erro no GET:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — cria nova rota
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
      status: 'rascunho',
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