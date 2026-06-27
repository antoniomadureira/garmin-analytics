"use client";

import { useMemo, useState } from "react";
import { Activity, Clock, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export interface DailyTrendPoint {
  date: string; // "YYYY-MM-DD"
  distanceKm: number;
  durationH: number;
  caloriesKcal: number;
}

type Metric = "distance" | "duration" | "calories";
type Range = "7D" | "1M" | "3M" | "6M" | "YTD" | "1Y";

const METRICS: { key: Metric; label: string; icon: typeof Activity; color: string; unit: string }[] = [
  { key: "distance", label: "Distância", icon: Activity, color: "#fb923c", unit: "km" },
  { key: "duration", label: "Tempo", icon: Clock, color: "#22d3ee", unit: "h" },
  { key: "calories", label: "Calorias", icon: Flame, color: "#f87171", unit: "kcal" },
];
const RANGES: Range[] = ["7D", "1M", "3M", "6M", "YTD", "1Y"];

const WEEKDAY_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_PT = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];

function rangeStartDate(range: Range, today: Date): Date {
  const d = new Date(today);
  switch (range) {
    case "7D":
      d.setDate(d.getDate() - 6);
      return d;
    case "1M":
      d.setMonth(d.getMonth() - 1);
      return d;
    case "3M":
      d.setMonth(d.getMonth() - 3);
      return d;
    case "6M":
      d.setMonth(d.getMonth() - 6);
      return d;
    case "YTD":
      return new Date(today.getFullYear(), 0, 1);
    case "1Y":
      d.setFullYear(d.getFullYear() - 1);
      return d;
  }
}

/** [Certo] Granularidade diária para 7D/1M, mensal para os restantes — evita um gráfico de 365 pontos ilegível em 1Y. */
function buildSeries(daily: DailyTrendPoint[], range: Range, metric: Metric) {
  const today = new Date();
  const startDate = rangeStartDate(range, today);
  const startStr = startDate.toISOString().slice(0, 10);
  const inRange = daily.filter((d) => d.date >= startStr);

  const valueOf = (d: DailyTrendPoint) => (metric === "distance" ? d.distanceKm : metric === "duration" ? d.durationH : d.caloriesKcal);

  if (range === "7D" || range === "1M") {
    return inRange.map((d) => ({
      key: d.date,
      label: range === "7D" ? WEEKDAY_PT[new Date(`${d.date}T00:00:00`).getDay()] : d.date.slice(8, 10),
      fullLabel: new Date(`${d.date}T00:00:00`).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "2-digit" }),
      value: roundTo(valueOf(d), 2),
    }));
  }

  // Mensal para 3M/6M/YTD/1Y
  const buckets = new Map<string, number>();
  for (const d of inRange) {
    const month = d.date.slice(0, 7);
    buckets.set(month, (buckets.get(month) ?? 0) + valueOf(d));
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, value]) => ({
      key: month,
      label: MONTH_PT[Number(month.slice(5, 7)) - 1],
      fullLabel: MONTH_PT[Number(month.slice(5, 7)) - 1] + " " + month.slice(0, 4),
      value: roundTo(value, 2),
    }));
}
function roundTo(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export function MonthlyTrendChart({ data }: { data: DailyTrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>("distance");
  const [range, setRange] = useState<Range>("YTD");
  const activeMetric = METRICS.find((m) => m.key === metric)!;

  const chartData = useMemo(() => buildSeries(data, range, metric), [data, range, metric]);
  const total = chartData.reduce((acc, d) => acc + d.value, 0);

  return (
    <Card>
      <div className="mb-4 flex gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              metric === m.key ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
            style={metric === m.key ? { color: m.color } : undefined}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-1 text-xs text-slate-500">{activeMetric.label} Total</div>
      <div className="mb-4 text-3xl font-bold text-slate-100">
        {total.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}
        <span className="ml-1 text-sm font-normal text-slate-500">{activeMetric.unit}</span>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height={208}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-monthly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeMetric.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ stroke: "#475569", strokeDasharray: "4 4" }}
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
              formatter={(value: number) => [`${value.toLocaleString("pt-PT")} ${activeMetric.unit}`, activeMetric.label]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={activeMetric.color}
              strokeWidth={2}
              fill="url(#grad-monthly)"
              dot={{ r: 3, fill: activeMetric.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex justify-center gap-2 text-xs">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1 font-medium transition ${
              range === r ? "bg-orange-500/20 text-orange-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </Card>
  );
}
