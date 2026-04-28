"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NextImage from "next/image";
import { createBrowserClient } from "@supabase/ssr";

const navItems = [
  {
    href: "/dashboard/routes",
    label: "Rotas",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-60 min-h-screen flex flex-col border-r border-gray-100 bg-white">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-100">
        <NextImage
          src="/logoletra.png"
          alt="GIRO"
          width={80}
          height={32}
          priority
        />
        <p className="text-xs text-gray-400 mt-1 font-medium">Painel Admin</p>
      </div>

      {/* Menu Principal */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: active ? "#FFF0EB" : "transparent",
                color: active ? "#E05300" : "#888",
              }}
            >
              <span style={{ color: active ? "#E05300" : "#BBB" }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer do Menu */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all w-full"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair
        </button>
      </div>
    </aside>
  );
}