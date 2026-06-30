export const dynamic = "force-dynamic";

import { DashboardNav } from "@/components/dashboard/nav";
import { MonthlyTrendChart, type DailyTrendPoint } from "@/components/dashboard/monthly-trend-chart";
import {
  RunningStatsTiles,
  WeeklyVolumeChart,
  MonthlyVolumeMiniChart,
  WeeklyRunCountMiniChart,
  WeeklyElevationChart,
  type RunningStatsData,
} from "@/components/dashboard/running-stats-charts";
import { PersonalRecordsPanel } from "@/components/dashboard/personal-records-panel";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { getPersonalRecords, type StravaLabRecord } from "@/lib/strava-lab/client";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";

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

async function loadRunningStats(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: RunningStatsData; isReal: boolean; error?: string }> {
  const mock: RunningStatsData = {
    thisWeekKm: 43,
    lastWeekKm: 51,
    avgWeekKm: 63,
    bestWeekKm: 83,
    totalYtdKm: 1609.4,
    totalAllTimeKm: 16142,
    weeklyVolume: Array.from({ length: 18 }, (_, i) => ({ weekLabel: `S${i + 1}`, km: 40 + Math.round(Math.sin(i) * 25) })),
    monthlyVolume: Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String((i % 12) + 1).padStart(2, "0")}`, km: 150 + Math.round(Math.cos(i) * 60) })),
    weeklyRunCount: Array.from({ length: 18 }, (_, i) => ({ weekLabel: `S${i + 1}`, count: 3 + (i % 5) })),
    weeklyElevation: Array.from({ length: 18 }, (_, i) => ({ weekLabel: `S${i + 1}`, m: 400 + Math.round(Math.sin(i) * 300) })),
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const stats = await service.getRunningStatsOverview();
    return { data: stats, isReal: true };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

async function loadRecords(): Promise<{ data: StravaLabRecord[]; isReal: boolean; error?: string }> {
  const mock: StravaLabRecord[] = [
    { label: "5 km", distanceKm: 5, durationSec: 1085, date: "2026-06-21", name: "Corrida de exemplo", paceMinPerKm: 3.62 },
    { label: "10 km", distanceKm: 10, durationSec: 2271, date: "2026-05-10", name: "Corrida de exemplo", paceMinPerKm: 3.78 },
  ];
  try {
    const records = await getPersonalRecords();
    if (records.length === 0) throw new Error("Sem recordes calculáveis a partir das atividades Strava.");
    return { data: records, isReal: true };
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

  const [monthlyResult, statsResult, recordsResult] = service
    ? await Promise.all([loadMonthly(service), loadRunningStats(service, connectError), loadRecords()])
    : [{ data: mockMonthly, isReal: false, error: connectError }, await loadRunningStats(null, connectError), await loadRecords()];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Performance</h2>

        <MonthlyTrendChart data={monthlyResult.data} />
        <div className="flex justify-end"><DataFreshnessDot isReal={monthlyResult.isReal} error={monthlyResult.error} /></div>

        <RunningStatsTiles data={statsResult.data} />

        <WeeklyVolumeChart data={statsResult.data.weeklyVolume} />

        <div className="grid gap-4 sm:grid-cols-2">
          <MonthlyVolumeMiniChart data={statsResult.data.monthlyVolume} />
          <WeeklyRunCountMiniChart data={statsResult.data.weeklyRunCount} />
        </div>

        <WeeklyElevationChart data={statsResult.data.weeklyElevation} />
        <div className="flex justify-end"><DataFreshnessDot isReal={statsResult.isReal} error={statsResult.error} /></div>

        <PersonalRecordsPanel records={recordsResult.data} />
        <div className="flex justify-end"><DataFreshnessDot isReal={recordsResult.isReal} error={recordsResult.error} /></div>
      </main>
    </div>
  );
}
