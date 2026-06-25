"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

export interface TrainingLoadPoint {
  date: string; // dd/mm
  acute: number;
  chronic: number;
}

export interface TrainingLoadCardData {
  vo2Max: number;
  trainingStatusLabel: string; // ex: "Productive", "Maintaining"
  acwrStatus: string; // ex: "OPTIMAL", "HIGH", "LOW"
  history: TrainingLoadPoint[];
}

const ACWR_TONE: Record<string, "emerald" | "amber" | "red"> = {
  OPTIMAL: "emerald",
  HIGH: "red",
  LOW: "amber",
};

const ACWR_LABEL_PT: Record<string, string> = {
  OPTIMAL: "Ótimo",
  HIGH: "Alto",
  LOW: "Baixo",
};

/** [Suposição] Lista de códigos trainingStatus prováveis (padrão Garmin Connect); só "MAINTAINING" foi visto em dados reais até agora. */
const TRAINING_STATUS_LABEL_PT: Record<string, string> = {
  PRODUCTIVE: "Produtivo",
  Productive: "Produtivo",
  MAINTAINING: "A Manter",
  Maintaining: "A Manter",
  PEAKING: "No Pico",
  OVERREACHING: "Sobrecarga",
  RECOVERY: "Recuperação",
  DETRAINING: "Perda de Forma",
  NO_STATUS: "Sem Estado",
};

const ACWR_EXPLAIN: Record<string, string> = {
  OPTIMAL: "Carga equilibrada — janela segura para manter ou subir intensidade.",
  HIGH: "Carga a subir mais rápido que a base — risco de sobrecarga.",
  LOW: "Carga abaixo da base recente — espaço para aumentar volume.",
};

export function TrainingLoadCard({ data }: { data: TrainingLoadCardData }) {
  const tone = ACWR_TONE[data.acwrStatus] ?? "emerald";
  const acwrLabel = ACWR_LABEL_PT[data.acwrStatus] ?? data.acwrStatus;
  const statusLabel = TRAINING_STATUS_LABEL_PT[data.trainingStatusLabel] ?? data.trainingStatusLabel;
  return (
    <Card glow={tone}>
      <CardTitle>Estado de Treino</CardTitle>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold text-slate-100">VO2 Max {data.vo2Max}</div>
          <div className="text-xs text-slate-500">{statusLabel}</div>
        </div>
        <StatusBadge label={acwrLabel} tone={tone} />
      </div>
      <div className="mt-4 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "acute" ? "Carga aguda" : "Carga crónica")} />
            <Line type="monotone" dataKey="acute" stroke="#22d3ee" strokeWidth={1.5} dot={false} name="acute" />
            <Line type="monotone" dataKey="chronic" stroke="#34d399" strokeWidth={1.5} dot={false} name="chronic" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{ACWR_EXPLAIN[data.acwrStatus] ?? ""}</p>
    </Card>
  );
}
