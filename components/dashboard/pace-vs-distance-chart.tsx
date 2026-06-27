"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ZAxis } from "recharts";

export interface PaceDistancePoint {
  distanceKm: number;
  paceMinPerKm: number;
}

function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PaceVsDistanceChart({ data }: { data: PaceDistancePoint[] }) {
  const chartData = data.map((d) => ({ ...d, neg: -d.paceMinPerKm }));

  return (
    <Card>
      <CardTitle>Pace vs Distância</CardTitle>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="distanceKm"
              type="number"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}km`}
            />
            <YAxis
              dataKey="neg"
              type="number"
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v: number) => formatPace(-v)}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: number, name: string) =>
                name === "neg" ? [`${formatPace(-value)}/km`, "Pace"] : [`${value} km`, "Distância"]
              }
            />
            <Scatter data={chartData} fill="#fbbf24" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
