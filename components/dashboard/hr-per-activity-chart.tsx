"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export interface HrPoint {
  name: string; // nome da atividade (ex: "Corrida de São João")
  avgHr: number | null;
  maxHr: number | null;
}

export function HrPerActivityChart({ data }: { data: HrPoint[] }) {
  return (
    <Card>
      <CardTitle>Frequência Cardíaca por Corrida</CardTitle>
      <div className="h-56">
        <ResponsiveContainer width="100%" height={224}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-hr-activity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} domain={[80, "auto"]} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: number) => [`${value} bpm`, "FC média"]}
            />
            <Area type="monotone" dataKey="avgHr" stroke="#fb7185" strokeWidth={2} fill="url(#grad-hr-activity)" dot={{ r: 3, fill: "#fb7185", strokeWidth: 0 }} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
