import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/db/remote/client";
import { users, followers } from "@/lib/db/remote/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
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
      targetUserIds = [...followingList.map((f) => f.followingId), dbUser.id];
    }

    if (targetUserIds.length === 0) return NextResponse.json([]);

    // Formata a lista de IDs para rodar seguro no SQL raw
    const userIdsList = sql.join(
      targetUserIds.map((id) => sql`${id}`),
      sql`, `
    );

    // ── QUERY 100% DIRETA NO POSTGRES ──
    const rawQuery = sql`
      SELECT
        rs.id AS "sessionId",
        rs.user_id AS "userId",
        rs.route_id AS "routeId",
        rs.completed_at AS "completedAt",
        rs.total_distance_km AS "distanceKm",
        rs.activity_type AS "activityType",
        rs.duration_seconds AS "durationSeconds",
        rs.average_pace AS "averagePace",
        rs.social_image_url AS "socialImageUrl",
        rs.is_public AS "isPublic",
        COALESCE((SELECT COUNT(*)::int FROM session_likes sl WHERE sl.session_id = rs.id), 0) AS "likesCount",
        COALESCE((SELECT COUNT(*)::int FROM session_comments sc WHERE sc.session_id = rs.id), 0) AS "commentsCount",
        EXISTS(SELECT 1 FROM session_likes sl2 WHERE sl2.session_id = rs.id AND sl2.user_id = ${dbUser.id}) AS "hasLiked",
        u.display_name AS "userName",
        u.username AS "userUsername",
        u.avatar_url AS "userAvatarUrl",
        r.name AS "routeName",
        r.cover_image_url AS "coverImageUrl",
        COALESCE(r.type, rs.activity_type, 'outros') AS "type",
        o.name AS "organizationName",
        COALESCE((SELECT COUNT(*)::int FROM waypoints w WHERE w.route_id = rs.route_id), 0) AS "waypointCount"
      FROM route_sessions rs
      JOIN users u ON u.id = rs.user_id
      LEFT JOIN routes r ON r.id = rs.route_id
      LEFT JOIN organizations o ON o.id = r.organization_id
      WHERE (rs.user_id IN (${userIdsList}) OR rs.is_public = true OR rs.user_id = ${dbUser.id})
      ORDER BY rs.completed_at DESC
      LIMIT 30;
    `;

  const rows = await db.execute(rawQuery);

    const feed = rows.map((row: any) => ({
      id: row.sessionId,
      userId: row.userId,
      userName: row.userName || "Usuário",
      userUsername: row.userUsername || "",
      userAvatarUrl: row.userAvatarUrl || null,
      routeName: row.routeName || null,
      routeId: row.routeId,
      coverImageUrl: row.coverImageUrl || null,
      type: row.type,
      organizationName: row.organizationName || null,
      completedAt: row.completedAt
        ? new Date(row.completedAt).toISOString()
        : new Date().toISOString(),
      waypointCount: Number(row.waypointCount) || 0,
      distanceKm: row.distanceKm,
      socialImageUrl: row.socialImageUrl,
      averagePace: row.averagePace,
      durationSeconds: row.durationSeconds,
      activityType: row.activityType,
      isPublic: row.isPublic,
      likesCount: Number(row.likesCount) || 0,
      commentsCount: Number(row.commentsCount) || 0,
      hasLiked: Boolean(row.hasLiked),
    }));

    // Retorna com Headers brutais contra o cache do Next
    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err: any) {
    console.error("Erro no feed API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}