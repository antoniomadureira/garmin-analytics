export const dynamic = "force-dynamic";
export const maxDuration = 60; // [Certo] Vercel Hobby corta funções aos 10s por defeito — confirmado como causa provável do "ano anterior em falta" (a chamada mais pesada pode estar a ser cortada a meio e a cair silenciosamente no fallback). 60s é o máximo permitido no Hobby sem mudar de plano.

import { Suspense } from "react";
import { humanizeError } from "@/lib/utils/error-message";
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
import { ChartSkeleton } from "@/components/dashboard/running-skeleton";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { getPersonalRecords, getShoesAndActivities, getAthleteRunTotals, type StravaLabRecord, type StravaLabActivity } from "@/lib/strava-lab/client";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";

function roundTo(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

const MOCK_MONTHLY: DailyTrendPoint[] = [2,2,5,9,8,7,7,6,2,9,8,7,6,6,5,4,8,9,5,7,8,6,5,9,8,7,6,5,9,8].map((km, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return { date: d.toISOString().slice(0, 10), distanceKm: km, durationH: roundTo(km / 10, 1), caloriesKcal: Math.round(km * 65) };
});

const MOCK_STATS: RunningStatsData = {
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

const MOCK_RECORDS: StravaLabRecord[] = [
  { label: "5 km", distanceKm: 5, durationSec: 1085, date: "2026-06-21", name: "Corrida de exemplo", paceMinPerKm: 3.62 },
  { label: "10 km", distanceKm: 10, durationSec: 2271, date: "2026-05-10", name: "Corrida de exemplo", paceMinPerKm: 3.78 },
];

/**
 * [Provável] Fallback quando o Freddy falha: constrói tendência diária
 * a partir das atividades Strava (últimas 30, formato já disponível).
 * Menos completo (sem dados históricos além das 30 mais recentes, sem
 * calorias reais), mas mostra algo útil em vez de dados de exemplo.
 */
function stravaActivitiesToDailyTrend(activities: StravaLabActivity[]): DailyTrendPoint[] {
  const byDate = new Map<string, { km: number; sec: number }>();
  for (const a of activities) {
    const prev = byDate.get(a.date) ?? { km: 0, sec: 0 };
    byDate.set(a.date, { km: prev.km + a.distanceKm, sec: prev.sec + a.durationSec });
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({
      date,
      distanceKm: roundTo(v.km, 2),
      durationH: roundTo(v.sec / 3600, 2),
      caloriesKcal: 0,
    }));
}

function stravaActivitiesToStats(activities: StravaLabActivity[]): RunningStatsData {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
  const ytdStr = `${today.getFullYear()}-01-01`;

  const thisWeekKm = activities.filter((a) => a.date >= weekStartStr).reduce((s, a) => s + a.distanceKm, 0);
  const lastWeekKm = activities.filter((a) => a.date >= lastWeekStartStr && a.date < weekStartStr).reduce((s, a) => s + a.distanceKm, 0);
  const ytdKm = activities.filter((a) => a.date >= ytdStr).reduce((s, a) => s + a.distanceKm, 0);

  // Agregar por semana para os últimos 18 blocos
  const weeklyMap = new Map<string, number>();
  for (const a of activities) {
    const d = new Date(`${a.date}T00:00:00`);
    d.setDate(d.getDate() - d.getDay());
    const wk = d.toISOString().slice(0, 10);
    weeklyMap.set(wk, (weeklyMap.get(wk) ?? 0) + a.distanceKm);
  }
  const weeklyVolume = [...weeklyMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-18)
    .map(([wk, km], i) => ({ weekLabel: `S${i + 1}`, km: roundTo(km, 1) }));
  const avgWeekKm = weeklyVolume.length ? roundTo(weeklyVolume.reduce((s, w) => s + w.km, 0) / weeklyVolume.length, 1) : 0;
  const bestWeekKm = weeklyVolume.length ? Math.max(...weeklyVolume.map((w) => w.km)) : 0;

  // Mensal
  const monthlyMap = new Map<string, number>();
  for (const a of activities) {
    const m = a.date.slice(0, 7);
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + a.distanceKm);
  }
  const monthlyVolume = [...monthlyMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, km]) => ({ month, km: roundTo(km, 1) }));

  const weeklyRunCount = weeklyVolume.map((w, i) => ({ weekLabel: w.weekLabel, count: activities.filter((a) => {
    const d = new Date(`${a.date}T00:00:00`);
    d.setDate(d.getDate() - d.getDay());
    return `S${i + 1}` === w.weekLabel;
  }).length }));

  return {
    thisWeekKm: roundTo(thisWeekKm, 1),
    lastWeekKm: roundTo(lastWeekKm, 1),
    avgWeekKm,
    bestWeekKm: roundTo(bestWeekKm, 1),
    totalYtdKm: roundTo(ytdKm, 1),
    totalAllTimeKm: roundTo(activities.reduce((s, a) => s + a.distanceKm, 0), 1),
    weeklyVolume,
    monthlyVolume,
    weeklyRunCount,
    weeklyElevation: weeklyVolume.map((w) => ({ weekLabel: w.weekLabel, m: 0 })),
  };
}

/**
 * [Certo] Cada bloco abaixo é um Server Component async PRÓPRIO, dentro
 * do seu Suspense. Cada um tenta o Freddy primeiro; se falhar, tenta
 * o Strava como fallback antes de cair nos dados de exemplo.
 */
async function MonthlySection() {
  let service: Awaited<ReturnType<typeof getFreddyDataService>> | null = null;
  let connectError: string | undefined;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    connectError = humanizeError(err);
  }
  if (service) {
    try {
      const monthly = await service.getDailyTrend();
      if (monthly.length === 0) throw new Error("Sem dados mensais.");
      return (<><MonthlyTrendChart data={monthly} /><div className="flex justify-end"><DataFreshnessDot isReal={true} /></div></>);
    } catch (err) { connectError = humanizeError(err); }
  }
  // Fallback Strava
  try {
    const { activities } = await getShoesAndActivities();
    const stravaData = stravaActivitiesToDailyTrend(activities);
    if (stravaData.length > 0) return (
      <><MonthlyTrendChart data={stravaData} /><div className="flex justify-end"><DataFreshnessDot isReal={false} error={`${connectError ?? ""} · A mostrar dados Strava (últimas 30 corridas).`} /></div></>
    );
  } catch { /* sem Strava */ }
  return (<><MonthlyTrendChart data={MOCK_MONTHLY} /><div className="flex justify-end"><DataFreshnessDot isReal={false} error={connectError} /></div></>);
}

async function StatsSection() {
  let service: Awaited<ReturnType<typeof getFreddyDataService>> | null = null;
  let connectError: string | undefined;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    connectError = humanizeError(err);
  }
  let stats = MOCK_STATS;
  let isReal = false;
  let error = connectError;
  if (service) {
    try {
      stats = await service.getRunningStatsOverview();
      isReal = true;
      error = undefined;
    } catch (err) {
      error = humanizeError(err);
    }
  }
  // Fallback Strava para estatísticas
  if (!isReal) {
    try {
      const { activities } = await getShoesAndActivities();
      if (activities.length > 0) {
        stats = stravaActivitiesToStats(activities);
        error = `${error ?? ""} · Estatísticas calculadas a partir do Strava (últimas 30 corridas, sem histórico completo).`.trim();
      }
    } catch { /* sem Strava */ }
  }

  // [Certo] Total Histórico SEMPRE do endpoint agregado do Strava quando
  // disponível — é o total real desde que o utilizador começou a correr
  // (confirmado pelo próprio), calculado pelo Strava sem paginação. O
  // Garmin/Freddy só tem dados desde que usa o relógio, e a paginação
  // strava-lab só cobre 1000 atividades — ambas as fontes ficam aquém.
  try {
    const totals = await getAthleteRunTotals();
    if (totals.allTimeKm > 0) {
      stats = { ...stats, totalAllTimeKm: totals.allTimeKm };
    }
  } catch { /* mantém o total da fonte anterior */ }
  return (
    <>
      <RunningStatsTiles data={stats} />
      <WeeklyVolumeChart data={stats.weeklyVolume} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MonthlyVolumeMiniChart data={stats.monthlyVolume} />
        <WeeklyRunCountMiniChart data={stats.weeklyRunCount} />
      </div>
      <WeeklyElevationChart data={stats.weeklyElevation} />
      <div className="flex justify-end"><DataFreshnessDot isReal={isReal} error={error} /></div>
    </>
  );
}

async function RecordsSection() {
  try {
    const records = await getPersonalRecords();
    if (records.length === 0) throw new Error("Sem recordes calculáveis a partir das atividades Strava.");
    return (
      <>
        <PersonalRecordsPanel records={records} />
        <div className="flex justify-end"><DataFreshnessDot isReal={true} /></div>
      </>
    );
  } catch (err) {
    return (
      <>
        <PersonalRecordsPanel records={MOCK_RECORDS} />
        <div className="flex justify-end"><DataFreshnessDot isReal={false} error={humanizeError(err)} /></div>
      </>
    );
  }
}

export default function RunningPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Performance</h2>

        <Suspense fallback={<ChartSkeleton height={340} />}>
          <MonthlySection />
        </Suspense>

        <Suspense fallback={<ChartSkeleton height={520} />}>
          <StatsSection />
        </Suspense>

        <Suspense fallback={<ChartSkeleton height={220} />}>
          <RecordsSection />
        </Suspense>
      </main>
    </div>
  );
}
