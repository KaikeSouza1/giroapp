import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { routes, users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  // 1. Atualizamos a tipagem para indicar que params é uma Promise
  context: { params: Promise<{ id: string }> } 
) {
  try {
    // 2. Aguardamos a resolução dos parâmetros
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
      // 3. Usamos a variável resolvida aqui
      .where(eq(routes.id, routeId)) 

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}