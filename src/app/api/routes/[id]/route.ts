import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints, organizations } from '@/lib/db/remote/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [route] = await db.select({
      id: routes.id,
      name: routes.name,
      description: routes.description,
      difficulty: routes.difficulty,
      type: routes.type, // Pega o tipo de rota
      distanceKm: routes.distanceKm,
      estimatedMinutes: routes.estimatedMinutes,
      coverImageUrl: routes.coverImageUrl,
      status: routes.status,
      organizationName: organizations.name, // Junta e pega o nome da organização
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    .where(eq(routes.id, params.id))
    .limit(1)

    if (!route) return NextResponse.json(null, { status: 404 })

    const wps = await db.select().from(waypoints)
      .where(eq(waypoints.routeId, params.id))
      .orderBy(asc(waypoints.order))

    return NextResponse.json({ ...route, waypoints: wps })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}