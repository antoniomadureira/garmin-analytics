"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export interface RunningSummaryCardData {
  weeklyDistanceKm: number;
  weeklyTimeFormatted: string; // ex: "4h 32m"
  runCount: number;
  dailyDistances: { day: string; km: number }[];
}

export function RunningSummaryCard({ data }: { data: RunningSummaryCardData }) {
  return (
    <Card glow="cyan" className="flex-1">
      <CardTitle>Resumo de Corrida</CardTitle>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="whitespace-nowrap text-xl font-semibold text-slate-100">
            {data.weeklyDistanceKm.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
          <div className="text-[11px] text-slate-500">km semana</div>
        </div>
        <div>
          <div className="whitespace-nowrap text-xl font-semibold text-slate-100">{data.weeklyTimeFormatted}</div>
          <div className="text-[11px] text-slate-500">tempo</div>
        </div>
        <div>
          <div className="whitespace-nowrap text-xl font-semibold text-slate-100">{data.runCount}</div>
          <div className="text-[11px] text-slate-500">corridas</div>
        </div>
      </div>
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={112}>
          <BarChart data={data.dailyDistances} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: number) => [`${value.toLocaleString("pt-PT")} km`, "Distância"]}
            />
            <Bar dataKey="km" fill="#22d3ee" radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
