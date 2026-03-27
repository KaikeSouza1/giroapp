import { NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { routes, organizations } from '@/lib/db/remote/schema'
import { eq, desc } from 'drizzle-orm'

// Necessário para output: export
export const dynamic = 'force-static'

export async function GET() {
  try {
    // Busca apenas rotas PUBLICADAS para o App Mobile e traz os dados da Organização
    const activeRoutes = await db.select({
      id: routes.id,
      name: routes.name,
      description: routes.description,
      difficulty: routes.difficulty,
      type: routes.type, // Tipo de Rota
      distanceKm: routes.distanceKm,
      estimatedMinutes: routes.estimatedMinutes,
      coverImageUrl: routes.coverImageUrl,
      status: routes.status,
      organizationName: organizations.name, // Nome da Organização
    })
    .from(routes)
    .leftJoin(organizations, eq(routes.organizationId, organizations.id))
    .where(eq(routes.status, 'published')) // Só mostra rota que não for rascunho
    .orderBy(desc(routes.createdAt))

    return NextResponse.json(activeRoutes)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}