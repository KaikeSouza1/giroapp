// src/app/api/users/search/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { ilike, or, eq, not } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Pega o termo de busca da URL (ex: /api/users/search?q=kaike)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json([])
    }

    // Buscar utilizadores onde o nome ou username contenha a query
    // e EXCLUIR o próprio utilizador logado da lista de resultados
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

    // Filtra no Javascript para remover o próprio usuário (caso o Drizzle não pegue bem o authUser.id)
    // O ideal seria fazer no SQL com and(..., not(eq(users.supabaseAuthId, authUser.id))),
    // mas precisamos do ID interno do Postgres para isso.
    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.supabaseAuthId, authUser.id))
    
    const filteredUsers = me ? foundUsers.filter(u => u.id !== me.id) : foundUsers

    return NextResponse.json(filteredUsers)
  } catch (err: any) {
    console.error("[API /users/search] Erro:", err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}