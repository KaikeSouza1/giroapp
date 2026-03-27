// src/app/api/admin/routes/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

// 👇 CONFIGURAÇÃO OBRIGATÓRIA PARA BUILD ESTÁTICO (CAPACITOR)
export const dynamic = 'force-static'

export function generateStaticParams() {
  return [] // Retorna vazio para o build não tentar pré-gerar IDs
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // Padrão assíncrono do Next 15
) {
  try {
    // No Next 15, o params deve ser aguardado
    const resolvedParams = await context.params
    const routeId = resolvedParams.id

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser] = await db.select().from(users)
      .where(eq(users.supabaseAuthId, user.id)).limit(1)
    
    if (!dbUser?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { status } = await request.json()

    await db.update(routes)
      .set({ status, updatedAt: new Date() })
      .where(eq(routes.id, routeId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[API Admin Route Status] Erro:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}