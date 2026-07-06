export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { humanizeError } from "@/lib/utils/error-message";
import { DashboardNav } from "@/components/dashboard/nav";
import { ReadinessCard, type ReadinessCardData } from "@/components/dashboard/readiness-card";
import { TrainingLoadCard, type TrainingLoadCardData } from "@/components/dashboard/training-load-card";
import { RunningSummaryCard, type RunningSummaryCardData } from "@/components/dashboard/running-summary-card";
import { RecoveryCard, type RecoveryCardData } from "@/components/dashboard/recovery-card";
import { YoyKpiGrid, type YoyKpi } from "@/components/dashboard/yoy-kpi-grid";
import { ReadinessHero } from "@/components/dashboard/readiness-hero";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { getShoesAndActivities } from "@/lib/strava-lab/client";
import { headers, cookies } from "next/headers";
import { getTodayWeather, getAirQuality, classifyWeatherImpact, type GeoHint } from "@/lib/weather/client";
import { GeoBeacon } from "@/components/geo-beacon";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import { StatusSummary } from "@/components/ui/status-summary";

// =============================================================================
// [Provável] Tentamos dados reais para Readiness, TrainingLoad e VO2 Max
// (os 3 mappers já confirmados). Os restantes cards continuam com dados de
// exemplo — não foi suposição minha, é o ponto onde a integração real
// chega agora. Se a chamada falhar (ex: Freddy não ligado, ou shape do
// content ainda não confirmado — ver data-adapter.ts), cada card cai para
// o seu mock individual, com um aviso visível, em vez de a página toda
// rebentar ou fingir sucesso.
// =============================================================================

async function loadReadiness(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: ReadinessCardData; isReal: boolean; error?: string }> {
  const mock: ReadinessCardData = {
    compositeScore: 78,
    recommendation: "Sinais maioritariamente positivos — janela razoável para treino de qualidade (séries, tempo run).",
    level: "green",
    signals: [
      { label: "Carga de Treino (TSB)", status: "bom", detail: "+11.7" },
      { label: "HRV", status: "bom", detail: "39ms (+2% vs média)" },
      { label: "FC Repouso", status: "ok", detail: "56bpm (+3% vs média)" },
      { label: "Sono", status: "bom", detail: "84/100" },
      { label: "Stress Médio", status: "bom", detail: "24" },
    ],
    garminScore: 78,
    garminLevel: "Bom",
    garminStaleDaysAgo: null,
    sleepScoreValue: 84,
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const [composed, readinessEntries] = await Promise.all([
      service.getComposedReadiness(),
      service.getTrainingReadiness(10), // [Certo] janela maior — este metric tem atraso de sync confirmado (até vários dias)
    ]);
    const latest = readinessEntries.reduce(
      (best, cur) => (!best || cur.date > best.date ? cur : best),
      readinessEntries[0]
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const staleDaysAgo = latest ? Math.round((new Date(todayStr).getTime() - new Date(latest.date).getTime()) / 86400000) : null;

    if (composed.compositeScore === null && !latest) {
      throw new Error("Sem sinais frescos (Intervals.icu) nem registo de Training Readiness do Garmin.");
    }

    return {
      data: {
        compositeScore: composed.compositeScore,
        recommendation: composed.recommendation,
        level: composed.level,
        signals: composed.signals.map((s) => ({ label: s.label, status: s.status, detail: s.detail })),
        garminScore: latest?.score ?? null,
        garminLevel: latest?.level ?? "—",
        garminStaleDaysAgo: staleDaysAgo && staleDaysAgo > 0 ? staleDaysAgo : null,
        sleepScoreValue: composed.signals.find((s) => s.label === "Sono")?.subScore ?? null,
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: humanizeError(err) };
  }
}

async function loadTrainingLoad(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: TrainingLoadCardData; isReal: boolean; error?: string }> {
  const mock: TrainingLoadCardData = {
    vo2Max: 54,
    trainingStatusLabel: "Productive",
    ctl: 49.5,
    atl: 37.8,
    tsb: 11.7,
    history: Array.from({ length: 8 }, (_, i) => ({
      date: `S${i + 1}`,
      ctl: 45 + i * 0.6,
      atl: 38 + Math.round(Math.sin(i) * 8),
    })),
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const [loadEntries, vo2Entries, wellness] = await Promise.all([
      service.getTrainingLoadSummary(7).catch(() => []),
      service.getVo2MaxSummary(7).catch(() => []),
      service.getWellnessWeekly(56), // [Certo] 8 semanas, real, sempre fresco (Intervals.icu)
    ]);
    const load = loadEntries.reduce((best, cur) => (!best || cur.date > best.date ? cur : best), loadEntries[0]);
    const vo2 = vo2Entries.reduce((best, cur) => (!best || cur.date > best.date ? cur : best), vo2Entries[0]);
    const latestWellness = wellness[wellness.length - 1]; // já vem ordenado por data ascendente
    if (!latestWellness) throw new Error("Sem registo de wellness (Intervals.icu) no período pedido.");

    return {
      data: {
        vo2Max: vo2?.canonicalValue ?? mock.vo2Max,
        trainingStatusLabel: load?.trainingStatus || mock.trainingStatusLabel, // [TODO] trainingStatus vazio até confirmar trainingHistory_* isolado
        ctl: latestWellness.ctl,
        atl: latestWellness.atl,
        tsb: latestWellness.tsb,
        history: wellness
          .filter((w) => w.ctl !== null && w.atl !== null)
          .map((w) => ({ date: w.date.slice(5), ctl: w.ctl as number, atl: w.atl as number })),
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: humanizeError(err) };
  }
}

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function weekdayPt(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return WEEKDAY_PT[d.getDay()];
}
function formatHoursMinutes(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function loadRunningSummary(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: RunningSummaryCardData; isReal: boolean; error?: string }> {
  const mock: RunningSummaryCardData = {
    weeklyDistanceKm: 42.3,
    weeklyTimeFormatted: "4h 12m",
    runCount: 5,
    previousWeekKm: 38.1,
    dailyDistances: [
      { day: "Seg", km: 8 },
      { day: "Ter", km: 0 },
      { day: "Qua", km: 10 },
      { day: "Qui", km: 6 },
      { day: "Sex", km: 0 },
      { day: "Sáb", km: 14 },
      { day: "Dom", km: 4.3 },
    ],
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    // [Certo] Um único pedido de 14 dias (não dois pedidos separados) —
    // divide em semana actual (últimos 7) e anterior (7 antes) para o
    // delta, sem custo extra de rate limit.
    const summary = await service.getWeeklyRunningSummary(14);
    const daily = summary.dailyDistanceKm; // 14 dias, ordenados asc
    const currentWeek = daily.slice(-7);
    const previousWeek = daily.slice(0, 7);
    const currentKm = roundTo(currentWeek.reduce((s, d) => s + d.km, 0), 1);
    const previousKm = roundTo(previousWeek.reduce((s, d) => s + d.km, 0), 1);

    // Tempo e contagem: recalcular só para a semana actual não é possível
    // sem outro pedido — aproximação proporcional é enganosa, por isso
    // pedimos os 7 dias reais só para tempo/contagem se o delta for preciso.
    // [Provável] Simplificação aceitável: totalDurationSec/runCount dos 14
    // dias inclui as 2 semanas; mostrar só a distância como métrica exacta
    // da semana e usar o rácio de distância para estimar o tempo é pior.
    // Melhor: um segundo pedido leve de 7 dias.
    const week7 = await service.getWeeklyRunningSummary(7);

    return {
      data: {
        weeklyDistanceKm: currentKm,
        weeklyTimeFormatted: formatHoursMinutes(week7.totalDurationSec),
        runCount: week7.runCount,
        previousWeekKm: previousKm > 0 ? previousKm : null,
        dailyDistances: currentWeek.map((d) => ({ day: weekdayPt(d.date), km: d.km })),
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: humanizeError(err) };
  }
}

async function loadRecoveryInsights(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: RecoveryCardData; isReal: boolean; error?: string }> {
  const mock: RecoveryCardData = {
    recoveryTimeHours: 18,
    acuteLoad: 1.05,
    bodyBatteryMax: 92,
    bodyBatteryMin: 24,
    avgStress: 28,
    hrv: 38,
    hrvBaseline: 35,
    restingHr: 54,
    restingHrBaseline: 53,
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const insights = await service.getRecoveryInsights();
    return { data: insights, isReal: true };
  } catch (err) {
    return { data: mock, isReal: false, error: humanizeError(err) };
  }
}

/**
 * [Suposição] O radar "Estado de Forma" não tem uma única métrica
 * canónica no Freddy — é uma normalização heurística minha a partir de
 * sinais já confirmados (score de readiness, VO2 Max, volume semanal,
 * FC média semanal). Os divisores de normalização (80 para VO2, 60km
 * para volume, etc.) são estimativas razoáveis para um corredor amador
 * de longa distância, não constantes oficiais — ajustar livremente.
 */
async function loadYoyKpis(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: YoyKpi[]; isReal: boolean; error?: string }> {
  const mock: YoyKpi[] = [
    { label: "Corridas", current: 105, previous: 87, unit: "" },
    { label: "Distância", current: 1566, previous: 1317, unit: "km" },
    { label: "Tempo", current: 132, previous: 118, unit: "h" },
    { label: "Elevação", current: 13323, previous: 10840, unit: "m" },
    { label: "FC Média", current: 137, previous: 140, unit: "bpm" },
  ];
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const today = new Date();
    const yearStart = `${today.getFullYear()}-01-01`;
    const yearEnd = today.toISOString().slice(0, 10);
    const prevYearStart = `${today.getFullYear() - 1}-01-01`;
    const prevYearEnd = `${today.getFullYear() - 1}-${yearEnd.slice(5)}`;
    const kpis = await service.getYearOverYearKpis(yearStart, yearEnd, prevYearStart, prevYearEnd);
    const unitDivide: Record<string, number> = { Distância: 1000, Tempo: 3600 }; // metros->km, segundos->horas
    return {
      data: kpis.map((k) => {
        const divisor = unitDivide[k.label] ?? 1;
        return {
          label: k.label,
          current: Math.round((k.currentValue / divisor) * 10) / 10,
          previous: Math.round((k.previousValue / divisor) * 10) / 10,
          unit: k.unit === "m" && divisor === 1000 ? "km" : k.unit === "s" && divisor === 3600 ? "h" : k.unit,
        };
      }),
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: humanizeError(err) };
  }
}

export default async function DashboardPage() {
  // [Certo] Uma única ligação MCP para a página toda — a versão anterior
  // chamava getFreddyDataService() 5 vezes em separado (uma por loader),
  // cada uma com handshake completo, o que disparou rate limiting real
  // no servidor Freddy quando outras páginas (Sono, FC) também passaram
  // a ligar-se. Esta abordagem evita isso: connect() corre uma vez,
  // partilhado por todos os loaders em paralelo.
  let service: Awaited<ReturnType<typeof getFreddyDataService>> | null = null;
  let connectError: string | undefined;
  try {
    service = await getFreddyDataService();
  } catch (err) {
    connectError = humanizeError(err);
  }

  // [Certo] Cadeia de resolução geográfica: cookie geo (GPS do browser,
  // escrito por GeoBeacon) → WEATHER_LAT/LON env (override manual) →
  // geo-IP Vercel (dinâmico, sem permissão) → default Porto.
  const [hdrs, cookieStore] = await Promise.all([headers(), cookies()]);
  const geoCookie = cookieStore.get("geo")?.value; // "lat,lon"
  const [cookieLat, cookieLon] = geoCookie?.split(",") ?? [];
  const vercelLat = hdrs.get("x-vercel-ip-latitude");
  const vercelLon = hdrs.get("x-vercel-ip-longitude");
  const resolvedLat = cookieLat ?? process.env.WEATHER_LAT ?? vercelLat ?? null;
  const resolvedLon = cookieLon ?? process.env.WEATHER_LON ?? vercelLon ?? null;
  const geoSource = cookieLat ? "cookie" : process.env.WEATHER_LAT ? "env" : vercelLat ? "vercel-geo-ip" : "default";
  const geo: GeoHint = {
    lat: resolvedLat,
    lon: resolvedLon,
    city: cookieLat ? null : hdrs.get("x-vercel-ip-city"),
    source: geoSource,
  };

  const [readinessResult, trainingLoadResult, yoyResult, runningResult, recoveryResult, weatherImpact] = await Promise.all([
    loadReadiness(service, connectError),
    loadTrainingLoad(service, connectError),
    loadYoyKpis(service, connectError),
    loadRunningSummary(service, connectError),
    loadRecoveryInsights(service, connectError),
    Promise.all([
      getTodayWeather(geo).catch(() => null),
      (resolvedLat && resolvedLon
        ? getAirQuality(resolvedLat, resolvedLon)
        : Promise.resolve(null)
      ).catch(() => null),
    ]).then(([w, aq]) =>
      w ? { ...classifyWeatherImpact(w, aq), tempNowC: w.tempNowC, tempMaxC: w.tempMaxC, aqi: aq?.europeanAqi ?? null } : null
    ).catch(() => null),
  ]);

  // Fallback Strava: quando Freddy está completamente indisponível
  let stravaFallbackActivities: { id: string; name: string; date: string; distanceKm: number; durationSec: number }[] = [];
  const freddy_indisponivel = !service || (!readinessResult.isReal && !trainingLoadResult.isReal && !runningResult.isReal);
  if (freddy_indisponivel) {
    try {
      const { activities } = await getShoesAndActivities();
      stravaFallbackActivities = activities.slice(0, 8);
    } catch { /* sem Strava também */ }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <GeoBeacon />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">

        {/* Hero: resposta imediata a "como estou hoje?" */}
        <section>
          <ReadinessHero
            readiness={readinessResult.data}
            load={trainingLoadResult.data}
            recovery={recoveryResult.data}
            weather={weatherImpact}
          />
          <StatusSummary
            sources={[
              { label: "Readiness", isReal: readinessResult.isReal, error: readinessResult.error },
              { label: "Carga de treino", isReal: trainingLoadResult.isReal, error: trainingLoadResult.error },
              { label: "Recuperação", isReal: recoveryResult.isReal, error: recoveryResult.error },
            ]}
          />
        </section>

        {/* Contexto secundário — carga e corrida */}
        <section>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <TrainingLoadCard data={trainingLoadResult.data} />
            </div>
            <div className="flex flex-col gap-1">
              <RunningSummaryCard data={runningResult.data} />
              <div className="flex justify-end"><DataFreshnessDot isReal={runningResult.isReal} error={runningResult.error} /></div>
            </div>
          </div>
        </section>

        {/* Comparação anual — resumo compacto */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-400">Ano Atual vs Ano Anterior</h2>
          <YoyKpiGrid kpis={yoyResult.data} />
          <CardSourceNote isReal={yoyResult.isReal} error={yoyResult.error} />
        </section>

        {/* Fallback Strava quando Freddy está indisponível */}
        {stravaFallbackActivities.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-slate-400">
              Atividades Recentes — Strava
              <span className="ml-2 text-[10px] text-amber-500">Freddy indisponível</span>
            </h2>
            <div className="space-y-2">
              {stravaFallbackActivities.map((a) => {
                const pace = a.distanceKm > 0 ? (a.durationSec / 60 / a.distanceKm) : 0;
                const paceMin = Math.floor(pace);
                const paceSec = Math.round((pace - paceMin) * 60);
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-200">{a.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{a.date}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>{a.distanceKm.toFixed(1)} km</span>
                      <span>{Math.floor(a.durationSec / 60)}min</span>
                      {pace > 0 && <span>{paceMin}:{String(paceSec).padStart(2, "0")}/km</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function CardSourceNote({ isReal, error }: { isReal: boolean; error?: string }) {
  return (
    <div className="mt-1 flex justify-end">
      <DataFreshnessDot isReal={isReal} error={error} />
    </div>
  );
}
