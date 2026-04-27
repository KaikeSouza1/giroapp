"use client";

import Link from "next/link";

type Tab = "home" | "feed" | "profile";

export default function TabBar({ active }: { active: Tab }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-6">
        {}
        <Link href="/home" className="flex flex-col items-center gap-1">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={active === "home" ? "#E05300" : "none"}
            stroke={active === "home" ? "#E05300" : "#BBB"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span
            className={`text-[10px] font-black uppercase tracking-tight ${
              active === "home" ? "text-orange-600" : "text-gray-400"
            }`}
          >
            Início
          </span>
        </Link>

        {}
        <Link href="/feed" className="flex flex-col items-center gap-1">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={active === "feed" ? "#E05300" : "none"}
            stroke={active === "feed" ? "#E05300" : "#BBB"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
          <span
            className={`text-[10px] font-black uppercase tracking-tight ${
              active === "feed" ? "text-orange-600" : "text-gray-400"
            }`}
          >
            Feed
          </span>
        </Link>

        {}
        <Link href="/profile" className="flex flex-col items-center gap-1">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={active === "profile" ? "#E05300" : "none"}
            stroke={active === "profile" ? "#E05300" : "#BBB"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span
            className={`text-[10px] font-black uppercase tracking-tight ${
              active === "profile" ? "text-orange-600" : "text-gray-400"
            }`}
          >
            Perfil
          </span>
        </Link>
      </div>
    </div>
  );
}
