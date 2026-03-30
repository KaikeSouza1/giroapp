// src/app/api/users/update-avatar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { avatarUrl } = await request.json()

    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return NextResponse.json({ error: 'avatarUrl é obrigatório' }, { status: 400 })
    }

    await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.supabaseAuthId, user.id))

    return NextResponse.json({ success: true, avatarUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}