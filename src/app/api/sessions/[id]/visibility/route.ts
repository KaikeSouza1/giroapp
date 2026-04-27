import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/remote/client";
import { routeSessions, users } from "@/lib/db/remote/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.supabaseAuthId, authUser.id));
    if (!dbUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { isPublic } = await request.json();

    await db
      .update(routeSessions)
      .set({ isPublic })
      .where(
        and(
          eq(routeSessions.id, sessionId),
          eq(routeSessions.userId, dbUser.id)
        )
      );

    return NextResponse.json({ success: true, isPublic });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
