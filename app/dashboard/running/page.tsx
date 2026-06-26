import { DashboardNav } from "@/components/dashboard/nav";
import { MonthlyTrendChart, type DailyTrendPoint } from "@/components/dashboard/monthly-trend-chart";
import { RecentActivitiesList, type RecentActivity } from "@/components/dashboard/recent-activities-list";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

function roundTo(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

async function loadMonthly(service: Awaited<ReturnType<typeof getFreddyDataService>>): Promise<{ data: DailyTrendPoint[]; isReal: boolean; error?: string }> {
  const mock: DailyTrendPoint[] = [2,2,5,9,8,7,7,6,2,9,8,7,6,6,5,4,8,9,5,7,8,6,5,9,8,7,6,5,9,8].map((km, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), distanceKm: km, durationH: roundTo(km / 10, 1), caloriesKcal: Math.round(km * 65) };
  });
  try {
    const monthly = await service.getDailyTrend();
    if (monthly.length === 0) throw new Error("Sem dados mensais no período pedido.");
    return { data: monthly, isReal: true };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

async function loadActivities(service: Awaited<ReturnType<typeof getFreddyDataService>>): Promise<{ data: RecentActivity[]; isReal: boolean; error?: string }> {
  const mock: RecentActivity[] = [
    { date: "2026-06-24", distanceKm: 12.3, durationSec: 4009, paceMinPerKm: 5.45, elevationGainM: 171 },
    { date: "2026-06-23", distanceKm: 11.3, durationSec: 3262, paceMinPerKm: 4.82, elevationGainM: 40 },
    { date: "2026-06-21", distanceKm: 10.1, durationSec: 2406, paceMinPerKm: 3.98, elevationGainM: 114 },
  ];
  try {
    const activities = await service.getRecentActivities(30);
    return { data: activities, isReal: true };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

export default async function RunningPage() {
  let service: Awaited<ReturnType<typeof getFreddyDataService>> | null = null;
  let connectError: string | undefined;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    connectError = String(err);
  }

  const mockMonthly: DailyTrendPoint[] = [2,2,5,9,8,7,7,6,2,9,8,7,6,6,5,4,8,9,5,7,8,6,5,9,8,7,6,5,9,8].map((km, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), distanceKm: km, durationH: roundTo(km / 10, 1), caloriesKcal: Math.round(km * 65) };
  });
  const mockActivities: RecentActivity[] = [
    { date: "2026-06-24", distanceKm: 12.3, durationSec: 4009, paceMinPerKm: 5.45, elevationGainM: 171 },
    { date: "2026-06-23", distanceKm: 11.3, durationSec: 3262, paceMinPerKm: 4.82, elevationGainM: 40 },
    { date: "2026-06-21", distanceKm: 10.1, durationSec: 2406, paceMinPerKm: 3.98, elevationGainM: 114 },
  ];

  const [monthlyResult, activitiesResult] = service
    ? await Promise.all([loadMonthly(service), loadActivities(service)])
    : [
        { data: mockMonthly, isReal: false, error: connectError },
        { data: mockActivities, isReal: false, error: connectError },
      ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Corrida</h2>

        <MonthlyTrendChart data={monthlyResult.data} />
        {monthlyResult.isReal ? (
          <p className="text-[11px] text-emerald-500">● dados reais (Freddy)</p>
        ) : (
          <p className="text-[11px] text-amber-500" title={monthlyResult.error}>
            ● dados de exemplo {monthlyResult.error ? `(${monthlyResult.error.slice(0, 80)}…)` : ""}
          </p>
        )}

        <RecentActivitiesList activities={activitiesResult.data} />
        {activitiesResult.isReal ? (
          <p className="text-[11px] text-emerald-500">● dados reais (Freddy)</p>
        ) : (
          <p className="text-[11px] text-amber-500" title={activitiesResult.error}>
            ● dados de exemplo {activitiesResult.error ? `(${activitiesResult.error.slice(0, 80)}…)` : ""}
          </p>
        )}
      </main>
    </div>
  );
}
