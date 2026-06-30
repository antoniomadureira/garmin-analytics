"use client";

import { usePathname } from "next/navigation";
import { Activity, Heart, Moon, Footprints, MessageCircle, LayoutDashboard, ShoppingBag } from "lucide-react";

const NAV_ITEMS = [
  { label: "Painel", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Frequência Cardíaca", icon: Heart, href: "/dashboard/heart-rate" },
  { label: "Sono", icon: Moon, href: "/dashboard/sleep" },
  { label: "Passos", icon: Footprints, href: "/dashboard/steps" },
  { label: "Performance", icon: Activity, href: "/dashboard/running" },
  { label: "Calçado", icon: ShoppingBag, href: "/dashboard/gear" },
  { label: "Treinador IA", icon: MessageCircle, href: "/dashboard/coach" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold tracking-tight text-slate-100">
            Garmin <span style={{ color: "#007cc3" }}>Analytics</span>
          </div>

          {/* Desktop: barra horizontal com texto */}
          <nav className="hidden gap-1 md:flex">
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
