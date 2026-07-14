export const dynamic = "force-dynamic";

import { Moon, Clock, Activity } from "lucide-react";
import { humanizeError } from "@/lib/utils/error-message";
import { DashboardNav } from "@/components/dashboard/nav";
import { StatTile } from "@/components/ui/stat-tile";
import { TrendLineChart } from "@/components/dashboard/trend-line-chart";
import { SleepHypnogram } from "@/components/dashboard/sleep-hypnogram";
import { Card, CardTitle } from "@/components/ui/card";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { computeSleepAlerts } from "@/lib/analysis/sleep-phases";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import type { SleepPhaseBlock } from "@/lib/freddy/metrics";

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function weekdayPt(isoDate: string): string {
  return WEEKDAY_PT[new Date(`${isoDate}T00:00:00`).getDay()];
}
function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

interface SleepPageData {
  scoreYesterday: number | null;
  durationYesterday: number; // segundos
  scoreAvg7d: number | null;
  scoreTrend: { label: string; score: number | null }[];
  durationTrend: { label: string; hours: number | null }[];
  phaseTrend: { label: string; deepMin: number | null; remMin: number | null }[];
  lastNightPhaseBlocks: SleepPhaseBlock[] | null;
  alerts: string[];
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
    phaseTrend: [
      { label: "Sex", deepMin: 65, remMin: 72 },
      { label: "Sáb", deepMin: 90, remMin: 85 },
      { label: "Dom", deepMin: 80, remMin: 60 },
      { label: "Seg", deepMin: 95, remMin: 70 },
      { label: "Ter", deepMin: 110, remMin: 88 },
      { label: "Qua", deepMin: 75, remMin: 65 },
      { label: "Qui", deepMin: 55, remMin: 50 },
    ],
    lastNightPhaseBlocks: null,
    alerts: [],
  };

  try {
    const service = await getFreddyDataService();
    const nights = await service.getSleepDetail(8);
    if (nights.length === 0) throw new Error("Sem registos de sono no período pedido.");
    const sorted = [...nights].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = sorted[sorted.length - 1];
    const last7 = sorted.slice(-7);
    const scores = last7.map((n) => n.overallScore).filter((s): s is number => s !== null);
    const scoreAvg7d = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const alerts = computeSleepAlerts(nights);

    return {
      data: {
        scoreYesterday: latest.overallScore,
        durationYesterday: latest.durationSec,
        scoreAvg7d,
        scoreTrend: last7.map((n) => ({ label: weekdayPt(n.date), score: n.overallScore })),
        durationTrend: last7.map((n) => ({ label: weekdayPt(n.date), hours: Math.round((n.durationSec / 3600) * 10) / 10 })),
        phaseTrend: last7.map((n) => ({
          label: weekdayPt(n.date),
          deepMin: Math.round(n.deepSec / 60),
          remMin: Math.round(n.remSec / 60),
        })),
        lastNightPhaseBlocks: latest.phaseBlocks,
        alerts,
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
          tickFormat="hoursMinutes"
        />

        {/* Alertas de limiares — texto determinístico, nunca LLM */}
        {data.alerts.length > 0 && (
          <div className="space-y-1.5">
            {data.alerts.map((alert, i) => (
              <p key={i} className="rounded border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-[12px] text-amber-400">
                ⚠ {alert}
              </p>
            ))}
          </div>
        )}

        {/* Hipnograma da última noite */}
        {data.lastNightPhaseBlocks && (
          <Card>
            <CardTitle>Hipnograma — Última Noite</CardTitle>
            <SleepHypnogram blocks={data.lastNightPhaseBlocks} />
          </Card>
        )}

        {/* Tendência de fases — profundo e REM em minutos */}
        <TrendLineChart
          title="Fases do Sono — Semana (min)"
          data={data.phaseTrend}
          series={[
            { key: "deepMin", color: "#3b82f6", label: "Profundo" },
            { key: "remMin", color: "#a78bfa", label: "REM" },
          ]}
          yDomain={[0, 180]}
        />

        <div className="flex justify-end"><DataFreshnessDot isReal={isReal} error={error} /></div>
      </main>
    </div>
  );
}
