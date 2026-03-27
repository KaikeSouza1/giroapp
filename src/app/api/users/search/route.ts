import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { ilike, or, eq } from 'drizzle-orm'

// 👇 NECESSÁRIO PARA O BUILD ESTÁTICO
export const dynamic = 'force-static'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json([])
    }

    const foundUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        or(
          ilike(users.displayName, `%${query}%`),
          ilike(users.username, `%${query}%`)
        )
      )
      .limit(10)

    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))
    const filteredUsers = me ? foundUsers.filter(u => u.id !== me.id) : foundUsers

    return NextResponse.json(filteredUsers)
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}