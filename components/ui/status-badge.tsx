import clsx from "clsx";

const STYLES: Record<string, string> = {
  emerald: "bg-emerald-950/60 text-emerald-400 border-emerald-900",
  cyan: "bg-cyan-950/60 text-cyan-400 border-cyan-900",
  amber: "bg-amber-950/60 text-amber-400 border-amber-900",
  orange: "bg-orange-950/60 text-orange-400 border-orange-900",
  red: "bg-red-950/60 text-red-400 border-red-900",
  slate: "bg-slate-800/60 text-slate-300 border-slate-700",
};

export function StatusBadge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: keyof typeof STYLES;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STYLES[tone]
      )}
    >
      {label}
    </span>
  );
}
