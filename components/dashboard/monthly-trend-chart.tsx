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

/** [Certo] Quando há datas explícitas definidas, têm prioridade sobre o range rápido. */
function buildSeriesCustomRange(daily: DailyTrendPoint[], startStr: string, endStr: string, metric: Metric) {
  const inRange = daily.filter((d) => d.date >= startStr && d.date <= endStr);
  const valueOf = (d: DailyTrendPoint) => (metric === "distance" ? d.distanceKm : metric === "duration" ? d.durationH : d.caloriesKcal);

  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  const daysSpan = Math.round((end.getTime() - start.getTime()) / 86400000);

  if (daysSpan <= 45) {
    return inRange.map((d) => ({
      key: d.date,
      label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
      fullLabel: new Date(`${d.date}T00:00:00`).toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "2-digit" }),
      value: roundTo(valueOf(d), 2),
    }));
  }

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

/**
 * [Certo] Para comparação homóloga, a forma mais clara é cumulativo
 * alinhado por "dia N desde o início do período" (não por data
 * absoluta) — assim as duas linhas (atual vs anterior) ficam no mesmo
 * eixo X e dá para ver de imediato se está à frente ou atrás do ano
 * passado, em vez de duas curvas em datas diferentes lado a lado.
 */
function buildComparisonSeries(daily: DailyTrendPoint[], range: Range, metric: Metric) {
  const today = new Date();
  const currentStart = rangeStartDate(range, today);
  const currentStartStr = currentStart.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const daysSpan = Math.round((today.getTime() - currentStart.getTime()) / 86400000);

  const prevStart = new Date(currentStart);
  prevStart.setFullYear(prevStart.getFullYear() - 1);
  const prevEnd = new Date(today);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  const prevStartStr = prevStart.toISOString().slice(0, 10);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);

  const valueOf = (d: DailyTrendPoint) => (metric === "distance" ? d.distanceKm : metric === "duration" ? d.durationH : d.caloriesKcal);

  const byDate = new Map(daily.map((d) => [d.date, valueOf(d)]));

  const points: { dayIndex: number; label: string; current: number | null; previous: number | null }[] = [];
  let cumCurrent = 0;
  let cumPrevious = 0;
  // [Provável] Granularidade semanal para períodos longos (evita 365 pontos ilegíveis), diária para 7D/1M.
  const stepDays = daysSpan <= 35 ? 1 : 7;

  for (let i = 0; i <= daysSpan; i += stepDays) {
    const curDate = new Date(currentStart);
    curDate.setDate(curDate.getDate() + i);
    const curStr = curDate.toISOString().slice(0, 10);
    if (curStr > todayStr) break;

    const prevDate = new Date(prevStart);
    prevDate.setDate(prevDate.getDate() + i);
    const prevStr = prevDate.toISOString().slice(0, 10);

    // soma o intervalo [i, i+stepDays) em vez de só o dia pontual
    for (let j = 0; j < stepDays; j++) {
      const cd = new Date(currentStart);
      cd.setDate(cd.getDate() + i + j);
      const cdStr = cd.toISOString().slice(0, 10);
      if (cdStr <= todayStr) cumCurrent += byDate.get(cdStr) ?? 0;

      const pd = new Date(prevStart);
      pd.setDate(pd.getDate() + i + j);
      const pdStr = pd.toISOString().slice(0, 10);
      if (pdStr <= prevEndStr) cumPrevious += byDate.get(pdStr) ?? 0;
    }

    points.push({
      dayIndex: i,
      label: `D${i}`,
      current: curStr <= todayStr ? roundTo(cumCurrent, 1) : null,
      previous: roundTo(cumPrevious, 1),
    });
  }

  return { points, currentLabel: `${currentStartStr.slice(0, 4)} (atual)`, previousLabel: `${prevStartStr.slice(0, 4)}` };
}

export function MonthlyTrendChart({ data }: { data: DailyTrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>("distance");
  const [range, setRange] = useState<Range>("YTD");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const activeMetric = METRICS.find((m) => m.key === metric)!;

  const usingCustomRange = customStart !== "" && customEnd !== "";
  const chartData = useMemo(
    () => (usingCustomRange ? buildSeriesCustomRange(data, customStart, customEnd, metric) : buildSeries(data, range, metric)),
    [data, range, metric, customStart, customEnd, usingCustomRange]
  );
  const comparison = useMemo(() => buildComparisonSeries(data, range, metric), [data, range, metric]);
  const total = chartData.reduce((acc, d) => acc + d.value, 0);
  const earliestDate = data.length ? data[0].date : undefined;
  const todayStr = new Date().toISOString().slice(0, 10);

  const lastComparisonPoint = [...comparison.points].reverse().find((p) => p.current !== null);
  const currentTotal = lastComparisonPoint?.current ?? 0;
  const previousTotalAtSamePoint = lastComparisonPoint?.previous ?? 0;
  const diffPct = previousTotalAtSamePoint > 0 ? ((currentTotal - previousTotalAtSamePoint) / previousTotalAtSamePoint) * 100 : 0;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
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
        <button
          onClick={() => setCompareMode((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            compareMode ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          Comparar com ano anterior
        </button>
      </div>

      {compareMode ? (
        <>
          <div className="mb-1 text-xs text-slate-500">{activeMetric.label} acumulada — até ao dia equivalente</div>
          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-100">
              {currentTotal.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}
              <span className="ml-1 text-sm font-normal text-slate-500">{activeMetric.unit}</span>
            </span>
            <span className={`text-sm font-medium ${diffPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {diffPct >= 0 ? "↑" : "↓"} {Math.abs(diffPct).toFixed(0)}% vs {comparison.previousLabel}
            </span>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={comparison.points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
                  labelStyle={{ color: "#cbd5e1" }}
                  formatter={(value: number, key: string) => [
                    `${value?.toLocaleString("pt-PT") ?? "—"} ${activeMetric.unit}`,
                    key === "current" ? comparison.currentLabel : comparison.previousLabel,
                  ]}
                />
                <Area type="monotone" dataKey="previous" stroke="#64748b" strokeWidth={1.5} fill="none" strokeDasharray="4 4" connectNulls />
                <Area type="monotone" dataKey="current" stroke={activeMetric.color} strokeWidth={2} fill="none" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: activeMetric.color }} />
              {comparison.currentLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full border border-slate-500" />
              {comparison.previousLabel}
            </span>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}

      {!compareMode && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  setCustomStart("");
                  setCustomEnd("");
                }}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  !usingCustomRange && range === r ? "bg-orange-500/20 text-orange-400" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span>ou:</span>
            <input
              type="date"
              value={customStart}
              min={earliestDate}
              max={customEnd || todayStr}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 [color-scheme:dark]"
            />
            <span>até</span>
            <input
              type="date"
              value={customEnd}
              min={customStart || earliestDate}
              max={todayStr}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 [color-scheme:dark]"
            />
            {usingCustomRange && (
              <button
                onClick={() => {
                  setCustomStart("");
                  setCustomEnd("");
                }}
                className="text-cyan-400 hover:underline"
              >
                limpar
              </button>
            )}
          </div>
        </>
      )}

      {compareMode && (
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          {RANGES.filter((r) => r !== "7D").map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 font-medium transition ${
                range === r ? "bg-cyan-500/20 text-cyan-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
