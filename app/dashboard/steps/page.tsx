import { Footprints, Target, TrendingUp } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { TrendLineChart } from "@/components/dashboard/trend-line-chart";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function weekdayPt(isoDate: string): string {
  return WEEKDAY_PT[new Date(`${isoDate}T00:00:00`).getDay()];
}

interface StepsPageData {
  todaySteps: number | null;
  todayGoal: number | null;
  avgSteps7d: number | null;
  daily: { label: string; steps: number; goal: number | null }[];
}

async function loadSteps(): Promise<{ data: StepsPageData; isReal: boolean; error?: string }> {
  const mock: StepsPageData = {
    todaySteps: 7340,
    todayGoal: 15620,
    avgSteps7d: 9200,
    daily: [
      { label: "Sex", steps: 8200, goal: 10000 },
      { label: "Sáb", steps: 12400, goal: 10000 },
      { label: "Dom", steps: 6100, goal: 10000 },
      { label: "Seg", steps: 9800, goal: 10000 },
      { label: "Ter", steps: 11200, goal: 10000 },
      { label: "Qua", steps: 7900, goal: 10000 },
      { label: "Qui", steps: 7340, goal: 15620 },
    ],
  };
  try {
    const service = await getFreddyDataService();
    const weekly = await service.getStepsWeekly(7);
    if (weekly.daily.length === 0) throw new Error("Sem registos de passos no período pedido.");
    return {
      data: {
        todaySteps: weekly.todaySteps,
        todayGoal: weekly.todayGoal,
        avgSteps7d: weekly.avgSteps7d,
        daily: weekly.daily.map((d) => ({ label: weekdayPt(d.date), steps: d.steps, goal: d.goal })),
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

export default async function StepsPage() {
  const { data, isReal, error } = await loadSteps();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Passos</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile icon={<Footprints size={14} />} label="Passos Hoje" value={data.todaySteps?.toLocaleString("pt-PT") ?? null} sublabel="Hoje" accent="#34d399" />
          <StatTile icon={<Target size={14} />} label="Meta" value={(data.todayGoal ?? 10000).toLocaleString("pt-PT")} sublabel={data.todayGoal ? "Hoje" : "Hoje (padrão)"} accent="#22d3ee" />
          <StatTile icon={<TrendingUp size={14} />} label="Média" value={data.avgSteps7d?.toLocaleString("pt-PT") ?? null} sublabel="7 dias" accent="#a78bfa" />
        </div>

        {(() => {
          // [Certo] uds_dailyStepGoal é a meta real do Garmin (já vinha de getStepsWeekly).
          // [Suposição] 10000 só é usado quando não há meta real disponível.
          const goal = data.todayGoal ?? 10000;
          const steps = data.todaySteps ?? 0;
          const pct = Math.min(100, Math.round((steps / goal) * 100));
          const reached = steps >= goal;
          return (
            <Card>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Objetivo Diário de Passos</span>
                {reached && <span className="text-xs font-medium text-emerald-400">✓ Objetivo atingido!</span>}
              </div>
              <div className="mb-2 text-sm text-slate-300">
                {steps.toLocaleString("pt-PT")} / {goal.toLocaleString("pt-PT")} passos
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Card>
          );
        })()}

        <TrendLineChart
          title="Passos — Últimos 7 Dias"
          data={data.daily.map((d) => ({ label: d.label, steps: d.steps }))}
          series={[{ key: "steps", color: "#34d399", label: "Passos" }]}
        />

        <div className="flex justify-end"><DataFreshnessDot isReal={isReal} error={error} /></div>
      </main>
    </div>
  );
}
