export const dynamic = "force-dynamic";

import { Moon, Clock, Activity } from "lucide-react";
import { humanizeError } from "@/lib/utils/error-message";
import { DashboardNav } from "@/components/dashboard/nav";
import { StatTile } from "@/components/ui/stat-tile";
import { TrendLineChart } from "@/components/dashboard/trend-line-chart";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function weekdayPt(isoDate: string): string {
  return WEEKDAY_PT[new Date(`${isoDate}T00:00:00`).getDay()];
}
function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function sleepHmTick(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

interface SleepPageData {
  scoreYesterday: number | null;
  durationYesterday: number; // segundos
  scoreAvg7d: number | null;
  scoreTrend: { label: string; score: number | null }[];
  durationTrend: { label: string; hours: number | null }[];
}

async function loadSleep(): Promise<{ data: SleepPageData; isReal: boolean; error?: string }> {
  const mock: SleepPageData = {
    scoreYesterday: 57,
    durationYesterday: 7 * 3600 + 31 * 60,
    scoreAvg7d: 69,
    scoreTrend: [
      { label: "Sex", score: 55 },
      { label: "Sáb", score: 70 },
      { label: "Dom", score: 75 },
      { label: "Seg", score: 76 },
      { label: "Ter", score: 78 },
      { label: "Qua", score: 72 },
      { label: "Qui", score: 57 },
    ],
    durationTrend: [
      { label: "Sex", hours: 6.6 },
      { label: "Sáb", hours: 8.1 },
      { label: "Dom", hours: 6.9 },
      { label: "Seg", hours: 7.6 },
      { label: "Ter", hours: 7.7 },
      { label: "Qua", hours: 7.0 },
      { label: "Qui", hours: 7.5 },
    ],
  };

  try {
    const service = await getFreddyDataService();
    const nights = await service.getSleepSummary(7);
    if (nights.length === 0) throw new Error("Sem registos de sono no período pedido.");
    const sorted = [...nights].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = sorted[sorted.length - 1];
    const scores = sorted.map((n) => n.overallScore).filter((s): s is number => s !== null);
    const scoreAvg7d = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return {
      data: {
        scoreYesterday: latest.overallScore,
        durationYesterday: latest.durationSec,
        scoreAvg7d,
        scoreTrend: sorted.map((n) => ({ label: weekdayPt(n.date), score: n.overallScore })),
        durationTrend: sorted.map((n) => ({ label: weekdayPt(n.date), hours: Math.round((n.durationSec / 3600) * 10) / 10 })),
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: humanizeError(err) };
  }
}

export default async function SleepPage() {
  const { data, isReal, error } = await loadSleep();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Sono</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            icon={<Moon size={14} />}
            label="Score Sono"
            value={data.scoreYesterday}
            unit="/100"
            sublabel="Ontem"
            accent="#a78bfa"
          />
          <StatTile
            icon={<Clock size={14} />}
            label="Duração Total"
            value={formatHm(data.durationYesterday)}
            sublabel="Ontem"
            accent="#e2e8f0"
          />
          <StatTile
            icon={<Activity size={14} />}
            label="Score Médio"
            value={data.scoreAvg7d}
            unit="/100"
            sublabel="7 dias"
            accent="#22d3ee"
          />
        </div>

        <TrendLineChart
          title="Score de Sono — Tendência"
          data={data.scoreTrend}
          series={[{ key: "score", color: "#a78bfa", label: "Score" }]}
          yDomain={[0, 100]}
        />

        <TrendLineChart
          title="Duração de Sono — Semana"
          data={data.durationTrend}
          series={[{ key: "hours", color: "#22d3ee", label: "Duração" }]}
          yDomain={[0, 12]}
          tickFormatter={sleepHmTick}
        />

        <div className="flex justify-end"><DataFreshnessDot isReal={isReal} error={error} /></div>
      </main>
    </div>
  );
}
