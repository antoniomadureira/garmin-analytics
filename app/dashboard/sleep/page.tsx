import { DashboardNav } from "@/components/dashboard/nav";
import { SleepNightCard, type SleepNightCardData } from "@/components/dashboard/sleep-night-card";
import { SleepWeekChart, type SleepWeekPoint } from "@/components/dashboard/sleep-week-chart";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function weekdayPt(isoDate: string): string {
  return WEEKDAY_PT[new Date(`${isoDate}T00:00:00`).getDay()];
}

async function loadSleep(): Promise<{
  night: SleepNightCardData;
  week: SleepWeekPoint[];
  isReal: boolean;
  error?: string;
}> {
  const mockNight: SleepNightCardData = {
    date: "exemplo",
    durationSec: 7 * 3600 + 20 * 60,
    deepSec: 5400,
    lightSec: 14580,
    remSec: 3540,
    awakeSec: 540,
    overallScore: 78,
    feedback: "Bom",
    insight: "Stress durante o sono: Razoável",
  };
  const mockWeek: SleepWeekPoint[] = [
    { day: "Seg", hours: 7.2 },
    { day: "Ter", hours: 6.5 },
    { day: "Qua", hours: 7.8 },
    { day: "Qui", hours: 7.1 },
    { day: "Sex", hours: 6.9 },
    { day: "Sáb", hours: 8.4 },
    { day: "Dom", hours: 7.6 },
  ];

  try {
    const service = await getFreddyDataService();
    const nights = await service.getSleepSummary(7);
    if (nights.length === 0) throw new Error("Sem registos de sono no período pedido.");

    const sorted = [...nights].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = sorted[sorted.length - 1];

    return {
      night: {
        date: latest.date,
        durationSec: latest.durationSec,
        deepSec: latest.deepSec,
        lightSec: latest.lightSec,
        remSec: latest.remSec,
        awakeSec: latest.awakeSec,
        overallScore: latest.overallScore,
        feedback: latest.feedback,
        insight: latest.insight,
      },
      week: sorted.map((n) => ({ day: weekdayPt(n.date), hours: Math.round((n.durationSec / 3600) * 10) / 10 })),
      isReal: true,
    };
  } catch (err) {
    return { night: mockNight, week: mockWeek, isReal: false, error: String(err) };
  }
}

export default async function SleepPage() {
  const result = await loadSleep();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Sono</h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <SleepNightCard data={result.night} />
          <SleepWeekChart data={result.week} />
        </div>

        {result.isReal ? (
          <p className="text-[11px] text-emerald-500">● dados reais (Freddy)</p>
        ) : (
          <p className="text-[11px] text-amber-500" title={result.error}>
            ● dados de exemplo {result.error ? `(${result.error.slice(0, 80)}…)` : ""}
          </p>
        )}
      </main>
    </div>
  );
}
