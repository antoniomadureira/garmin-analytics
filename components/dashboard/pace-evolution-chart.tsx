"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export interface PacePoint {
  date: string; // dd/mm
  paceMinPerKm: number;
}

function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PaceEvolutionChart({ data }: { data: PacePoint[] }) {
  // [Certo] Pace mais rápido (número menor) deve aparecer mais alto no
  // gráfico — inverte-se guardando o valor negativo e formatando de volta
  // ao positivo nos eixos/tooltip, truque comum para este tipo de gráfico.
  const chartData = data.map((d) => ({ ...d, neg: -d.paceMinPerKm }));

  return (
    <Card>
      <CardTitle>Evolução de Pace</CardTitle>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v: number) => formatPace(-v)}
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
              formatter={(value: number) => [`${formatPace(-value)}/km`, "Pace"]}
            />
            <Line type="monotone" dataKey="neg" stroke="#fb923c" strokeWidth={2} dot={{ r: 3, fill: "#fb923c", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
