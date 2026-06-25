"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export interface DetailSeriesPoint {
  distanceKm: number;
  hr: number | null;
  altitude: number | null;
  paceMinPerKm: number | null;
  cadence: number | null;
}

type Tab = "hr" | "altitude" | "pace" | "cadence";

const TABS: { key: Tab; label: string; color: string; unit: string }[] = [
  { key: "hr", label: "FC (bpm)", color: "#fb7185", unit: "bpm" },
  { key: "altitude", label: "Altitude (m)", color: "#34d399", unit: "m" },
  { key: "pace", label: "Pace (min/km)", color: "#22d3ee", unit: "min/km" },
  { key: "cadence", label: "Cadência (spm)", color: "#a78bfa", unit: "spm" },
];

export function ActivitySeriesChart({ series }: { series: DetailSeriesPoint[] }) {
  const [tab, setTab] = useState<Tab>("hr");
  const active = TABS.find((t) => t.key === tab)!;
  const key = tab === "hr" ? "hr" : tab === "altitude" ? "altitude" : tab === "pace" ? "paceMinPerKm" : "cadence";

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              tab === t.key ? "bg-slate-800" : "text-slate-500 hover:text-slate-300"
            }`}
            style={tab === t.key ? { color: t.color } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="distanceKm"
              type="number"
              tickFormatter={(v: number) => `${v.toFixed(1)}km`}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              labelFormatter={(v: number) => `${v.toFixed(2)} km`}
              formatter={(value: number) => [`${value} ${active.unit}`, active.label]}
            />
            <Line type="monotone" dataKey={key} stroke={active.color} strokeWidth={1.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
