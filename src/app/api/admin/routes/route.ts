import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

// Verifica se o usuário é admin
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [dbUser] = await db.select().from(users)
    .where(eq(users.supabaseAuthId, user.id)).limit(1)

  return dbUser?.isAdmin ? dbUser : null
}

// GET — lista todas as rotas
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allRoutes = await db.select().from(routes)
      .orderBy(routes.createdAt)

    return NextResponse.json(allRoutes)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — cria nova rota com waypoints
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    const slug = body.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now()

    // Pega coordenadas do primeiro waypoint como ponto de início
    const firstWp = body.waypoints?.[0]

    const [newRoute] = await db.insert(routes).values({
      name: body.name,
      slug,
      description: body.description || null,
      difficulty: body.difficulty || 'medium',
      distanceKm: body.distanceKm || null,
      estimatedMinutes: body.estimatedMinutes ? parseInt(body.estimatedMinutes) : null,
      startLatitude: firstWp?.latitude?.toString() ?? null,
      startLongitude: firstWp?.longitude?.toString() ?? null,
      createdByAdminId: admin.id,
      status: 'draft',
    }).returning()

    // Insere os waypoints
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