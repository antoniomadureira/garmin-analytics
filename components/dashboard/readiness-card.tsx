import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export interface ReadinessCardData {
  score: number; // 0-100
  level: string; // ex: "Bom", "Excelente", "Baixo"
  feedbackShort: string;
  sleepScore: number;
  hrvStatusLabel: string; // ex: "Equilibrado", "Baixo"
  acuteLoad: number;
  /** [Certo] trainingReadiness_score tem atraso de sincronização confirmado no Freddy (visto até 5 dias). Null = dado de hoje/ontem, sem aviso necessário. */
  staleDaysAgo?: number | null;
}

const LEVEL_TONE: Record<string, "emerald" | "cyan" | "amber" | "red"> = {
  Excelente: "emerald",
  Bom: "cyan",
  Moderado: "amber",
  Baixo: "red",
};
const TONE_HEX: Record<string, string> = {
  emerald: "#34d399",
  cyan: "#22d3ee",
  amber: "#fbbf24",
  red: "#f87171",
};

export function ReadinessCard({ data }: { data: ReadinessCardData }) {
  const tone = LEVEL_TONE[data.level] ?? "cyan";
  const hex = TONE_HEX[tone];

  return (
    <Card glow={tone} className="flex-1 border-2" style={{ borderColor: `${hex}55`, boxShadow: `0 0 24px -8px ${hex}` }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preparação para Treino</span>
        <StatusBadge label={data.level} tone={tone} />
      </div>

      <div className="flex items-center gap-5">
        {/* Anel de progresso decorativo via conic-gradient — sem SVG/lib extra */}
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${hex} ${data.score * 3.6}deg, #1e293b 0deg)` }}
        >
          <div className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-slate-950">
            <span className="text-3xl font-bold leading-none" style={{ color: hex }}>
              {data.score}
            </span>
            <span className="text-[10px] text-slate-500">de 100</span>
          </div>
        </div>
        <p className="text-sm text-slate-300">{data.feedbackShort}</p>
      </div>

      {!!data.staleDaysAgo && data.staleDaysAgo > 1 && (
        <p className="mt-3 rounded-lg bg-amber-950/40 px-2.5 py-1.5 text-[11px] text-amber-400">
          ⚠ Este dado é de há {data.staleDaysAgo} dias — o Freddy ainda não sincronizou um valor mais recente.
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-center">
        <div>
          <div className="text-xs text-slate-500">Pontuação Sono</div>
          <div className="text-sm font-medium text-slate-200">{data.sleepScore}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">HRV</div>
          <div className="text-sm font-medium text-slate-200">{data.hrvStatusLabel}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Carga Aguda</div>
          <div className="text-sm font-medium text-slate-200">{data.acuteLoad}</div>
        </div>
      </div>
    </Card>
  );
}
