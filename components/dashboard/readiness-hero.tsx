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

/**
 * Layout v2 (mockup aprovado no chat, 2026-07-06):
 *  - anel compacto (92px) com score dentro, veredicto ao lado;
 *  - sinais em linhas de LARGURA TOTAL por baixo (label esq., valor+delta
 *    à direita numa só linha) — antes estavam espremidos na coluna direita;
 *  - faixa ambiental numa linha única com ícone SVG (sem emoji);
 *  - header em sentence case, timestamp à direita.
 * Toda a lógica de dados (severidades, deltas, staleness) é a existente —
 * este ficheiro só muda apresentação.
 */

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
  const size = 92;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * circ;
  const colors = { green: "#34d399", yellow: "#fbbf24", red: "#f87171" };
  const color = colors[tone];
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
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
        <div className="text-2xl font-semibold leading-none text-slate-100">{score}</div>
        <div className="mt-0.5 text-[10px] text-slate-500">/100</div>
      </div>
    </div>
  );
}

function EnvIcon({ level }: { level: "ok" | "caution" | "warning" }) {
  // Vento/ar estilizado — herda a cor do texto da faixa via currentColor.
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      aria-hidden="true" className="shrink-0"
    >
      <path d="M4 8h9a3 3 0 1 0-3-3" />
      <path d="M3 12h12a3 3 0 1 1-3 3" />
      <path d="M4 16h6" />
      {level === "warning" && <circle cx="19" cy="18" r="1.5" fill="currentColor" stroke="none" />}
    </svg>
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
    <div className="flex items-baseline justify-between border-b border-slate-800/60 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right">
        <span className={`text-sm font-semibold ${valueColor}`}>{value ?? "—"}</span>
        {hasDelta && isAtBaseline && (
          <span className="ml-2 text-[11px] text-slate-600">na média</span>
        )}
        {hasDelta && !isAtBaseline && (
          <span className={`ml-2 text-xs ${deltaColor}`}>
            {(delta ?? 0) > 0 ? "+" : ""}{delta}{deltaUnit} vs média
          </span>
        )}
        {subtext && (
          <span className="block text-[11px] leading-tight text-slate-500">{subtext}</span>
        )}
      </span>
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

  const borderColor =
    tone === "green" ? "border-emerald-900/50" : tone === "yellow" ? "border-amber-900/50" : "border-red-900/50";

  // Faixa ambiental: fundo segue o pior nível (ok = sem fundo)
  const envBg =
    weather?.level === "warning" ? "bg-red-950/40 text-red-300" :
    weather?.level === "caution" ? "bg-amber-950/30 text-amber-300" :
    "text-slate-500";
  const hasEnvData = weather && (weather.tempNowC !== undefined || weather.aqi != null || weather.message);

  // Linha ambiental única: "20° agora · máx 21° · AQI 53 — mensagem"
  const envLine = (() => {
    if (!hasEnvData) return null;
    const parts: string[] = [];
    if (weather!.tempNowC !== undefined) parts.push(`${weather!.tempNowC}° agora · máx ${weather!.tempMaxC}°`);
    if (weather!.aqi != null) parts.push(`AQI ${weather!.aqi}`);
    const head = parts.join(" · ");
    return weather!.message ? `${head} — ${weather!.message}` : head;
  })();

  return (
    <div className={`rounded-2xl border ${borderColor} bg-slate-900/60 p-5 shadow-lg`}>
      {/* Topo: label + timestamp */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">Prontidão diária</p>
        {lastDataLabel && (
          <span className="text-xs text-slate-600">dados de {lastDataLabel}</span>
        )}
      </div>

      {/* Anel + veredicto lado a lado */}
      <div className="mb-3 flex items-center gap-5">
        <ScoreRing score={score} tone={tone} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-100">{verdict.title}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{verdict.subtitle}</p>
        </div>
      </div>

      {/* Sinais em largura total */}
      <div className="border-t border-slate-800/60">
        <Signal
          label="HRV"
          value={recovery.hrv ? `${recovery.hrv} ms` : null}
          valueSeverity={hrvDelta !== null ? hrvSeverity(hrvDelta) : undefined}
          delta={hrvDelta}
          deltaUnit="%"
          invertDelta={false}
        />
        <Signal
          label="FC repouso"
          value={recovery.restingHr ? `${recovery.restingHr} bpm` : null}
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
          label="Forma (TSB)"
          value={load.tsb !== null ? `${load.tsb > 0 ? "+" : ""}${load.tsb}` : null}
          valueSeverity={load.tsb !== null ? tsbSeverity(load.tsb) : undefined}
          subtext={
            load.ctl !== null && load.atl !== null
              ? `CTL ${load.ctl.toFixed(0)} · ATL ${load.atl.toFixed(0)}`
              : undefined
          }
        />
      </div>

      {/* Faixa ambiental unificada: linha única com ícone */}
      {envLine && (
        <div className={`mt-3 flex items-start gap-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${envBg}`}>
          <EnvIcon level={weather!.level} />
          <span className="min-w-0">{envLine}</span>
        </div>
      )}

      {readiness.garminStaleDaysAgo && readiness.garminStaleDaysAgo > 2 && (
        <p className="mt-2 text-[10px] text-slate-600">
          Training Readiness Garmin com {readiness.garminStaleDaysAgo}d de atraso — score baseado em sinais do Intervals.icu.
        </p>
      )}
    </div>
  );
}
