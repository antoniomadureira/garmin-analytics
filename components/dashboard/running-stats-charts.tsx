"use client";

import { Card, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface RunningStatsData {
  thisWeekKm: number;
  lastWeekKm: number;
  avgWeekKm: number;
  bestWeekKm: number;
  totalYtdKm: number;
  totalAllTimeKm: number;
  weeklyVolume: { weekLabel: string; km: number }[];
  monthlyVolume: { month: string; km: number }[];
  weeklyRunCount: { weekLabel: string; count: number }[];
  weeklyElevation: { weekLabel: string; m: number }[];
}

const MONTH_PT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
function monthLabel(ym: string): string {
  return MONTH_PT[Number(ym.slice(5, 7)) - 1] ?? ym;
}

function fmtKm(v: number): string {
  return `${v.toLocaleString("pt-PT", { maximumFractionDigits: 0 })}km`;
}

export function RunningStatsTiles({ data }: { data: RunningStatsData }) {
  const tiles = [
    { label: "Esta Semana", value: fmtKm(data.thisWeekKm) },
    { label: "Semana Anterior", value: fmtKm(data.lastWeekKm) },
    { label: "Média Semanal", value: fmtKm(data.avgWeekKm) },
    { label: "Melhor Semana", value: fmtKm(data.bestWeekKm), highlight: true },
    { label: "Total YTD", value: fmtKm(data.totalYtdKm) },
    { label: "Total Histórico", value: fmtKm(data.totalAllTimeKm) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-xl border p-3 text-center ${
            t.highlight ? "border-orange-500/50 bg-orange-950/30" : "border-slate-800 bg-slate-900/40"
          }`}
        >
          <div className={`text-lg font-bold ${t.highlight ? "text-orange-400" : "text-slate-100"}`}>{t.value}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

export function WeeklyVolumeChart({ data }: { data: { weekLabel: string; km: number }[] }) {
  return (
    <Card>
      <CardTitle>Volume Semanal — 18 Semanas</CardTitle>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(v: number) => [`${v} km`, "Distância"]}
            />
            <Bar dataKey="km" fill="#fb923c" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function MonthlyVolumeMiniChart({ data }: { data: { month: string; km: number }[] }) {
  const chartData = data.map((d) => ({ label: monthLabel(d.month), km: d.km }));
  return (
    <Card>
      <CardTitle>Volume Mensal</CardTitle>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(v: number) => [`${v} km`, "Distância"]}
            />
            <Line type="monotone" dataKey="km" stroke="#fb923c" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function WeeklyRunCountMiniChart({ data }: { data: { weekLabel: string; count: number }[] }) {
  return (
    <Card>
      <CardTitle>Corridas por Semana</CardTitle>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(v: number) => [v, "Corridas"]}
            />
            <Bar dataKey="count" fill="#fbbf24" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function WeeklyElevationChart({ data }: { data: { weekLabel: string; m: number }[] }) {
  return (
    <Card>
      <CardTitle>Elevação Acumulada Semanal</CardTitle>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-elev-weekly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(v: number) => [`${v} m`, "Elevação"]}
            />
            <Area type="monotone" dataKey="m" stroke="#34d399" strokeWidth={2} fill="url(#grad-elev-weekly)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
