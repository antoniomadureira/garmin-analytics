import { DashboardNav } from "@/components/dashboard/nav";
import type { LucideIcon } from "lucide-react";

export function PageLoader({
  icon: Icon,
  label,
  color,
  animation = "pulse",
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  animation?: "pulse" | "spin" | "bounce";
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "60vh" }}>
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-900"
          style={{
            animation:
              animation === "spin"
                ? "page-loader-spin 1.2s linear infinite"
                : animation === "bounce"
                  ? "page-loader-bounce 0.7s ease-in-out infinite"
                  : "page-loader-pulse 1s ease-in-out infinite",
          }}
        >
          <Icon size={28} style={{ color }} />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
        <style>{`
          @keyframes page-loader-pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.1); opacity: 1; }
          }
          @keyframes page-loader-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes page-loader-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
      </main>
    </div>
  );
}
