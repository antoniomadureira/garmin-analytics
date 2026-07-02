"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface RunningSummaryCardData {
  weeklyDistanceKm: number;
  weeklyTimeFormatted: string;
  runCount: number;
  dailyDistances: { day: string; km: number }[];
  previousWeekKm: number | null; // semana anterior, para o delta
}

export function RunningSummaryCard({ data }: { data: RunningSummaryCardData }) {
  const deltaPct =
    data.previousWeekKm && data.previousWeekKm > 0
      ? Math.round(((data.weeklyDistanceKm - data.previousWeekKm) / data.previousWeekKm) * 100)
      : null;
  const deltaPositive = (deltaPct ?? 0) >= 0;

  return (
    <Card glow="cyan" className="flex-1">
      <CardTitle>Corrida — Últimos 7 Dias</CardTitle>

      {/* KPIs com delta semanal */}
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-100">
          {data.weeklyDistanceKm.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          <span className="ml-1 text-sm font-normal text-slate-500">km</span>
        </span>
        {deltaPct !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${deltaPositive ? "text-emerald-400" : "text-amber-400"}`}>
            {deltaPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {deltaPositive ? "+" : ""}{deltaPct}% vs semana anterior
          </span>
        )}
      </div>
      <div className="mb-3 flex gap-4 text-xs text-slate-500">
        <span><span className="font-medium text-slate-300">{data.weeklyTimeFormatted}</span> tempo</span>
        <span><span className="font-medium text-slate-300">{data.runCount}</span> corridas</span>
      </div>

      {/* Área com gradiente — mesmo estilo do resto da app.
          [Certo] Corte do 1º dia resolvido: a versão anterior usava
          margin left -28 (puxava o gráfico para fora do limite visível);
          agora margens positivas + padding no XAxis. */}
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data.dailyDistances} margin={{ top: 6, right: 10, bottom: 0, left: 10 }}>
          <defs>
            <linearGradient id="grad-run-week" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            padding={{ left: 12, right: 12 }}
            interval={0}
          />
          <YAxis hide domain={[0, "dataMax + 2"]} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12, borderRadius: 8 }}
            labelStyle={{ color: "#cbd5e1" }}
            formatter={(value: number) => [`${value.toLocaleString("pt-PT")} km`, "Distância"]}
          />
          <Area
            type="monotone"
            dataKey="km"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#grad-run-week)"
            dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
