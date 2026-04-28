import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/remote/client";
import { sessionComments, users } from "@/lib/db/remote/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const comments = await db
      .select({
        id: sessionComments.id,
        content: sessionComments.content,
        createdAt: sessionComments.createdAt,
        user: {
          id: users.id,
          displayName: users.displayName,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(sessionComments)
      .innerJoin(users, eq(sessionComments.userId, users.id))
      .where(eq(sessionComments.sessionId, sessionId))
      .orderBy(asc(sessionComments.createdAt));

    // Headers hardcoded
    return NextResponse.json(comments, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { content } = await request.json();

    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, user.id))
      .limit(1);

    const [newComment] = await db
      .insert(sessionComments)
      .values({
        sessionId,
        userId: dbUser.id,
        content,
      })
      .returning();

    return NextResponse.json({
      id: newComment.id,
      content: newComment.content,
      createdAt: newComment.createdAt,
      user: {
        id: dbUser.id,
        displayName: dbUser.displayName,
        username: dbUser.username,
        avatarUrl: dbUser.avatarUrl,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}