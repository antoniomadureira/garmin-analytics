import { Footprints, Layers, Clock, TrendingUp, Heart, Info } from "lucide-react";
import clsx from "clsx";

export interface YoyKpi {
  label: string;
  current: number;
  previous: number;
  unit: string;
  decimals?: number;
}

function formatValue(v: number, decimals = 0) {
  return v.toLocaleString("pt-PT", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

const ICON_BY_LABEL: Record<string, typeof Footprints> = {
  Corridas: Footprints,
  Distância: Layers,
  Tempo: Clock,
  Elevação: TrendingUp,
  "FC Média": Heart,
};
const COLOR_BY_LABEL: Record<string, string> = {
  Corridas: "#22d3ee",
  Distância: "#22d3ee",
  Tempo: "#22d3ee",
  Elevação: "#22d3ee",
  "FC Média": "#fb923c",
};

export function YoyKpiGrid({ kpis }: { kpis: YoyKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => {
        const pct = kpi.previous === 0 ? 0 : ((kpi.current - kpi.previous) / kpi.previous) * 100;
        const positive = pct >= 0;
        const Icon = ICON_BY_LABEL[kpi.label] ?? Layers;
        const color = COLOR_BY_LABEL[kpi.label] ?? "#22d3ee";
        return (
          <div key={kpi.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <Icon size={14} style={{ color }} />
              <Info size={12} className="text-slate-600" />
            </div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{kpi.label}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold" style={{ color }}>
                {formatValue(kpi.current, kpi.decimals)}
                <span className="ml-0.5 text-xs font-normal text-slate-500">{kpi.unit}</span>
              </span>
              <span className={clsx("flex items-center gap-0.5 text-xs font-medium", positive ? "text-emerald-400" : "text-red-400")}>
                {positive ? "↑" : "↓"}
                {Math.abs(pct).toFixed(0)}%
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: color, opacity: 0.6 }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {new Date().getFullYear() - 1}: <span className="font-medium text-slate-300">{formatValue(kpi.previous, kpi.decimals)}{kpi.unit}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
