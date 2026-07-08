"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";
import type { WeeklyIntensityData, IntensityStatus } from "@/lib/analysis/intensity-distribution";
import { getIntensityStatus } from "@/lib/analysis/intensity-distribution";

export type { WeeklyIntensityData };

// Paleta neutra por balde — forte não é "mau", reservar vermelho para status
const EASY_COLOR = "#34d399";    // emerald-400
const MOD_COLOR = "#fbbf24";     // amber-400
const STRONG_COLOR = "#818cf8";  // indigo-400 — neutro, forte ≠ "mau"

const STATUS_COLOR: Record<IntensityStatus, string> = {
  ok: "text-emerald-400",
  caution: "text-amber-400",
  alert: "text-red-400",
};

function interpretationLine(
  status: IntensityStatus,
  easyPct: number | null,
  lowVolume: boolean,
): string {
  if (lowVolume) return "< 2h em zonas esta semana — distribuição não representativa";
  if (easyPct === null) return "Sem dados de zonas esta semana";
  if (status === "ok") return `${easyPct.toFixed(0)}% fácil — equilíbrio 80/20 bom`;
  if (status === "caution") return `${easyPct.toFixed(0)}% fácil — semana a puxar para o cinzento`;
  return `${easyPct.toFixed(0)}% fácil — semana de alta intensidade`;
}

export function IntensityDistributionChart({ data }: { data: WeeklyIntensityData[] }) {
  if (data.length === 0) return null;

  const current = data[data.length - 1];
  const status = getIntensityStatus(current?.easyPct ?? null);
  const statusColor = current?.lowVolume ? "text-slate-500" : STATUS_COLOR[status];

  const chartData = data.map((w) => ({
    weekLabel: w.weekLabel,
    easyPct: w.easyPct ?? 0,
    moderatePct: w.moderatePct ?? 0,
    strongPct: w.strongPct ?? 0,
    lowVolume: w.lowVolume,
  }));

  const lastIdx = chartData.length - 1;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Intensidade Semanal</h3>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: EASY_COLOR }} />Fácil</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: MOD_COLOR }} />Moderado</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: STRONG_COLOR }} />Forte</span>
        </div>
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="#1e293b" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
              cursor={{ fill: "#1e293b", opacity: 0.5 }}
              formatter={(value: number, name: string) => [
                `${(value as number).toFixed(1)}%`,
                name === "easyPct" ? "Fácil (Z1-Z2)" : name === "moderatePct" ? "Moderado (Z3)" : "Forte (Z4+)",
              ]}
            />
            {/* Referência 80% — alvo do modelo polarizado */}
            <ReferenceLine y={80} stroke="#475569" strokeDasharray="4 2" />
            <Bar dataKey="easyPct" stackId="a" fill={EASY_COLOR} isAnimationActive={false}>
              {chartData.map((_, i) => <Cell key={i} opacity={i === lastIdx ? 1 : 0.6} />)}
            </Bar>
            <Bar dataKey="moderatePct" stackId="a" fill={MOD_COLOR} isAnimationActive={false}>
              {chartData.map((_, i) => <Cell key={i} opacity={i === lastIdx ? 1 : 0.6} />)}
            </Bar>
            <Bar dataKey="strongPct" stackId="a" fill={STRONG_COLOR} isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} opacity={i === lastIdx ? 1 : 0.6} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className={`text-xs ${statusColor}`}>
        {interpretationLine(status, current?.easyPct ?? null, current?.lowVolume ?? false)}
      </p>
    </div>
  );
}
