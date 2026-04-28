import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/remote/client";
import { sessionLikes, users } from "@/lib/db/remote/schema";
import { eq, and, count } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // 1. Resolvemos os params direto da desestruturação para evitar erro do TS
    const { sessionId } = await params;

    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Erro de autenticação no like:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [existingLike] = await db
      .select()
      .from(sessionLikes)
      .where(
        and(
          eq(sessionLikes.sessionId, sessionId),
          eq(sessionLikes.userId, dbUser.id)
        )
      );

    let liked: boolean;

    if (existingLike) {
      await db.delete(sessionLikes).where(eq(sessionLikes.id, existingLike.id));
      liked = false;
    } else {
      await db.insert(sessionLikes).values({ sessionId, userId: dbUser.id });
      liked = true;
    }

    // 2. Passamos o sessionLikes.id no count para blindar contra erros de lint do Drizzle
    const likesResult = await db
      .select({ value: count(sessionLikes.id) })
      .from(sessionLikes)
      .where(eq(sessionLikes.sessionId, sessionId));
      
    const totalLikes = Number(likesResult[0]?.value || 0);

    return NextResponse.json({ liked, likesCount: totalLikes });
  } catch (err: any) {
    console.error("Erro na rota de like:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}