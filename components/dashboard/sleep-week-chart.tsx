"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

export interface SleepWeekPoint {
  day: string; // ex: "Seg"
  hours: number;
}

export function SleepWeekChart({ data, targetHours = 8 }: { data: SleepWeekPoint[]; targetHours?: number }) {
  return (
    <Card>
      <CardTitle>Sono — Últimos 7 Dias</CardTitle>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} />
            <ReferenceLine y={targetHours} stroke="#475569" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: number) => [`${value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} h`, "Duração"]}
            />
            <Bar dataKey="hours" fill="#a78bfa" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Linha tracejada = referência de 8h.</p>
    </Card>
  );
}
