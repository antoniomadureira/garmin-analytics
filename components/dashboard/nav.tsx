"use client";

import { useState } from "react";
import { Activity, Heart, Moon, Footprints, MessageCircle, Trophy, LayoutDashboard, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "Painel", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Frequência Cardíaca", icon: Heart, href: "/dashboard/heart-rate" },
  { label: "Sono", icon: Moon, href: "/dashboard/sleep" },
  { label: "Passos", icon: Footprints, href: "/dashboard/steps" },
  { label: "Corrida", icon: Activity, href: "/dashboard/running" },
  { label: "Treinador IA", icon: MessageCircle, href: "/dashboard/coach" },
  { label: "Recordes", icon: Trophy, href: "/dashboard/records" },
];

export function DashboardNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="text-sm font-semibold tracking-tight text-slate-100">
          Garmin <span style={{ color: "#007cc3" }}>Analytics</span>
        </div>

        {/* Desktop: barra horizontal */}
        <nav className="hidden gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-100"
            >
              <item.icon size={14} />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Mobile: botão hambúrguer */}
        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800/60 md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile: painel expansível */}
      {open && (
        <nav className="border-t border-slate-800 px-4 py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800/60"
            >
              <item.icon size={16} />
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
