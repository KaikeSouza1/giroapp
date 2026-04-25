// src/app/api/routes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, users, waypoints, organizations } from '@/lib/db/remote/schema'
import { eq, desc, and } from 'drizzle-orm'

// GET — Lista as rotas para qualquer usuário logado
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // 1. Apenas checa se está autenticado no Supabase
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // 2. Busca as rotas incluindo os campos de imagem e descrição que faltavam
    const allRoutes = await db.select({
      id: routes.id,
      name: routes.name,
      description: routes.description, // Campo para o texto do card
      difficulty: routes.difficulty,
      status: routes.status,
      type: routes.type,
      distanceKm: routes.distanceKm,
      estimatedMinutes: routes.estimatedMinutes, // Campo para o tempo do card
      coverImageUrl: routes.coverImageUrl, // CAMPO ESSENCIAL PARA A FOTO APARECER
      createdAt: routes.createdAt,
      organizationName: organizations.name,
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    // Filtramos para mostrar apenas o que está 'publicado' para todos
    .where(eq(routes.status, 'publicado')) 
    .orderBy(desc(routes.createdAt))

    return NextResponse.json(allRoutes)
  } catch (err: any) {
    console.error("[API /routes] Erro no GET:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Cria nova rota (Apenas Admins ainda podem criar para segurança)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const [dbUser] = await db.select().from(users)
      .where(eq(users.supabaseAuthId, user.id)).limit(1)

    // Mantemos a trava apenas para a CRIAÇÃO de novas rotas
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