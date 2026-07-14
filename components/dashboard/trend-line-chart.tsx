"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export interface TrendSeries {
  key: string;
  color: string;
  label: string;
  unit?: string;
}

export function TrendLineChart({
  title,
  data,
  series,
  yDomain,
  height = 220,
  tickFormatter,
}: {
  title: string;
  data: Record<string, number | string | null>[];
  series: TrendSeries[];
  yDomain?: [number, number];
  height?: number;
  /** Optional formatter for Y-axis ticks and tooltip values (e.g. decimal hours → "7h30"). */
  tickFormatter?: (value: number) => string;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              domain={yDomain ?? ["auto", "auto"]}
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={tickFormatter}
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={tickFormatter
                ? (v: number, name: string): [string, string] => [tickFormatter(v), name]
                : undefined}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                connectNulls
                name={s.label}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <div className="mt-1 flex gap-4 text-[11px] text-slate-400">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
