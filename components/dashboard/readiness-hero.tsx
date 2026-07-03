"use client";

import type { ReadinessCardData } from "@/components/dashboard/readiness-card";
import type { TrainingLoadCardData } from "@/components/dashboard/training-load-card";
import type { RecoveryCardData } from "@/components/dashboard/recovery-card";

interface HeroProps {
  readiness: ReadinessCardData;
  load: TrainingLoadCardData;
  recovery: RecoveryCardData;
  weather?: { level: "ok" | "caution" | "warning"; message: string | null } | null;
}

function ScoreRing({ score, tone }: { score: number; tone: "green" | "yellow" | "red" }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * circ;
  const colors = { green: "#34d399", yellow: "#fbbf24", red: "#f87171" };
  const color = colors[tone];
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold leading-none" style={{ color }}>{score}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

function Signal({ label, value, delta, deltaUnit, invertDelta = false }: {
  label: string; value: string | null;
  delta?: number | null; deltaUnit?: string; invertDelta?: boolean;
}) {
  const hasDelta = delta !== null && delta !== undefined;
  // [Certo] Delta ~0 significa "exactamente na tua média de 30 dias" —
  // mostrar "0bpm" esbatido era confuso (parecia dado em falta). Agora:
  // |delta| < 1 mostra "na média" discreto; caso contrário o delta real.
  const isAtBaseline = hasDelta && Math.abs(delta ?? 0) < 1;
  const good = invertDelta ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
  const deltaColor = good ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200">{value ?? "—"}</span>
        {hasDelta && isAtBaseline && (
          <span className="text-[10px] text-slate-600">na média</span>
        )}
        {hasDelta && !isAtBaseline && (
          <span className={`text-[11px] ${deltaColor}`}>
            {(delta ?? 0) > 0 ? "+" : ""}{delta}{deltaUnit} vs média
          </span>
        )}
      </div>
    </div>
  );
}

export function ReadinessHero({ readiness, load, recovery, weather }: HeroProps) {
  const score = readiness.compositeScore ?? readiness.garminScore ?? 50;
  const tone: "green" | "yellow" | "red" = score >= 70 ? "green" : score >= 50 ? "yellow" : "red";

  const verdicts: Record<string, { title: string; subtitle: string }> = {
    green: {
      title: "Pronto para treinar",
      subtitle: "Janela favorável — séries, limiar ou volume são adequados hoje.",
    },
    yellow: {
      title: "Treino moderado",
      subtitle: "Sinais mistos — prefira ritmo controlado e evite esforço máximo.",
    },
    red: {
      title: "Recupera hoje",
      subtitle: "Sinais de fadiga acumulada — descanso ativo ou sessão muito leve.",
    },
  };
  const verdict = verdicts[tone];

  // Deltas HRV e FC repouso vs baseline
  const hrvDelta = recovery.hrv && recovery.hrvBaseline
    ? Math.round(recovery.hrv - recovery.hrvBaseline) : null;
  const rhrDelta = recovery.restingHr && recovery.restingHrBaseline
    ? Math.round(recovery.restingHr - recovery.restingHrBaseline) : null;

  const tsbColor = load.tsb === null ? "text-slate-400"
    : load.tsb > 5 ? "text-emerald-400"
    : load.tsb >= -10 ? "text-amber-400"
    : "text-red-400";

  const batteryPeak = recovery.bodyBatteryMax;
  const batteryColor = batteryPeak === null ? "text-slate-400"
    : batteryPeak >= 70 ? "text-emerald-400"
    : batteryPeak >= 45 ? "text-amber-400"
    : "text-red-400";

  const glow = tone === "green" ? "shadow-emerald-950/40" : tone === "yellow" ? "shadow-amber-950/40" : "shadow-red-950/40";
  const borderColor = tone === "green" ? "border-emerald-900/50" : tone === "yellow" ? "border-amber-900/50" : "border-red-900/50";

  return (
    <div className={`rounded-2xl border ${borderColor} bg-slate-900/60 p-5 shadow-lg ${glow}`}>
      <div className="flex items-start gap-6">
        {/* Score ring */}
        <div className="shrink-0">
          <ScoreRing score={score} tone={tone} />
          <p className="mt-1 text-center text-[10px] text-slate-600">Score composto</p>
        </div>

        {/* Verdict + signals */}
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <h3 className="text-lg font-bold text-slate-100">{verdict.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{verdict.subtitle}</p>
          </div>

          <div className="divide-y divide-slate-800/60">
            <Signal
              label="HRV"
              value={recovery.hrv ? `${recovery.hrv}ms` : null}
              delta={hrvDelta}
              deltaUnit="ms"
              invertDelta={false}
            />
            <Signal
              label="FC Repouso"
              value={recovery.restingHr ? `${recovery.restingHr}bpm` : null}
              delta={rhrDelta}
              deltaUnit="bpm"
              invertDelta={true}
            />
            <Signal
              label="Bateria ao acordar"
              value={batteryPeak !== null ? `${batteryPeak}%` : null}
            />
            <Signal
              label={`TSB  (CTL ${load.ctl?.toFixed(0) ?? "—"} / ATL ${load.atl?.toFixed(0) ?? "—"})`}
              value={load.tsb !== null ? `${load.tsb > 0 ? "+" : ""}${load.tsb}` : null}
            />
          </div>

          {weather?.message && (
            <div className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
              weather.level === "warning"
                ? "bg-red-950/40 text-red-300"
                : "bg-amber-950/30 text-amber-300"
            }`}>
              <span className="mt-px">{weather.level === "warning" ? "🥵" : "🌤"}</span>
              <span>{weather.message}</span>
            </div>
          )}

          {readiness.garminStaleDaysAgo && readiness.garminStaleDaysAgo > 2 && (
            <p className="mt-2 text-[10px] text-slate-600">
              Training Readiness Garmin com {readiness.garminStaleDaysAgo}d de atraso — score baseado em sinais do Intervals.icu.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
