import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints, users } from '@/lib/db/remote/schema'
import { eq, asc } from 'drizzle-orm'

// GET — Busca os dados da rota e waypoints para preencher o formulário
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // Busca a rota
    const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!route) return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 })

    // Busca os waypoints em ordem
    const routeWaypoints = await db
      .select()
      .from(waypoints)
      .where(eq(waypoints.routeId, id))
      .orderBy(asc(waypoints.order))

    return NextResponse.json({ ...route, waypoints: routeWaypoints })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT — Atualiza a rota e sincroniza os waypoints
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const { waypoints: newWaypoints, ...routeData } = body

    // 1. Atualiza os dados básicos da rota
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
        status: routeData.status || 'rascunho',
      })
      .where(eq(routes.id, id))

    // 2. Sincroniza Waypoints (Deleta antigos e insere novos para manter a ordem limpa)
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
    console.error("[API Admin Route PUT] Erro:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}