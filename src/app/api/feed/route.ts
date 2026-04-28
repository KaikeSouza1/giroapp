import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/remote/client";
import {
  routeSessions,
  routes,
  users,
  followers,
  waypoints,
  organizations,
} from "@/lib/db/remote/schema";
import { eq, inArray, desc, and, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json([], { status: 401 });

    const supabase = await createClient();
    const { data } = await supabase.auth.getUser(token);

    if (!data.user) return NextResponse.json([], { status: 401 });

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseAuthId, data.user.id))
      .limit(1);
    if (!dbUser) return NextResponse.json([]);

    const url = new URL(request.url);
    const profileUserId = url.searchParams.get("userId");

    let targetUserIds: string[] = [];

    if (profileUserId) {
      targetUserIds = [profileUserId];
    } else {
      const followingList = await db
        .select({ followingId: followers.followingId })
        .from(followers)
        .where(eq(followers.followerId, dbUser.id));
      const followingIds = followingList.map((f) => f.followingId);
      targetUserIds = [...followingIds, dbUser.id];
    }

    if (targetUserIds.length === 0) return NextResponse.json([]);

    const sessions = await db
      .select({
        sessionId: routeSessions.id,
        userId: routeSessions.userId,
        routeId: routeSessions.routeId,
        completedAt: routeSessions.completedAt,
        totalDistanceKm: routeSessions.totalDistanceKm,
        activityType: routeSessions.activityType,
        averagePace: routeSessions.averagePace,
        durationSeconds: routeSessions.durationSeconds,
        socialImageUrl: routeSessions.socialImageUrl,
        isPublic: routeSessions.isPublic,

        likesCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM session_likes WHERE session_id = ${routeSessions.id}), 0) AS INTEGER)`,
        commentsCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM session_comments WHERE session_id = ${routeSessions.id}), 0) AS INTEGER)`,
        hasLiked: sql<boolean>`CASE WHEN EXISTS(SELECT 1 FROM session_likes WHERE session_id = ${routeSessions.id} AND user_id = ${dbUser.id}) THEN true ELSE false END`,
      })
      .from(routeSessions)
      .where(
        and(
          inArray(routeSessions.userId, targetUserIds),
          or(
            eq(routeSessions.isPublic, true),
            eq(routeSessions.userId, dbUser.id)
          )
        )
      )
      .orderBy(desc(routeSessions.completedAt))
      .limit(30);

    if (sessions.length === 0) return NextResponse.json([]);

    const routeIds = [
      ...new Set(sessions.map((s) => s.routeId).filter(Boolean)),
    ] as string[];
    const userIds = [...new Set(sessions.map((s) => s.userId))];

    let routeList: any[] = [];
    let waypointCounts: any[] = [];

    if (routeIds.length > 0) {
      routeList = await db
        .select({
          id: routes.id,
          name: routes.name,
          coverImageUrl: routes.coverImageUrl,
          type: routes.type,
          organizationName: organizations.name,
        })
        .from(routes)
        .leftJoin(organizations, eq(routes.organizationId, organizations.id))
        .where(inArray(routes.id, routeIds));

      waypointCounts = await db
        .select({ routeId: waypoints.routeId })
        .from(waypoints)
        .where(inArray(waypoints.routeId, routeIds));
    }

    const userList = await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));

    const routeMap = Object.fromEntries(routeList.map((r) => [r.id, r]));
    const userMap = Object.fromEntries(userList.map((u) => [u.id, u]));

    const wpCountMap: Record<string, number> = {};
    waypointCounts.forEach((w) => {
      wpCountMap[w.routeId] = (wpCountMap[w.routeId] ?? 0) + 1;
    });

    const feed = sessions.map((s) => {
      const r = s.routeId ? routeMap[s.routeId] : null;

      return {
        id: s.sessionId,
        userId: s.userId,
        userName: userMap[s.userId]?.displayName ?? "Usuário",
        userUsername: userMap[s.userId]?.username ?? "",
        userAvatarUrl: userMap[s.userId]?.avatarUrl ?? null,

        routeName: r?.name ?? null,
        routeId: s.routeId,
        coverImageUrl: r?.coverImageUrl ?? null,
        type: r?.type ?? s.activityType ?? "outros",
        organizationName: r?.organizationName ?? null,
        completedAt: s.completedAt?.toISOString() ?? new Date().toISOString(),
        badgeName: null,
        badgeImageUrl: null,
        waypointCount: s.routeId ? wpCountMap[s.routeId] ?? 0 : 0,
        distanceKm: s.totalDistanceKm,

        socialImageUrl: s.socialImageUrl,
        averagePace: s.averagePace,
        durationSeconds: s.durationSeconds,
        activityType: s.activityType,
        isPublic: s.isPublic,

        likesCount: Number(s.likesCount || 0),
        commentsCount: Number(s.commentsCount || 0),
        hasLiked: s.hasLiked === true || String(s.hasLiked) === "true",
      };
    });

    return NextResponse.json(feed);
  } catch (err: any) {
    console.error("Erro no feed API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}