"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export interface SegmentProgressData {
  name: string;
  distanceM: number;
  bestSeconds: number;
  history: { date: string; seconds: number }[];
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SegmentProgressCard({ segment }: { segment: SegmentProgressData }) {
  // [Certo] Tempo mais rápido deve aparecer mais alto — mesmo truque já
  // usado noutros gráficos de pace da app (valor negativo, eixo invertido).
  const chartData = segment.history.map((h) => ({ date: h.date.slice(5), neg: -h.seconds }));

  return (
    <Card>
      <CardTitle>{segment.name}</CardTitle>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-slate-500">{(segment.distanceM / 1000).toFixed(2)} km</span>
        <span className="text-lg font-bold text-orange-400">{formatSeconds(segment.bestSeconds)}</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height={128}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 9, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v: number) => formatSeconds(-v)}
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: number) => [formatSeconds(-value), "Tempo"]}
            />
            <Line type="monotone" dataKey="neg" stroke="#fb923c" strokeWidth={2} dot={{ r: 3, fill: "#fb923c", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
