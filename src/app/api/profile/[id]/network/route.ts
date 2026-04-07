// src/app/api/profile/[id]/network/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { users, followers } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve o parâmetro de forma segura para o Next.js 15+
    const resolvedParams = await params
    const id = resolvedParams.id
    
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'followers'

    // Declarando o tipo para o TypeScript não reclamar no Build do Vercel
    let list: { id: string; displayName: string; username: string; avatarUrl: string | null }[] = []

    if (type === 'followers') {
      // Quem segue o usuário (o usuário é o alvo/followingId)
      list = await db.select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl
      })
      .from(followers)
      .innerJoin(users, eq(followers.followerId, users.id))
      .where(eq(followers.followingId, id))

    } else {
      // Quem o usuário segue (o usuário é o followerId)
      list = await db.select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl
      })
      .from(followers)
      .innerJoin(users, eq(followers.followingId, users.id))
      .where(eq(followers.followerId, id))
    }

    return NextResponse.json(list)
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao buscar rede' }, { status: 500 })
  }
}