import { Footprints, Target, TrendingUp } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardTitle } from "@/components/ui/card";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

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
  const maxSteps = Math.max(...data.daily.map((d) => d.steps), data.todayGoal ?? 0, 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Passos</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile icon={<Footprints size={14} />} label="Passos Hoje" value={data.todaySteps?.toLocaleString("pt-PT") ?? null} sublabel="Hoje" accent="#34d399" />
          <StatTile icon={<Target size={14} />} label="Meta" value={data.todayGoal?.toLocaleString("pt-PT") ?? null} sublabel="Hoje" accent="#22d3ee" />
          <StatTile icon={<TrendingUp size={14} />} label="Média" value={data.avgSteps7d?.toLocaleString("pt-PT") ?? null} sublabel="7 dias" accent="#a78bfa" />
        </div>

        <Card>
          <CardTitle>Passos — Últimos 7 Dias</CardTitle>
          <div className="flex h-44 items-end gap-3">
            {data.daily.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex h-32 w-full items-end justify-center">
                  {d.goal !== null && (
                    <div
                      className="absolute w-full border-t border-dashed border-slate-600"
                      style={{ bottom: `${Math.min((d.goal / maxSteps) * 100, 100)}%` }}
                    />
                  )}
                  <div
                    className={`w-2.5 rounded-full ${d.goal !== null && d.steps >= d.goal ? "bg-emerald-400" : "bg-slate-600"}`}
                    style={{ height: `${Math.max((d.steps / maxSteps) * 100, 3)}%` }}
                    title={`${d.steps.toLocaleString("pt-PT")} passos`}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Linha tracejada = meta do dia. Verde = meta atingida.</p>
        </Card>

        {isReal ? (
          <p className="text-[11px] text-emerald-500">● dados reais (Freddy)</p>
        ) : (
          <p className="text-[11px] text-amber-500" title={error}>
            ● dados de exemplo {error ? `(${error.slice(0, 80)}…)` : ""}
          </p>
        )}
      </main>
    </div>
  );
}
