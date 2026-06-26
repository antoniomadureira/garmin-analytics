"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

export interface TrainingLoadPoint {
  date: string; // dd/mm
  ctl: number;
  atl: number;
}

export interface TrainingLoadCardData {
  vo2Max: number;
  trainingStatusLabel: string;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  history: TrainingLoadPoint[];
  acwrStatus?: string; // <- Adiciona apenas esta linha
}

/**
 * [Provável] Bandas de classificação TSB convencionais (TrainingPeaks/
 * Intervals.icu): >5 Fresco, -10 a 5 Óptimo, <-10 Fadigado/Overreach.
 * São a convenção mais comum na comunidade, não uma constante oficial
 * documentada — ajustar se preferir limiares diferentes.
 */
function classifyTsb(tsb: number | null): { label: string; tone: "emerald" | "cyan" | "amber" | "red" } {
  if (tsb === null) return { label: "Sem dado", tone: "cyan" };
  if (tsb > 5) return { label: "Fresco", tone: "emerald" };
  if (tsb >= -10) return { label: "Óptimo", tone: "cyan" };
  if (tsb >= -20) return { label: "Fadigado", tone: "amber" };
  return { label: "Overreach", tone: "red" };
}

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

export function TrainingLoadCard({ data }: { data: TrainingLoadCardData }) {
  const { label: tsbLabel, tone } = classifyTsb(data.tsb);
  const statusLabel = TRAINING_STATUS_LABEL_PT[data.trainingStatusLabel] ?? data.trainingStatusLabel;
  return (
    <Card glow={tone} className="flex-1">
      <CardTitle>Estado de Treino</CardTitle>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold text-slate-100">VO2 Max {data.vo2Max}</div>
          <div className="text-xs text-slate-500">{statusLabel}</div>
        </div>
        <StatusBadge label={`TSB ${data.tsb !== null ? (data.tsb > 0 ? "+" : "") + data.tsb : "—"} · ${tsbLabel}`} tone={tone} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
        <div>
          <span className="text-slate-500">CTL </span>
          <span className="font-medium text-slate-200">{data.ctl ?? "—"}</span>
        </div>
        <div>
          <span className="text-slate-500">ATL </span>
          <span className="font-medium text-slate-200">{data.atl ?? "—"}</span>
        </div>
      </div>
      <div className="mt-3 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }}
              labelStyle={{ color: "#cbd5e1" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "ctl" ? "CTL (fitness)" : "ATL (fadiga)")} />
            <Line type="monotone" dataKey="ctl" stroke="#34d399" strokeWidth={1.5} dot={false} name="ctl" />
            <Line type="monotone" dataKey="atl" stroke="#fb923c" strokeWidth={1.5} dot={false} name="atl" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        TSB (Training Stress Balance) = CTL − ATL. Fonte: Intervals.icu (via Garmin), dados de hoje.
      </p>
    </Card>
  );
}
