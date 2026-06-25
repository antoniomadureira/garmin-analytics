"use client";

import { useState } from "react";
import { Activity, Clock, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";

export interface MonthlyTrendPoint {
  month: string; // "YYYY-MM"
  distanceKm: number;
  durationH: number;
  caloriesKcal: number;
}

const MONTH_LABELS_PT = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];
function monthLabel(ym: string): string {
  const m = Number(ym.slice(5, 7)) - 1;
  return MONTH_LABELS_PT[m] ?? ym;
}

type Tab = "distance" | "duration" | "calories";

const TABS: { key: Tab; label: string; icon: typeof Activity; color: string; unit: string }[] = [
  { key: "distance", label: "Distância", icon: Activity, color: "#fb923c", unit: "km" },
  { key: "duration", label: "Tempo", icon: Clock, color: "#22d3ee", unit: "h" },
  { key: "calories", label: "Calorias", icon: Flame, color: "#f87171", unit: "kcal" },
];

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const [tab, setTab] = useState<Tab>("distance");
  const active = TABS.find((t) => t.key === tab)!;

  const chartData = data.map((d) => ({
    label: monthLabel(d.month),
    value: tab === "distance" ? d.distanceKm : tab === "duration" ? d.durationH : d.caloriesKcal,
  }));
  const total = chartData.reduce((acc, d) => acc + d.value, 0);

  return (
    <Card>
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
            style={tab === t.key ? { color: t.color } : undefined}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-1 text-xs text-slate-500">{active.label} Total · {new Date().getFullYear()} (Jan–hoje)</div>
      <div className="mb-4 text-3xl font-bold text-slate-100">
        {total.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}
        <span className="ml-1 text-sm font-normal text-slate-500">{active.unit}</span>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-monthly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={active.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={active.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: number) => [`${value.toLocaleString("pt-PT")} ${active.unit}`, active.label]}
            />
            <Area type="monotone" dataKey="value" stroke={active.color} strokeWidth={2} fill="url(#grad-monthly)" dot={{ r: 4, fill: active.color, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </Card>
  );
}
