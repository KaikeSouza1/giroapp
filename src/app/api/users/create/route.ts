import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    await db.insert(users).values({
      supabaseAuthId: body.supabaseAuthId,
      email: body.email,
      displayName: body.displayName,
      username: body.username,
    }).onConflictDoNothing({ target: users.supabaseAuthId })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}