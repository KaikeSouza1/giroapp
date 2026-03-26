import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints } from '@/lib/db/remote/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [route] = await db.select().from(routes)
      .where(eq(routes.id, params.id)).limit(1)

    if (!route) return NextResponse.json(null, { status: 404 })

    const wps = await db.select().from(waypoints)
      .where(eq(waypoints.routeId, params.id))
      .orderBy(asc(waypoints.order))

    return NextResponse.json({ ...route, waypoints: wps })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}