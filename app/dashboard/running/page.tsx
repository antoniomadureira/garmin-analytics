import { DashboardNav } from "@/components/dashboard/nav";
import { MonthlyTrendChart, type MonthlyTrendPoint } from "@/components/dashboard/monthly-trend-chart";
import { RecentActivitiesList, type RecentActivity } from "@/components/dashboard/recent-activities-list";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

async function loadRunningPage(): Promise<{
  monthly: MonthlyTrendPoint[];
  activities: RecentActivity[];
  isReal: boolean;
  error?: string;
}> {
  const mockMonthly: MonthlyTrendPoint[] = [
    { month: "2026-01", distanceKm: 174, durationH: 14.6, caloriesKcal: 11200 },
    { month: "2026-02", distanceKm: 230, durationH: 19.1, caloriesKcal: 14800 },
    { month: "2026-03", distanceKm: 348, durationH: 28.4, caloriesKcal: 22300 },
    { month: "2026-04", distanceKm: 261, durationH: 21.2, caloriesKcal: 16700 },
    { month: "2026-05", distanceKm: 303, durationH: 24.8, caloriesKcal: 19400 },
    { month: "2026-06", distanceKm: 174, durationH: 14.1, caloriesKcal: 11100 },
  ];
  const mockActivities: RecentActivity[] = [
    { date: "2026-06-24", distanceKm: 12.3, durationSec: 4009, paceMinPerKm: 5.45, elevationGainM: 171 },
    { date: "2026-06-23", distanceKm: 11.3, durationSec: 3262, paceMinPerKm: 4.82, elevationGainM: 40 },
    { date: "2026-06-21", distanceKm: 10.1, durationSec: 2406, paceMinPerKm: 3.98, elevationGainM: 114 },
  ];

  try {
    const service = await getFreddyDataService();
    const [monthly, activities] = await Promise.all([service.getMonthlyTrend(), service.getRecentActivities(30)]);
    if (monthly.length === 0) throw new Error("Sem dados mensais no período pedido.");
    return { monthly, activities, isReal: true };
  } catch (err) {
    return { monthly: mockMonthly, activities: mockActivities, isReal: false, error: String(err) };
  }
}

export default async function RunningPage() {
  const { monthly, activities, isReal, error } = await loadRunningPage();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Corrida</h2>

        <MonthlyTrendChart data={monthly} />
        <RecentActivitiesList activities={activities} />

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
