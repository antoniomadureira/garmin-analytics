import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export interface SleepNightCardData {
  date: string;
  durationSec: number;
  deepSec: number;
  lightSec: number;
  remSec: number;
  awakeSec: number;
  overallScore: number | null;
  feedback: string | null;
  insight: string | null;
}

function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const SCORE_TONE = (score: number | null): "emerald" | "cyan" | "amber" | "red" => {
  if (score === null) return "cyan";
  if (score >= 80) return "emerald";
  if (score >= 60) return "cyan";
  if (score >= 40) return "amber";
  return "red";
};

const PHASE_COLOR: Record<string, string> = {
  deep: "#34d399",
  light: "#22d3ee",
  rem: "#a78bfa",
  awake: "#475569",
};

export function SleepNightCard({ data }: { data: SleepNightCardData }) {
  const total = data.deepSec + data.lightSec + data.remSec + data.awakeSec || 1;
  const phases = [
    { key: "deep", label: "Sono Profundo", sec: data.deepSec },
    { key: "light", label: "Sono Ligeiro", sec: data.lightSec },
    { key: "rem", label: "REM", sec: data.remSec },
    { key: "awake", label: "Despertos", sec: data.awakeSec },
  ];

  return (
    <Card glow={SCORE_TONE(data.overallScore)}>
      <CardTitle>Sono — Última Noite ({data.date})</CardTitle>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-4xl font-semibold text-slate-100">{formatHm(data.durationSec)}</div>
          <div className="text-xs text-slate-500">duração total</div>
        </div>
        {data.overallScore !== null && (
          <div className="text-right">
            <div className="text-2xl font-semibold text-slate-100">{data.overallScore}</div>
            <div className="text-xs text-slate-500">pontuação</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
        {phases.map((p) => (
          <div
            key={p.key}
            className="h-full"
            style={{ width: `${(p.sec / total) * 100}%`, backgroundColor: PHASE_COLOR[p.key] }}
            title={`${p.label}: ${formatHm(p.sec)}`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {phases.map((p) => (
          <div key={p.key}>
            <div className="text-xs text-slate-500">{p.label}</div>
            <div className="text-sm font-medium text-slate-200">{formatHm(p.sec)}</div>
          </div>
        ))}
      </div>

      {data.feedback && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <StatusBadge label={data.feedback} tone={SCORE_TONE(data.overallScore)} />
        </div>
      )}
      {data.insight && <p className="mt-2 text-xs text-slate-400">{data.insight}</p>}
    </Card>
  );
}
