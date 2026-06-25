import { Card } from "@/components/ui/card";
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

export function YoyKpiGrid({ kpis }: { kpis: YoyKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => {
        const pct = kpi.previous === 0 ? 0 : ((kpi.current - kpi.previous) / kpi.previous) * 100;
        const positive = pct >= 0;
        return (
          <Card key={kpi.label} className="text-center">
            <div className="text-xs text-slate-500">{kpi.label}</div>
            <div className="mt-1 text-xl font-semibold text-slate-100">
              {formatValue(kpi.current, kpi.decimals)}
              <span className="ml-1 text-xs font-normal text-slate-500">{kpi.unit}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              vs {formatValue(kpi.previous, kpi.decimals)} {kpi.unit}
            </div>
            <div
              className={clsx(
                "mt-1 text-xs font-medium",
                positive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {positive ? "+" : ""}
              {pct.toFixed(0)}%
            </div>
          </Card>
        );
      })}
    </div>
  );
}
