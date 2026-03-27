import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

// 👇 NECESSÁRIO PARA O BUILD ESTÁTICO
export const dynamic = 'force-static'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user) {
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