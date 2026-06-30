"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Calendar, ChevronLeft, BarChart3, Star, Flag, Globe } from "lucide-react";

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

const TILE_ICONS = [Calendar, ChevronLeft, BarChart3, Star, Flag, Globe];
const TILE_COLORS = ["#22d3ee", "#94a3b8", "#a78bfa", "#fb923c", "#34d399", "#fbbf24"];

export function RunningStatsTiles({ data }: { data: RunningStatsData }) {
  const tiles = [
    { label: "Esta Semana", value: fmtKm(data.thisWeekKm) },
    { label: "Sem. Anterior", value: fmtKm(data.lastWeekKm) },
    { label: "Média Semanal", value: fmtKm(data.avgWeekKm) },
    { label: "Melhor Semana", value: fmtKm(data.bestWeekKm), highlight: true },
    { label: "Total YTD", value: fmtKm(data.totalYtdKm) },
    { label: "Total Histórico", value: fmtKm(data.totalAllTimeKm) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t, i) => {
        const Icon = TILE_ICONS[i];
        const color = t.highlight ? "#fb923c" : TILE_COLORS[i];
        return (
          <div
            key={t.label}
            className={`rounded-xl border p-3 transition ${
              t.highlight ? "border-orange-500 bg-orange-950/30 shadow-lg shadow-orange-950/40" : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="mb-2 flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide" style={{ color }}>
              <Icon size={12} />
              {t.label}
            </div>
            <div className="text-xl font-bold" style={{ color: t.highlight ? "#fb923c" : "#f1f5f9" }}>
              {t.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * [Certo] Componente único partilhado por todos os 4 gráficos abaixo —
 * antes cada um tinha um "kind" diferente (barras, linha, barras,
 * área), sem lógica entre eles, o que dava sensação de desalinhamento
 * visual. Unificado num único padrão (área com gradiente suave), só a
 * cor muda por gráfico — consistente com dashboards modernos
 * (Linear/Vercel Analytics), onde a variedade de tipo de gráfico é
 * reservada para quando muda o tipo de informação, não por decoração.
 */
function UnifiedAreaChart({
  title,
  data,
  dataKey,
  color,
  unit,
  height = 160,
  decimals = 0,
}: {
  title: string;
  data: Record<string, string | number>[];
  dataKey: string;
  color: string;
  unit: string;
  height?: number;
  decimals?: number;
}) {
  const gradId = `grad-${dataKey}-${color.replace("#", "")}`;
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} allowDecimals={decimals > 0} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(v: number) => [`${v.toFixed(decimals)} ${unit}`, title]}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function WeeklyVolumeChart({ data }: { data: { weekLabel: string; km: number }[] }) {
  return (
    <UnifiedAreaChart
      title="Volume Semanal — 18 Semanas"
      data={data.map((d) => ({ label: d.weekLabel, km: d.km }))}
      dataKey="km"
      color="#fb923c"
      unit="km"
      height={176}
    />
  );
}

export function MonthlyVolumeMiniChart({ data }: { data: { month: string; km: number }[] }) {
  return (
    <UnifiedAreaChart
      title="Volume Mensal"
      data={data.map((d) => ({ label: monthLabel(d.month), km: d.km }))}
      dataKey="km"
      color="#22d3ee"
      unit="km"
    />
  );
}

export function WeeklyRunCountMiniChart({ data }: { data: { weekLabel: string; count: number }[] }) {
  return (
    <UnifiedAreaChart
      title="Corridas por Semana"
      data={data.map((d) => ({ label: d.weekLabel, count: d.count }))}
      dataKey="count"
      color="#fbbf24"
      unit="corridas"
    />
  );
}

export function WeeklyElevationChart({ data }: { data: { weekLabel: string; m: number }[] }) {
  return (
    <UnifiedAreaChart
      title="Elevação Acumulada Semanal"
      data={data.map((d) => ({ label: d.weekLabel, m: d.m }))}
      dataKey="m"
      color="#34d399"
      unit="m"
      height={176}
    />
  );
}
