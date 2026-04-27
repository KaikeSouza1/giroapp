"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import TabBar from "@/components/mobile/TabBar";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Share } from "@capacitor/share";
import { uploadImageToBucket } from "@/lib/supabase/storage";

async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

function GiroBadgeSVG({ name }: { name: string }) {
  if (name === "Pioneiro")
    return (
      <svg width="60" height="60" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="url(#p1)"
          stroke="#fff"
          strokeWidth="3"
        />
        <path
          d="M50 25L58 43H78L62 55L68 75L50 63L32 75L38 55L22 43H42L50 25Z"
          fill="#fff"
        />
        <defs>
          <linearGradient id="p1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#CD7F32" />
            <stop offset="100%" stopColor="#8B4513" />
          </linearGradient>
        </defs>
      </svg>
    );
  if (name === "Explorador")
    return (
      <svg width="60" height="60" viewBox="0 0 100 100">
        <rect
          x="15"
          y="15"
          width="70"
          height="70"
          rx="15"
          fill="url(#p2)"
          stroke="#fff"
          strokeWidth="3"
        />
        <path
          d="M50 30V70M30 50H70"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="p2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C0C0C0" />
            <stop offset="100%" stopColor="#4F4F4F" />
          </linearGradient>
        </defs>
      </svg>
    );
  if (name === "Lenda")
    return (
      <svg width="60" height="60" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="url(#p3)"
          stroke="#fff"
          strokeWidth="3"
        />
        <text
          x="50"
          y="65"
          textAnchor="middle"
          fill="#fff"
          fontSize="40"
          fontWeight="900"
        >
          G
        </text>
        <defs>
          <linearGradient id="p3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#E05300" />
          </linearGradient>
        </defs>
      </svg>
    );
  return (
    <svg width="60" height="60" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="url(#p4)"
        stroke="#fff"
        strokeWidth="3"
      />
      <text
        x="50"
        y="65"
        textAnchor="middle"
        fill="#fff"
        fontSize="40"
        fontWeight="900"
      >
        G
      </text>
      <defs>
        <linearGradient id="p4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#830200" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type Badge = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  awardedAt: string;
};

type CompletedRoute = {
  id: string;
  routeName: string;
  routeType: string;
  completedAt: string;
  distanceKm: string | null;
  elapsedMinutes: number;
  isPublic: boolean;
  photos: string[];
};

type ProfileData = {
  id: string;
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  badges: Badge[];
  completedRoutes: CompletedRoute[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<"routes" | "badges">("routes");

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [routeToShare, setRouteToShare] = useState<CompletedRoute | null>(null);
  const [smsPhone, setSmsPhone] = useState("");
  const [isPreparingShare, setIsPreparingShare] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("/api/profile/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        setProfile(data);
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, supabase.auth]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function openPhotoViewer(photoUrl: string) {
    setSelectedPhoto(photoUrl);
    setIsPhotoViewerOpen(true);
  }

  function closePhotoViewer() {
    setIsPhotoViewerOpen(false);
    setTimeout(() => setSelectedPhoto(null), 300);
  }

  function openShareModal(route: CompletedRoute) {
    setRouteToShare(route);
    setSmsPhone("");
    setIsShareModalOpen(true);
  }

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // ── COMPARTILHAMENTO NATIVO (TEXTO SÉRIO + IMAGENS REAIS) ───────────
  async function handleNativeShare() {
    if (!routeToShare) return;
    setIsPreparingShare(true);

    try {
      const text = `REGISTRO DE ATIVIDADE\nRota: ${
        routeToShare.routeName
      }\nDistância: ${routeToShare.distanceKm || "--"} km\nTempo: ${formatTime(
        routeToShare.elapsedMinutes
      )}\n\nRastreamento via GIRO APP.`;

      const filesPromise = routeToShare.photos
        .slice(0, 3)
        .map((url) => urlToBase64(url));
      const base64Files = await Promise.all(filesPromise);

      setIsShareModalOpen(false);

      setTimeout(async () => {
        await Share.share({
          title: "Registro de Atividade GIRO",
          text: text,
          files: base64Files,
          dialogTitle: "Compartilhar",
        });
      }, 150);
    } catch (err) {
      console.error("Erro ao compartilhar:", err);
    } finally {
      setIsPreparingShare(false);
    }
  }

  function handleSmsShare() {
    if (!routeToShare || !smsPhone.trim()) return;

    const cleanPhone = smsPhone.replace(/\D/g, "");

    let paceString = "--";
    if (routeToShare.distanceKm) {
      const dist = parseFloat(routeToShare.distanceKm);
      if (dist > 0) {
        const pace = routeToShare.elapsedMinutes / dist;
        const paceMins = Math.floor(pace);
        const paceSecs = Math.round((pace - paceMins) * 60);
        paceString = `${paceMins}'${paceSecs.toString().padStart(2, "0")}" /km`;
      }
    }

    const text = `REGISTRO DE ATIVIDADE - GIRO\n\nRota: ${
      routeToShare.routeName
    }\nDistância: ${
      routeToShare.distanceKm || "--"
    } km\nTempo total: ${formatTime(
      routeToShare.elapsedMinutes
    )}\nRitmo Médio (Pace): ${paceString}\n\nApp: https://giroapp.vercel.app`;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? "&" : "?";

    const uri = `sms:${cleanPhone}${separator}body=${encodeURIComponent(text)}`;

    setIsShareModalOpen(false);

    setTimeout(() => {
      window.open(uri, "_system");
    }, 150);
  }

  async function toggleVisibility(sessionId: string, currentIsPublic: boolean) {
    const newStatus = !currentIsPublic;
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        completedRoutes: prev.completedRoutes.map((r) =>
          r.id === sessionId ? { ...r, isPublic: newStatus } : r
        ),
      };
    });
    try {
      await fetch(`/api/sessions/${sessionId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newStatus }),
      });
    } catch (e) {
      console.error("Erro ao alterar privacidade", e);
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          completedRoutes: prev.completedRoutes.map((r) =>
            r.id === sessionId ? { ...r, isPublic: currentIsPublic } : r
          ),
        };
      });
    }
  }

  async function takeProfilePicture(source: CameraSource) {
    setIsAvatarModalOpen(false);
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        width: 800,
        height: 800,
        resultType: CameraResultType.DataUrl,
        source: source,
      });

      if (!image.dataUrl || !profile) return;
      setIsUpdatingAvatar(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const file = dataUrlToFile(image.dataUrl, "profile.jpg");
      const publicUrl = await uploadImageToBucket(
        file,
        "giro-app",
        `avatars/${session.user.id}`
      );

      const dbRes = await fetch("/api/users/update-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseAuthId: session.user.id,
          avatarUrl: publicUrl,
        }),
      });

      if (!dbRes.ok) throw new Error("Erro ao salvar no banco de dados.");
      setProfile((prev) => (prev ? { ...prev, avatarUrl: publicUrl } : null));
    } catch (err: any) {
      if (err.message !== "User cancelled photos app") {
        alert("Erro ao trocar foto: " + err.message);
      }
    } finally {
      setIsUpdatingAvatar(false);
    }
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "caminhada":
        return { label: "Caminhada", color: "bg-orange-100 text-orange-800" };
      case "cicloturismo":
        return { label: "Ciclismo", color: "bg-red-100 text-red-800" };
      default:
        return { label: "Rota", color: "bg-gray-100 text-gray-800" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{
            border: "3px solid #F0F0F0",
            borderTop: "3px solid #E05300",
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-dm)] pb-24 relative">
      {}
      {isPhotoViewerOpen && selectedPhoto && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={closePhotoViewer}
        >
          <button
            className="absolute top-10 right-6 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-sm"
            onClick={closePhotoViewer}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={selectedPhoto}
            alt="Visualização"
            className="max-w-[90%] max-h-[85%] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}

      {}
      {isAvatarModalOpen && (
        <div
          className="fixed inset-0 z-[150] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setIsAvatarModalOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-6 pb-12 flex flex-col gap-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-black text-gray-900 mb-2 text-center">
              Atualizar Imagem
            </h3>
            <button
              onClick={() => takeProfilePicture(CameraSource.Camera)}
              className="w-full py-4 rounded-2xl text-white font-black text-base shadow-sm"
              style={{
                background: "linear-gradient(135deg, #830200, #E05300)",
              }}
            >
              Câmera
            </button>
            <button
              onClick={() => takeProfilePicture(CameraSource.Photos)}
              className="w-full py-4 rounded-2xl font-bold text-base border"
              style={{
                borderColor: "#EFEFEF",
                color: "#333",
                background: "#FFF",
              }}
            >
              Galeria
            </button>
            <button
              onClick={() => setIsAvatarModalOpen(false)}
              className="w-full py-3 mt-2 rounded-2xl font-bold text-sm text-gray-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {}
      {isShareModalOpen && routeToShare && (
        <div
          className="fixed inset-0 z-[150] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="bg-white rounded-t-[32px] p-6 pb-12 flex flex-col gap-5 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-1 flex-shrink-0" />
            <h3 className="text-xl font-black text-gray-900 flex-shrink-0 text-center">
              Compartilhar Desempenho
            </h3>

            {}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex-shrink-0">
              <label className="text-[10px] font-black text-orange-800 uppercase tracking-widest mb-2 block">
                Relatório via SMS
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="DDD + Telefone"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  className="flex-1 px-4 py-3.5 rounded-xl text-sm font-bold text-gray-800 bg-white border border-gray-200 outline-none focus:border-orange-500 transition-colors"
                />
                <button
                  onClick={handleSmsShare}
                  disabled={!smsPhone.trim()}
                  className="px-6 py-3.5 rounded-xl text-white font-black text-sm transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #830200, #E05300)",
                  }}
                >
                  Enviar
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 my-1 flex-shrink-0">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Geral
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {}
            <button
              onClick={handleNativeShare}
              disabled={isPreparingShare}
              className="w-full py-4 flex flex-shrink-0 items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50 text-white shadow-md"
              style={{
                background: "linear-gradient(135deg, #830200, #E05300)",
              }}
            >
              {isPreparingShare ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Instagram, WhatsApp e Redes"
              )}
            </button>
          </div>
        </div>
      )}

      {}
      <div
        className="relative overflow-hidden px-6 pt-12 pb-16"
        style={{
          background:
            "linear-gradient(160deg, #830200 0%, #E05300 55%, #FF8C00 100%)",
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.1]"
          viewBox="0 0 375 200"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M0,100 Q93,60 187,100 Q280,140 375,100"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
          />
        </svg>

        <div className="relative z-10 flex items-center justify-between mb-6">
          <NextImage
            src="/logogiroprincipal.png"
            alt="GIRO"
            width={80}
            height={32}
            priority
            className="drop-shadow-lg"
          />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
          >
            Sair
          </button>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <button
            onClick={() => setIsAvatarModalOpen(true)}
            className="relative rounded-2xl shadow-lg active:scale-95 group"
          >
            {isUpdatingAvatar && (
              <div className="absolute inset-0 bg-black/50 rounded-[28px] flex items-center justify-center z-20">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md z-10 text-orange-600">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <img
              src={profile?.avatarUrl || ""}
              alt="Avatar"
              className="w-20 h-20 rounded-[28px] object-cover border-2 border-white/40 shadow-lg"
            />
          </button>
          <div>
            <h1 className="text-white font-black text-2xl leading-tight">
              {profile?.displayName}
            </h1>
            <p className="text-white/80 text-sm font-medium">
              @{profile?.username}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-2 mt-6">
          <div
            className="flex-1 text-center rounded-2xl py-3 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <p className="text-white font-black text-xl leading-none">
              {profile?.completedRoutes?.length ?? 0}
            </p>
            <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider">
              Rotas
            </p>
          </div>
          <div
            className="flex-1 text-center rounded-2xl py-3 backdrop-blur-sm"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <p className="text-white font-black text-xl leading-none">
              {profile?.badges?.length ?? 0}
            </p>
            <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider">
              Insígnias
            </p>
          </div>
          {profile?.id && (
            <>
              <Link
                href={`/profile/${profile.id}/network?tab=followers`}
                className="flex-1 text-center rounded-2xl py-3 backdrop-blur-sm active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <p className="text-white font-black text-xl leading-none">
                  {profile.followersCount}
                </p>
                <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider">
                  Seguidores
                </p>
              </Link>
              <Link
                href={`/profile/${profile.id}/network?tab=following`}
                className="flex-1 text-center rounded-2xl py-3 backdrop-blur-sm active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <p className="text-white font-black text-xl leading-none">
                  {profile.followingCount}
                </p>
                <p className="text-white/70 text-[9px] font-bold uppercase mt-1 tracking-wider">
                  A seguir
                </p>
              </Link>
            </>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50 rounded-t-[32px]" />
      </div>

      {/* Tabs */}
      <div className="flex mx-5 mt-2 mb-4 gap-2">
        {(["routes", "badges"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm ${
              activeTab === tab
                ? "text-white border-transparent"
                : "bg-white text-gray-400 border border-gray-100"
            }`}
            style={{
              background:
                activeTab === tab
                  ? "linear-gradient(135deg, #830200, #E05300)"
                  : undefined,
            }}
          >
            {tab === "routes" ? "Atividades" : "Insígnias"}
          </button>
        ))}
      </div>

      <div className="px-5">
        {activeTab === "routes" && (
          <div className="flex flex-col gap-4">
            {profile?.completedRoutes.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">
                  Nenhuma atividade concluída
                </p>
              </div>
            ) : (
              profile?.completedRoutes.map((route) => {
                const info = getTypeInfo(route.routeType);
                return (
                  <div
                    key={route.id}
                    className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-gray-100 relative"
                  >
                    {!route.isPublic && (
                      <div className="absolute top-4 right-4 z-10 bg-gray-900/80 backdrop-blur-sm px-2 py-1 rounded-md">
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">
                          Oculto
                        </span>
                      </div>
                    )}
                    <div className="px-5 pt-5 pb-3 border-b border-gray-50">
                      <div
                        className={`inline-block px-2 py-1 rounded-md mb-2 ${info.color}`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-wider">
                          {info.label}
                        </span>
                      </div>
                      <h3 className="font-black text-gray-900 text-lg leading-tight">
                        {route.routeName}
                      </h3>
                      <p className="text-gray-400 text-[11px] font-bold mt-1 tracking-wide">
                        {new Date(route.completedAt).toLocaleDateString(
                          "pt-BR"
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-gray-50 bg-gray-50/30 py-4 border-b border-gray-50">
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Tempo Total
                        </p>
                        <p className="font-black text-gray-800 text-lg">
                          {formatTime(route.elapsedMinutes)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Distância
                        </p>
                        <p className="font-black text-gray-800 text-lg">
                          {route.distanceKm} km
                        </p>
                      </div>
                    </div>

                    <div className="px-5 py-4 border-b border-gray-50">
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {route.photos.map((p, i) => (
                          <button
                            key={i}
                            onClick={() => openPhotoViewer(p)}
                            className="relative w-20 h-20 flex-shrink-0 active:scale-95"
                          >
                            <img
                              src={p}
                              className="w-full h-full rounded-2xl object-cover border border-gray-100"
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-5 py-4 flex gap-3">
                      <button
                        onClick={() => openShareModal(route)}
                        className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 text-white shadow-md"
                        style={{
                          background:
                            "linear-gradient(135deg, #830200, #E05300)",
                        }}
                      >
                        Compartilhar
                      </button>
                      <button
                        onClick={() =>
                          toggleVisibility(route.id, route.isPublic)
                        }
                        className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                          route.isPublic
                            ? "bg-gray-50 text-gray-600 border-gray-200"
                            : "bg-gray-100 text-gray-400 border-gray-300"
                        }`}
                      >
                        {route.isPublic ? "Público" : "Oculto"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "badges" && (
          <div className="grid grid-cols-2 gap-4 pb-8">
            {profile?.badges.length === 0 ? (
              <div className="col-span-2 py-12 text-center">
                <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">
                  Sem insígnias ainda
                </p>
              </div>
            ) : (
              profile?.badges.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-3xl p-5 text-center shadow-sm border border-gray-100 flex flex-col items-center"
                >
                  <div className="mb-3">
                    <GiroBadgeSVG name={b.name} />
                  </div>
                  <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
                    {b.name}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1.5 font-bold leading-tight">
                    {b.description}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <TabBar active="profile" />
    </div>
  );
}
