import { Card, CardTitle } from "@/components/ui/card";
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

export function ReadinessCard({ data }: { data: ReadinessCardData }) {
  const tone = LEVEL_TONE[data.level] ?? "cyan";
  return (
    <Card glow={tone} className="flex-1">
      <CardTitle>Preparação para Treino</CardTitle>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-4xl font-semibold text-slate-100">{data.score}</div>
          <div className="text-xs text-slate-500">de 100</div>
        </div>
        <StatusBadge label={data.level} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-slate-300">{data.feedbackShort}</p>
      {!!data.staleDaysAgo && data.staleDaysAgo > 1 && (
        <p className="mt-1 text-[11px] text-amber-500">
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
