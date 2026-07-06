"use client";

import type { ReadinessCardData } from "@/components/dashboard/readiness-card";
import type { TrainingLoadCardData } from "@/components/dashboard/training-load-card";
import type { RecoveryCardData } from "@/components/dashboard/recovery-card";
import { computeHrvDeltaPct } from "@/lib/utils/hrv";
import {
  type SignalSeverity,
  SEVERITY_TEXT,
  hrvSeverity,
  rhrSeverity,
  bodyBatterySeverity,
  tsbSeverity,
} from "@/lib/ui/signal-severity";

interface HeroProps {
  readiness: ReadinessCardData;
  load: TrainingLoadCardData;
  recovery: RecoveryCardData;
  weather?: {
    level: "ok" | "caution" | "warning";
    message: string | null;
    tempNowC?: number;
    tempMaxC?: number;
    aqi?: number | null;
  } | null;
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

function Signal({
  label, value, valueSeverity, delta, deltaUnit, invertDelta = false, subtext,
}: {
  label: string;
  value: string | null;
  valueSeverity?: SignalSeverity;
  delta?: number | null;
  deltaUnit?: string;
  invertDelta?: boolean;
  subtext?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined;
  // [Certo] Delta ~0 significa "exactamente na tua média de 30 dias" —
  // |delta| < 1 mostra "na média" discreto; caso contrário o delta real.
  const isAtBaseline = hasDelta && Math.abs(delta ?? 0) < 1;
  const good = invertDelta ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
  const deltaColor = good ? "text-emerald-400" : "text-amber-400";
  const valueColor = valueSeverity ? SEVERITY_TEXT[valueSeverity] : "text-slate-200";

  return (
    <div className="flex items-start justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-400 pt-px">{label}</span>
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${valueColor}`}>{value ?? "—"}</span>
          {hasDelta && isAtBaseline && (
            <span className="text-[10px] text-slate-600">na média</span>
          )}
          {hasDelta && !isAtBaseline && (
            <span className={`text-[11px] ${deltaColor}`}>
              {(delta ?? 0) > 0 ? "+" : ""}{delta}{deltaUnit} vs média
            </span>
          )}
        </div>
        {subtext && (
          <span className="text-[11px] text-slate-500">{subtext}</span>
        )}
      </div>
    </div>
  );
}

export function ReadinessHero({ readiness, load, recovery, weather }: HeroProps) {
  const score = readiness.compositeScore ?? readiness.garminScore ?? 50;
  // [Certo] O tone vem do SERVIÇO (fonte única), não de limiares locais.
  const tone: "green" | "yellow" | "red" =
    readiness.level === "green" ? "green" : readiness.level === "red" ? "red" : "yellow";

  const titles: Record<"green" | "yellow" | "red", string> = {
    green: "Pronto para treinar",
    yellow: "Treino moderado",
    red: "Recupera hoje",
  };

  // [Certo] O subtítulo é a recommendation do serviço — fonte única.
  const verdict = { title: titles[tone], subtitle: readiness.recommendation };

  const hrvDelta = recovery.hrv && recovery.hrvBaseline
    ? computeHrvDeltaPct(recovery.hrv, recovery.hrvBaseline) : null;
  const rhrDelta = recovery.restingHr && recovery.restingHrBaseline
    ? Math.round(recovery.restingHr - recovery.restingHrBaseline) : null;
  const batteryPeak = recovery.bodyBatteryMax;

  // Timestamp derivado da última entrada do histórico de wellness (formato MM-DD)
  const lastDataLabel = (() => {
    if (!load.history.length) return null;
    const raw = load.history[load.history.length - 1].date; // "MM-DD"
    const [mm, dd] = raw.split("-").map(Number);
    const today = new Date();
    const dataDate = new Date(today.getFullYear(), mm - 1, dd);
    if (dataDate > today) dataDate.setFullYear(today.getFullYear() - 1);
    const diffDays = Math.round((today.getTime() - dataDate.getTime()) / 86400000);
    if (diffDays === 0) return "hoje";
    if (diffDays === 1) return "ontem";
    return `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}`;
  })();

  const glow = tone === "green" ? "shadow-emerald-950/40" : tone === "yellow" ? "shadow-amber-950/40" : "shadow-red-950/40";
  const borderColor = tone === "green" ? "border-emerald-900/50" : tone === "yellow" ? "border-amber-900/50" : "border-red-900/50";

  // Faixa ambiental: fundo segue o pior nível (ok = sem fundo)
  const envBg =
    weather?.level === "warning" ? "bg-red-950/40 text-red-300" :
    weather?.level === "caution" ? "bg-amber-950/30 text-amber-300" :
    "text-slate-500";
  const envEmoji = weather?.level === "warning" ? "🥵" : weather?.level === "caution" ? "🌤" : null;
  const hasEnvData = weather && (weather.tempNowC !== undefined || weather.aqi != null || weather.message);

  return (
    <div className={`rounded-2xl border ${borderColor} bg-slate-900/60 p-5 shadow-lg ${glow}`}>
      {/* Topo: label + timestamp */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Prontidão Diária</p>
        {lastDataLabel && (
          <span className="text-[10px] text-slate-600">dados de {lastDataLabel}</span>
        )}
      </div>

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
              valueSeverity={hrvDelta !== null ? hrvSeverity(hrvDelta) : undefined}
              delta={hrvDelta}
              deltaUnit="%"
              invertDelta={false}
            />
            <Signal
              label="FC Repouso"
              value={recovery.restingHr ? `${recovery.restingHr}bpm` : null}
              valueSeverity={rhrDelta !== null ? rhrSeverity(rhrDelta) : undefined}
              delta={rhrDelta}
              deltaUnit="bpm"
              invertDelta={true}
            />
            <Signal
              label="Bateria ao acordar"
              value={batteryPeak !== null ? `${batteryPeak}%` : null}
              valueSeverity={batteryPeak !== null ? bodyBatterySeverity(batteryPeak) : undefined}
            />
            <Signal
              label="TSB"
              value={load.tsb !== null ? `${load.tsb > 0 ? "+" : ""}${load.tsb}` : null}
              valueSeverity={load.tsb !== null ? tsbSeverity(load.tsb) : undefined}
              subtext={
                load.ctl !== null && load.atl !== null
                  ? `CTL ${load.ctl.toFixed(0)} / ATL ${load.atl.toFixed(0)}`
                  : undefined
              }
            />
          </div>

          {/* Faixa ambiental unificada: meteo + AQI + alerta num só strip */}
          {hasEnvData && (
            <div className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${envBg}`}>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {envEmoji && <span>{envEmoji}</span>}
                {weather!.tempNowC !== undefined && (
                  <span>agora {weather!.tempNowC}° · máx {weather!.tempMaxC}°</span>
                )}
                {weather!.aqi != null && (
                  <span>· AQI {weather!.aqi}</span>
                )}
                {weather!.message && (
                  <span>· {weather!.message}</span>
                )}
              </div>
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
