"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, Heart, Moon, Footprints, MessageCircle, LayoutDashboard, ShoppingBag, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { label: "Painel", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Frequência Cardíaca", icon: Heart, href: "/dashboard/heart-rate" },
  { label: "Sono", icon: Moon, href: "/dashboard/sleep" },
  { label: "Passos", icon: Footprints, href: "/dashboard/steps" },
  { label: "Performance", icon: Activity, href: "/dashboard/running" },
  { label: "Equipamento", icon: ShoppingBag, href: "/dashboard/gear" },
  { label: "Consultor de Treino", icon: MessageCircle, href: "/dashboard/coach" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    if (!confirm("Terminar sessão?")) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold tracking-tight text-slate-100">
            Garmin <span style={{ color: "#007cc3" }}>Analytics</span>
          </div>

          {/* Desktop: barra horizontal com texto */}
          <div className="hidden items-center gap-1 md:flex">
            <nav className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition hover:bg-slate-800/60 hover:text-slate-100 ${
                    pathname === item.href ? "text-slate-100" : "text-slate-400"
                  }`}
                >
                  <item.icon size={14} />
                  {item.label}
                </a>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="ml-2 flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 transition hover:border-red-900 hover:bg-red-950/30 hover:text-red-400 disabled:opacity-50"
              title="Terminar sessão"
            >
              <LogOut size={14} />
            </button>
          </div>

          {/* Mobile: botão de logout solto no header, já que a barra de baixo está cheia */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg p-2 text-slate-500 hover:text-red-400 md:hidden"
            title="Terminar sessão"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Mobile: barra fixa no fundo, só ícones */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-slate-800 bg-slate-950/95 px-1 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${active ? "text-emerald-400" : "text-slate-500"}`}
            >
              <item.icon size={18} />
            </a>
          );
        })}
      </nav>

      {/* [Certo] padding-bottom no body em mobile, para a barra fixa não cobrir o último conteúdo da página */}
      <style>{`
        @media (max-width: 767px) {
          body { padding-bottom: 3.5rem; }
        }
      `}</style>
    </>
  );
}
