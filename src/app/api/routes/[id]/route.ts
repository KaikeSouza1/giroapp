// src/app/api/routes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints, organizations } from '@/lib/db/remote/schema'
import { eq, asc } from 'drizzle-orm'

// 👇 ADICIONE ESTAS DUAS LINHAS PARA CORRIGIR O ERRO DE BUILD 👇
export const dynamic = 'force-static'
export function generateStaticParams() {
  return [] 
}
// 👆 -------------------------------------------------------- 👆

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // No Next.js 15, os parâmetros devem ser aguardados (await)
    const resolvedParams = await context.params
    const routeId = resolvedParams.id

    const [route] = await db.select({
      id: routes.id,
      name: routes.name,
      description: routes.description,
      difficulty: routes.difficulty,
      type: routes.type,
      distanceKm: routes.distanceKm,
      estimatedMinutes: routes.estimatedMinutes,
      coverImageUrl: routes.coverImageUrl,
      status: routes.status,
      organizationName: organizations.name,
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    .where(eq(routes.id, routeId))
    .limit(1)

    if (!route) return NextResponse.json(null, { status: 404 })

    const wps = await db.select().from(waypoints)
      .where(eq(waypoints.routeId, routeId))
      .orderBy(asc(waypoints.order))

    return NextResponse.json({ ...route, waypoints: wps })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}