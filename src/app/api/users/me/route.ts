import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/remote/client";
import {
  users,
  routeSessions,
  userBadges,
  checkins,
} from "@/lib/db/remote/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json(
        { error: "Utilizador não encontrado" },
        { status: 404 }
      );
    }

    const [completedRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(routeSessions)
      .where(
        and(
          eq(routeSessions.userId, dbUser.id),
          eq(routeSessions.status, "concluido")
        )
      );

    const [badgesRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userBadges)
      .where(eq(userBadges.userId, dbUser.id));

    const [photosRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(checkins)
      .where(eq(checkins.userId, dbUser.id));

    return NextResponse.json({
      ...dbUser,
      routesCompleted: Number(completedRes?.count || 0),
      badgesCount: Number(badgesRes?.count || 0),
      photosCount: Number(photosRes?.count || 0),
    });
  } catch (err: any) {
    console.error("[API /users/me] Erro:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
