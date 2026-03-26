import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints, users, organizations } from '@/lib/db/remote/schema'
import { eq, desc } from 'drizzle-orm'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [dbUser] = await db.select().from(users).where(eq(users.supabaseAuthId, user.id)).limit(1)
  if (dbUser?.role === 'superadmin' || dbUser?.role === 'org_admin') return dbUser
  return null
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const orgIdQuery = url.searchParams.get('orgId')

    let query = db.select({
      id: routes.id,
      name: routes.name,
      difficulty: routes.difficulty,
      status: routes.status,
      type: routes.type,
      distanceKm: routes.distanceKm,
      createdAt: routes.createdAt,
      organizationName: organizations.name
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))

    if (admin.role === 'superadmin' && orgIdQuery) {
      query = query.where(eq(routes.organizationId, orgIdQuery)) as any
    } else if (admin.role === 'org_admin') {
      if (!admin.organizationId) return NextResponse.json({ error: 'Admin sem organização' }, { status: 400 })
      query = query.where(eq(routes.organizationId, admin.organizationId)) as any
    }

    const allRoutes = await query.orderBy(desc(routes.createdAt))
    return NextResponse.json(allRoutes)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (admin.role === 'superadmin') {
        return NextResponse.json({ error: 'Superadmins não criam rotas. Apenas os administradores das Organizações podem criar.' }, { status: 403 })
    }
    if (!admin.organizationId) return NextResponse.json({ error: 'Sua conta não está vinculada a nenhuma organização.' }, { status: 400 })

    const body = await request.json()

    const slug = body.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now()
    const firstWp = body.waypoints?.[0]

    const [newRoute] = await db.insert(routes).values({
      name: body.name,
      slug,
      description: body.description || null,
      difficulty: body.difficulty || 'medium',
      type: body.type || 'caminhada',
      distanceKm: body.distanceKm || null,
      estimatedMinutes: body.estimatedMinutes ? parseInt(body.estimatedMinutes) : null,
      coverImageUrl: body.coverImageUrl || null, // <-- SALVANDO A IMAGEM
      startLatitude: firstWp?.latitude?.toString() ?? null,
      startLongitude: firstWp?.longitude?.toString() ?? null,
      createdByAdminId: admin.id,
      organizationId: admin.organizationId,
      status: 'draft',
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
    return NextResponse.json({ id: newRoute.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}