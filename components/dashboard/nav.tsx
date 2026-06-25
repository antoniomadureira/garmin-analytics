import { Activity, Heart, Moon, Footprints, MessageCircle, Trophy, LayoutDashboard } from "lucide-react";

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
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="text-sm font-semibold tracking-tight text-slate-100">
          freddy <span className="text-emerald-400">running</span>
        </div>
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
      </div>
    </header>
  );
}
