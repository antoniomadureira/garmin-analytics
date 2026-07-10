"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from "lucide-react";
import type { StressLevel } from "@/lib/analysis/training-stress";

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
  rampRate: number | null;
  rampRateStatus: StressLevel | null;
  monotony: number | null;
  monotonyStatus: StressLevel | null;
  strain: number | null;
  stressLowData: boolean;
}

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

/**
 * Espectro TSB: banda de gradiente contínuo com marcador posicionado.
 * Escala visual: -30 (overreach) até +15 (fresco).
 * [Provável] Bandas convencionais TrainingPeaks/Intervals.icu:
 * >5 Fresco · -10..5 Óptimo · -20..-10 Fadigado · <-20 Overreach.
 */
function TsbSpectrum({ tsb }: { tsb: number }) {
  const MIN = -30;
  const MAX = 15;
  const clamped = Math.max(MIN, Math.min(MAX, tsb));
  const pct = ((clamped - MIN) / (MAX - MIN)) * 100;

  const zone =
    tsb > 5 ? { label: "Fresco", color: "#34d399" }
    : tsb >= -10 ? { label: "Óptimo", color: "#22d3ee" }
    : tsb >= -20 ? { label: "Fadigado", color: "#fbbf24" }
    : { label: "Overreach", color: "#f87171" };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs text-slate-500">Equilíbrio de carga (TSB)</span>
        <span className="text-sm font-semibold" style={{ color: zone.color }}>
          {tsb > 0 ? "+" : ""}{tsb} · {zone.label}
        </span>
      </div>

      {/* Banda de gradiente com marcador */}
      <div className="relative">
        <div
          className="h-2.5 w-full rounded-full"
          style={{
            background: "linear-gradient(to right, #f87171 0%, #fbbf24 33%, #22d3ee 55%, #34d399 85%)",
            opacity: 0.85,
          }}
        />
        {/* Marcador */}
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 shadow-lg transition-all duration-500"
          style={{ left: `${pct}%`, backgroundColor: zone.color }}
        />
      </div>

      {/* Rótulos das zonas */}
      <div className="mt-1 flex justify-between text-[9px] text-slate-600">
        <span>Overreach</span>
        <span>Fadigado</span>
        <span>Óptimo</span>
        <span>Fresco</span>
      </div>
    </div>
  );
}

function MetricWithTrend({ label, value, delta, color }: {
  label: string; value: number | null; delta: number | null; color: string;
}) {
  const Icon = delta === null || Math.abs(delta) < 0.5 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor = delta === null || Math.abs(delta) < 0.5 ? "text-slate-500" : delta > 0 ? "text-emerald-400" : "text-slate-400";
  return (
    <div className="flex-1 rounded-xl bg-slate-900/60 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-slate-100">{value !== null ? value.toFixed(0) : "—"}</span>
        {delta !== null && (
          <span className={`flex items-center gap-0.5 text-[11px] ${deltaColor}`}>
            <Icon size={11} />
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

const STRESS_COLORS: Record<StressLevel, string> = {
  ok: "#34d399",
  attention: "#fbbf24",
  alert: "#f87171",
};

function StressPill({ status, label }: { status: StressLevel; label: string }) {
  const color = STRESS_COLORS[status];
  const Icon = status === "alert" ? AlertTriangle : Info;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
    >
      <Icon size={9} />
      {label}
    </span>
  );
}

export function TrainingLoadCard({ data }: { data: TrainingLoadCardData }) {
  const statusLabel = TRAINING_STATUS_LABEL_PT[data.trainingStatusLabel] ?? data.trainingStatusLabel;

  // Deltas de 7 dias (primeiro vs último ponto do histórico)
  const first = data.history[0];
  const last = data.history[data.history.length - 1];
  const ctlDelta = first && last ? Math.round((last.ctl - first.ctl) * 10) / 10 : null;
  const atlDelta = first && last ? Math.round((last.atl - first.atl) * 10) / 10 : null;

  return (
    <Card className="flex-1">
      <CardTitle>Estado do Treino</CardTitle>

      <div className="space-y-4">
        {/* 1. TSB Spectrum — a resposta principal */}
        {data.tsb !== null ? (
          <TsbSpectrum tsb={data.tsb} />
        ) : (
          <p className="text-xs text-slate-500">Sem dado de TSB disponível.</p>
        )}

        {/* 2. Fitness vs Fadiga com tendência */}
        <div className="flex gap-2">
          <MetricWithTrend label="Fitness (CTL)" value={data.ctl} delta={ctlDelta} color="#34d399" />
          <MetricWithTrend label="Fadiga (ATL)" value={data.atl} delta={atlDelta} color="#fb923c" />
        </div>

        {/* 3. Gráfico de área com gradiente — consistente com o resto da app */}
        {data.history.length > 0 && (
          <div>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={data.history} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="grad-ctl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-atl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  padding={{ left: 8, right: 8 }}
                />
                <YAxis hide domain={["dataMin - 3", "dataMax + 3"]} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12, borderRadius: 8 }}
                  labelStyle={{ color: "#cbd5e1" }}
                  formatter={(value: number, key: string) => [value.toFixed(1), key === "ctl" ? "Fitness" : "Fadiga"]}
                />
                <Area type="monotone" dataKey="atl" stroke="#fb923c" strokeWidth={1.5} fill="url(#grad-atl)" dot={false} />
                <Area type="monotone" dataKey="ctl" stroke="#34d399" strokeWidth={2} fill="url(#grad-ctl)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. Ramp rate + Monotonia — só quando em atenção/alerta (sem ruído verde) */}
        {(data.rampRateStatus === "attention" || data.rampRateStatus === "alert" ||
          (!data.stressLowData && (data.monotonyStatus === "attention" || data.monotonyStatus === "alert"))) && (
          <div className="space-y-1.5 border-t border-slate-800 pt-3">
            {(data.rampRateStatus === "attention" || data.rampRateStatus === "alert") && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Progressão semanal (ramp)</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-300">
                    {data.rampRate !== null ? `${data.rampRate.toFixed(2)} CTL/sem` : "—"}
                  </span>
                  <StressPill
                    status={data.rampRateStatus}
                    label={data.rampRateStatus === "alert" ? "Alerta" : "Atenção"}
                  />
                </div>
              </div>
            )}
            {!data.stressLowData && (data.monotonyStatus === "attention" || data.monotonyStatus === "alert") && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Monotonia · Strain
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-300">
                    {data.monotony !== null ? data.monotony.toFixed(2) : "—"}
                    {data.strain !== null ? ` · ${data.strain.toFixed(0)}` : ""}
                  </span>
                  <StressPill
                    status={data.monotonyStatus!}
                    label={data.monotonyStatus === "alert" ? "Alerta" : "Atenção"}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. VO2 Max + estado Garmin — informação de rodapé, não protagonista */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
          <span className="text-slate-500">
            VO2 Max <span className="font-medium text-slate-300">{data.vo2Max}</span>
          </span>
          <span className="text-slate-500">
            Garmin: <span className="font-medium text-slate-300">{statusLabel}</span>
          </span>
        </div>
      </div>
    </Card>
  );
}
