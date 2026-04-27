"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function OfflineSyncWorker() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const interval = setInterval(() => {
      checkAndSync();
    }, 10000);

    checkAndSync();

    return () => clearInterval(interval);
  }, []);

  async function checkAndSync() {
    if (isSyncing) return;

    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      if (!status.connected) return;

      const pendingRaw = localStorage.getItem("giro_pending_routes");
      if (!pendingRaw) return;

      const pendingRoutes = JSON.parse(pendingRaw);
      if (pendingRoutes.length === 0) return;

      setIsSyncing(true);
      setSyncStatus("syncing");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setIsSyncing(false);
        return;
      }

      const routesToKeep = [];

      for (const route of pendingRoutes) {
        try {
          const finalCheckins = [];

          for (const c of route.checkins) {
            const resBlob = await fetch(c.photoUrl);
            const blob = await resBlob.blob();
            const filePath = `checkins/${session.user.id}/${
              c.waypointId
            }-${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
              .from("giro-app")
              .upload(filePath, blob, { contentType: "image/jpeg" });

            if (uploadError) throw new Error(uploadError.message);

            const {
              data: { publicUrl },
            } = supabase.storage.from("giro-app").getPublicUrl(filePath);

            finalCheckins.push({
              waypointId: c.waypointId,
              photoUrl: publicUrl,
              lat: c.lat,
              lng: c.lng,
              distance: c.distance,
            });
          }

          const res = await fetch("/api/sync/complete-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              routeId: route.routeId,
              distanceKm: route.distanceKm,
              elapsedSecs: route.elapsedSecs,
              checkins: finalCheckins,
            }),
          });

          if (!res.ok) throw new Error("Erro na API");
        } catch (err) {
          console.error("Falha ao sincronizar rota:", err);
          routesToKeep.push(route);
        }
      }

      localStorage.setItem("giro_pending_routes", JSON.stringify(routesToKeep));

      if (routesToKeep.length < pendingRoutes.length) {
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 4000);
      }
    } catch (err) {
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }

  if (syncStatus === "idle") return null;

  return (
    <div className="fixed top-safe mt-4 left-1/2 -translate-x-1/2 z-[100] transition-all">
      <div className="bg-white rounded-full shadow-xl border border-gray-100 px-4 py-2 flex items-center gap-3">
        {syncStatus === "syncing" && (
          <>
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-gray-700">
              Sincronizando trilha offline...
            </p>
          </>
        )}
        {syncStatus === "success" && (
          <>
            <span className="text-green-500 text-sm">✅</span>
            <p className="text-xs font-bold text-green-700">
              Trilha salva! Insígnia liberada.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
