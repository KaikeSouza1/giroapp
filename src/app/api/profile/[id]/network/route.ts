
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { users, followers } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    const resolvedParams = await params
    const id = resolvedParams.id
    
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'followers'

    
    let list: { id: string; displayName: string; username: string; avatarUrl: string | null }[] = []

    if (type === 'followers') {
      
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