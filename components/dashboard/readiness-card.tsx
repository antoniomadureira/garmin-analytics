import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export interface ReadinessSignal {
  label: string;
  status: "bom" | "ok" | "atencao";
  detail: string;
}

export interface ReadinessCardData {
  compositeScore: number | null;
  recommendation: string;
  /** [Certo] Classificação vinda do serviço composto — fonte única, nunca reclassificar localmente. */
  level: "green" | "yellow" | "red" | "unknown";
  signals: ReadinessSignal[];
  garminScore: number | null;
  garminLevel: string;
  garminStaleDaysAgo: number | null;
  /** Valor numérico do sono (0-100), extraído do sinal "Sono" — conveniência para outros blocos (ex: StatTile "Condição Atual"). */
  sleepScoreValue: number | null;
}

const STATUS_COLOR: Record<ReadinessSignal["status"], string> = {
  bom: "#34d399",
  ok: "#fbbf24",
  atencao: "#f87171",
};
const STATUS_LABEL: Record<ReadinessSignal["status"], string> = {
  bom: "Bom",
  ok: "Razoável",
  atencao: "Atenção",
};

function scoreTone(score: number | null): "emerald" | "amber" | "red" | "cyan" {
  if (score === null) return "cyan";
  if (score >= 75) return "emerald";
  if (score >= 55) return "amber";
  return "red";
}

export function ReadinessCard({ data }: { data: ReadinessCardData }) {
  const tone = scoreTone(data.compositeScore);
  const hex = tone === "emerald" ? "#34d399" : tone === "amber" ? "#fbbf24" : tone === "red" ? "#f87171" : "#22d3ee";

  return (
    <Card glow={tone} className="flex-1 border-2" style={{ borderColor: `${hex}55`, boxShadow: `0 0 24px -8px ${hex}` }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Condição para Treinar Hoje</span>
        {data.compositeScore !== null && (
          <StatusBadge label={data.compositeScore >= 75 ? "Bom" : data.compositeScore >= 55 ? "Misto" : "Cuidado"} tone={tone} />
        )}
      </div>

      <div className="flex items-center gap-5">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${hex} ${(data.compositeScore ?? 0) * 3.6}deg, #1e293b 0deg)` }}
        >
          <div className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full bg-slate-950">
            <span className="text-2xl font-bold leading-none" style={{ color: hex }}>
              {data.compositeScore ?? "—"}
            </span>
            <span className="text-[9px] text-slate-500">composto</span>
          </div>
        </div>
        <p className="text-sm text-slate-300">{data.recommendation}</p>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-slate-800 pt-3">
        {data.signals.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s.status] }} />
              {s.label}
            </span>
            <span className="text-slate-300">
              {s.detail} <span style={{ color: STATUS_COLOR[s.status] }}>· {STATUS_LABEL[s.status]}</span>
            </span>
          </div>
        ))}
        {data.signals.length === 0 && <p className="text-xs text-slate-500">Sem sinais frescos disponíveis.</p>}
      </div>

      <div className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-500">
        Training Readiness Garmin: {data.garminScore ?? "—"}/100 ({data.garminLevel})
        {!!data.garminStaleDaysAgo && data.garminStaleDaysAgo > 1 && ` — desatualizado há ${data.garminStaleDaysAgo} dias`}
      </div>
    </Card>
  );
}
