import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log("1. [API /me] Usuário do Supabase Auth ID:", user?.id, " | Erro:", authError?.message)

    if (!user) {
      console.log("1.1 [API /me] Nenhum usuário logado. Provavelmente os cookies não foram lidos corretamente.")
      return NextResponse.json(null, { status: 401 })
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1)

    console.log("2. [API /me] Usuário retornado do Drizzle (tabela users):", dbUser)

    return NextResponse.json(dbUser ?? null)
  } catch (err: any) {
    console.error("3. [API /me] Erro fatal no servidor:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}