"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

export interface FormBannerData {
  message: string; // ex: "Forma equilibrada. ACWR 1.1. Boa janela para intensidade."
  tone: "emerald" | "amber" | "red" | "cyan";
}

export interface RadarDimension {
  dimension: string;
  value: number; // 0-100, normalizado
}

export function FormBanner({ data }: { data: FormBannerData }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/40 px-5 py-4"
    >
      <p className="text-sm text-slate-200">{data.message}</p>
      <StatusBadge label="Estado de Forma" tone={data.tone} />
    </div>
  );
}

export function FormRadarCard({ data }: { data: RadarDimension[] }) {
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>Performance Radar</CardTitle>
        <span
          className="cursor-help text-slate-600"
          title="Comparação normalizada de 5 dimensões: Pace (velocidade média), Volume (km totais), FC Baixa (eficiência aeróbica), Elevação e Frescura (TSB atual)."
        >
          ⓘ
        </span>
      </div>
      <div>
        <ResponsiveContainer width="100%" height={256}>
          <RadarChart data={data}>
            <PolarGrid stroke="#1e293b" strokeWidth={0.75} />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Radar dataKey="value" stroke="#34d399" strokeWidth={1.5} fill="#34d399" fillOpacity={0.12} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
