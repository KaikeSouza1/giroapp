// src/app/api/admin/routes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, waypoints, users } from '@/lib/db/remote/schema'
import { eq, asc } from 'drizzle-orm'

// GET — Busca os dados da rota e waypoints para preencher o formulário de edição
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

    // 1. Busca a rota principal pelo ID
    const [route] = await db.select().from(routes).where(eq(routes.id, id)).limit(1)
    if (!route) return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 })

    // 2. Busca os waypoints associados em ordem crescente
    const routeWaypoints = await db
      .select()
      .from(waypoints)
      .where(eq(waypoints.routeId, id))
      .orderBy(asc(waypoints.order))

    return NextResponse.json({ ...route, waypoints: routeWaypoints })
  } catch (err: any) {
    console.error("[API Admin Route GET] Erro:", err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT — Atualiza a rota e sincroniza a nova lista de waypoints
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

    // 2. Sincroniza Waypoints: Apaga os antigos e insere a nova sequência para garantir ordem limpa
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
    return NextResponse.json({ error: 'Erro ao atualizar rota' }, { status: 500 })
  }
}