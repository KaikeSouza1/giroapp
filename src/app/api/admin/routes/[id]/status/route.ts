// src/app/api/admin/routes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints, routeSessions } from '@/lib/db/remote/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!route) return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 })

    const routeWaypoints = await db
      .select()
      .from(waypoints)
      .where(eq(waypoints.routeId, id))
      .orderBy(asc(waypoints.order))

    return NextResponse.json({ ...route, waypoints: routeWaypoints })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id

    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { waypoints: newWaypoints, ...routeData } = body

    await db.update(routes)
      .set({
        name: routeData.name,
        description: routeData.description || null,
        coverImageUrl: routeData.coverImageUrl || null,
        difficulty: routeData.difficulty,
        type: routeData.type,
        distanceKm: routeData.distanceKm ? routeData.distanceKm.toString() : null,
        estimatedMinutes: routeData.estimatedMinutes ? parseInt(routeData.estimatedMinutes) : null,
        organizationId: routeData.organizationId || null,
        status: routeData.status || 'publicado', // 🔥 Corrigido aqui
      })
      .where(eq(routes.id, id))

    await db.delete(waypoints).where(eq(waypoints.routeId, id))

    if (newWaypoints && newWaypoints.length > 0) {
      await db.insert(waypoints).values(
        newWaypoints.map((wp: any, i: number) => ({
          routeId: id,
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

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao atualizar rota' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id

    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const existingSessions = await db.select().from(routeSessions).where(eq(routeSessions.routeId, id)).limit(1)
    
    if (existingSessions.length > 0) {
      return NextResponse.json({ 
        error: 'Não é possível excluir esta rota pois já existem aventureiros que a completaram ou iniciaram. Por favor, mude o status para "Arquivado".' 
      }, { status: 400 })
    }

    await db.delete(waypoints).where(eq(waypoints.routeId, id))
    await db.delete(routes).where(eq(routes.id, id))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao excluir a rota' }, { status: 500 })
  }
}