import { ReactNode } from "react";

export function StatTile({
  icon,
  label,
  value,
  unit,
  sublabel,
  accent = "#22d3ee",
}: {
  icon: ReactNode;
  label: string;
  value: string | number | null;
  unit?: string;
  sublabel: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold" style={{ color: value === null ? "#475569" : accent }}>
          {value ?? "—"}
        </span>
        {unit && value !== null && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      <div className="mt-1 text-xs text-slate-500">{sublabel}</div>
    </div>
  );
}
