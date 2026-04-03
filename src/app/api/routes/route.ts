import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, users, waypoints, organizations } from '@/lib/db/remote/schema'
import { eq, desc } from 'drizzle-orm'

// GET — lista todas as rotas (para o painel admin)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select().from(users)
      .where(eq(users.supabaseAuthId, user.id)).limit(1)

    // CORRIGIDO: org_admin -> admin_org
    if (!dbUser || (dbUser.role !== 'superadmin' && dbUser.role !== 'admin_org')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const query = db.select({
      id: routes.id,
      name: routes.name,
      difficulty: routes.difficulty,
      status: routes.status,
      type: routes.type,
      distanceKm: routes.distanceKm,
      createdAt: routes.createdAt,
      organizationName: organizations.name,
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    .orderBy(desc(routes.createdAt))

    // CORRIGIDO: org_admin -> admin_org
    const allRoutes = dbUser.role === 'admin_org' && dbUser.organizationId
      ? await query.where(eq(routes.organizationId, dbUser.organizationId))
      : await query

    return NextResponse.json(allRoutes)
  } catch (err: any) {
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

    // CORRIGIDO: org_admin -> admin_org
    if (!dbUser || (dbUser.role !== 'superadmin' && dbUser.role !== 'admin_org')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // CORRIGIDO: org_admin -> admin_org
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
      difficulty: body.difficulty || 'medio', // CORRIGIDO PARA PORTUGUÊS
      type: body.type || 'caminhada',
      distanceKm: body.distanceKm ? body.distanceKm.toString() : null,
      estimatedMinutes: body.estimatedMinutes ? parseInt(body.estimatedMinutes) : null,
      organizationId,
      status: 'rascunho', // CORRIGIDO PARA PORTUGUÊS
    }).returning()

    // Insere os waypoints se houver
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