import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/remote/client'
import { users } from '@/lib/db/remote/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { supabaseAuthId, selfiePath } = await request.json()
    await db.update(users)
      .set({ referenceSelfiePath: selfiePath, isSelfieCaptured: true })
      .where(eq(users.supabaseAuthId, supabaseAuthId))
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}