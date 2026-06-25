import { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: "emerald" | "amber" | "red" | "cyan" | "none";
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-lg backdrop-blur-sm",
        "transition-colors hover:border-slate-700",
        glow === "emerald" && "shadow-emerald-950/40",
        glow === "amber" && "shadow-amber-950/40",
        glow === "red" && "shadow-red-950/40",
        glow === "cyan" && "shadow-cyan-950/40",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-400">
      {icon}
      {children}
    </div>
  );
}
