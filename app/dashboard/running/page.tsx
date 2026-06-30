export const dynamic = "force-dynamic";
export const maxDuration = 60; // [Certo] Vercel Hobby corta funções aos 10s por defeito — confirmado como causa provável do "ano anterior em falta" (a chamada mais pesada pode estar a ser cortada a meio e a cair silenciosamente no fallback). 60s é o máximo permitido no Hobby sem mudar de plano.

import { Suspense } from "react";
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
import { getPersonalRecords, type StravaLabRecord } from "@/lib/strava-lab/client";
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
 * [Certo] Cada bloco abaixo é um Server Component async PRÓPRIO, dentro
 * do seu <Suspense>. Antes, a página esperava por Promise.all(3 cargas)
 * antes de mostrar QUALQUER COISA — o gráfico rápido (2 chamadas) ficava
 * bloqueado pelas estatísticas lentas (até 11 chamadas em lotes) e pelos
 * recordes Strava (até 5 chamadas). Agora cada secção aparece assim que
 * estiver pronta, sem esperar pelas outras — LCP deve melhorar bastante
 * porque o primeiro conteúdo útil (o gráfico) já não depende do mais lento.
 */
async function MonthlySection() {
  let service: Awaited<ReturnType<typeof getFreddyDataService>> | null = null;
  let connectError: string | undefined;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    connectError = String(err);
  }
  if (!service) {
    return (
      <>
        <MonthlyTrendChart data={MOCK_MONTHLY} />
        <div className="flex justify-end"><DataFreshnessDot isReal={false} error={connectError} /></div>
      </>
    );
  }
  try {
    const monthly = await service.getDailyTrend();
    if (monthly.length === 0) throw new Error("Sem dados mensais no período pedido.");
    return (
      <>
        <MonthlyTrendChart data={monthly} />
        <div className="flex justify-end"><DataFreshnessDot isReal={true} /></div>
      </>
    );
  } catch (err) {
    return (
      <>
        <MonthlyTrendChart data={MOCK_MONTHLY} />
        <div className="flex justify-end"><DataFreshnessDot isReal={false} error={String(err)} /></div>
      </>
    );
  }
}

async function StatsSection() {
  let service: Awaited<ReturnType<typeof getFreddyDataService>> | null = null;
  let connectError: string | undefined;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    connectError = String(err);
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
      error = String(err);
    }
  }
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
        <div className="flex justify-end"><DataFreshnessDot isReal={false} error={String(err)} /></div>
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
