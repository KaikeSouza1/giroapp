import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 👇 Extrai o token enviado pelo Capacitor via Header (CORREÇÃO AQUI)
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    // Valida com token (Mobile) ou cookies (Web)
    const { data: { user }, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json(null, { status: 401 })
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1)

    return NextResponse.json(dbUser ?? null)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}