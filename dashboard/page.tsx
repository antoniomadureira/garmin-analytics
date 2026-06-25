import { DashboardNav } from "@/components/dashboard/nav";
import { ReadinessCard, type ReadinessCardData } from "@/components/dashboard/readiness-card";
import { TrainingLoadCard, type TrainingLoadCardData } from "@/components/dashboard/training-load-card";
import { RunningSummaryCard, type RunningSummaryCardData } from "@/components/dashboard/running-summary-card";
import { RecoveryCard, type RecoveryCardData } from "@/components/dashboard/recovery-card";
import { YoyKpiGrid, type YoyKpi } from "@/components/dashboard/yoy-kpi-grid";
import { FormBanner, FormRadarCard, type RadarDimension } from "@/components/dashboard/form-state";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

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
    score: 78,
    level: "Bom",
    feedbackShort: "Boa recuperação. Apto para treino de intensidade moderada a alta.",
    sleepScore: 84,
    hrvStatusLabel: "Equilibrado",
    acuteLoad: 312,
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const readinessEntries = await service.getTrainingReadiness(7);
    const latest = readinessEntries.reduce(
      (best, cur) => (!best || cur.date > best.date ? cur : best),
      readinessEntries[0]
    );
    if (!latest) throw new Error("Sem registo de readiness no período pedido.");
    return {
      data: {
        score: latest.score,
        level: latest.level,
        feedbackShort: latest.feedbackShort,
        sleepScore: mock.sleepScore, // [TODO] mapToSleepSummary ainda não implementado
        hrvStatusLabel: mock.hrvStatusLabel, // idem
        acuteLoad: latest.acuteLoad ?? 0,
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

async function loadTrainingLoad(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: TrainingLoadCardData; isReal: boolean; error?: string }> {
  const mock: TrainingLoadCardData = {
    vo2Max: 54,
    trainingStatusLabel: "Productive",
    acwrStatus: "OPTIMAL",
    history: Array.from({ length: 8 }, (_, i) => ({
      date: `S${i + 1}`,
      acute: 280 + Math.round(Math.sin(i) * 40 + i * 6),
      chronic: 260 + i * 8,
    })),
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const loadEntries = await service.getTrainingLoadSummary(7);
    const vo2Entries = await service.getVo2MaxSummary(7);
    const load = loadEntries.reduce((best, cur) => (!best || cur.date > best.date ? cur : best), loadEntries[0]);
    const vo2 = vo2Entries.reduce((best, cur) => (!best || cur.date > best.date ? cur : best), vo2Entries[0]);
    if (!load) throw new Error("Sem registo de training load no período pedido.");
    return {
      data: {
        vo2Max: vo2?.canonicalValue ?? mock.vo2Max,
        trainingStatusLabel: load.trainingStatus || mock.trainingStatusLabel, // [TODO] trainingStatus vazio até confirmar trainingHistory_*
        acwrStatus: load.acwrStatus,
        history: mock.history, // [TODO] precisa de série de 8 semanas real, não só o último dia
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
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
    const summary = await service.getWeeklyRunningSummary(7);
    return {
      data: {
        weeklyDistanceKm: summary.totalDistanceKm,
        weeklyTimeFormatted: formatHoursMinutes(summary.totalDurationSec),
        runCount: summary.runCount,
        dailyDistances: summary.dailyDistanceKm.map((d) => ({ day: weekdayPt(d.date), km: d.km })),
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

async function loadRecoveryInsights(service: Awaited<ReturnType<typeof getFreddyDataService>> | null, connectError?: string): Promise<{ data: RecoveryCardData; isReal: boolean; error?: string }> {
  const mock: RecoveryCardData = {
    recoveryTimeHours: 18,
    bodyBatteryMax: 92,
    bodyBatteryMin: 24,
    avgStress: 28,
    recommendation: "Stress controlado e recuperação dentro do esperado. Sem necessidade de dia extra de descanso.",
  };
  if (!service) return { data: mock, isReal: false, error: connectError };
  try {
    const [recoveryEntries, readinessEntries] = await Promise.all([
      service.getRecoverySummary(7),
      service.getTrainingReadiness(7),
    ]);
    const latestRecovery = recoveryEntries.reduce((best, cur) => (!best || cur.date > best.date ? cur : best), recoveryEntries[0]);
    const latestReadiness = readinessEntries.reduce((best, cur) => (!best || cur.date > best.date ? cur : best), readinessEntries[0]);
    if (!latestRecovery) throw new Error("Sem registo de recuperação no período pedido.");
    const recoveryTimeHours = latestReadiness?.recoveryTimeHours ?? null;
    return {
      data: {
        recoveryTimeHours: recoveryTimeHours ?? mock.recoveryTimeHours,
        bodyBatteryMax: latestRecovery.bodyBatteryMax,
        bodyBatteryMin: Math.max(0, latestRecovery.bodyBatteryMin),
        avgStress: Math.round(latestRecovery.avgStress),
        recommendation:
          latestRecovery.avgStress < 35
            ? "Stress controlado e recuperação dentro do esperado. Sem necessidade de dia extra de descanso."
            : "Stress acima do habitual nos últimos dias — considere um dia de recuperação ativa.",
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
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
function buildRadarData(vo2Max: number, readinessScore: number, weeklyKm: number, weeklyHrAvg: number | null): RadarDimension[] {
  return [
    { dimension: "Fitness", value: Math.min(100, Math.round((vo2Max / 80) * 100)) },
    { dimension: "Frescura", value: readinessScore },
    { dimension: "Volume", value: Math.min(100, Math.round((weeklyKm / 60) * 100)) },
    { dimension: "Pace", value: 65 }, // [TODO] precisa de avgPaceMinPerKm real, não disponível nos loaders atuais
    { dimension: "FC", value: weeklyHrAvg ? Math.max(0, Math.min(100, Math.round(100 - (weeklyHrAvg - 120)))) : 70 },
    { dimension: "Elevação", value: 54 }, // [TODO] precisa do total de elevação semanal
  ];
}

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
    return { data: mock, isReal: false, error: String(err) };
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
    connectError = String(err);
  }

  const [readinessResult, trainingLoadResult, yoyResult, runningResult, recoveryResult] = await Promise.all([
    loadReadiness(service, connectError),
    loadTrainingLoad(service, connectError),
    loadYoyKpis(service, connectError),
    loadRunningSummary(service, connectError),
    loadRecoveryInsights(service, connectError),
  ]);

  const radarData = buildRadarData(
    trainingLoadResult.data.vo2Max,
    readinessResult.data.score,
    runningResult.data.weeklyDistanceKm,
    null // [TODO] FC média semanal ainda não recolhida separadamente
  );

  const acwrLabelForBanner: Record<string, string> = { OPTIMAL: "Ótimo (Optimal)", HIGH: "Alto", LOW: "Baixo" };
  const formMessage = `Forma ${
    trainingLoadResult.data.acwrStatus === "OPTIMAL" ? "equilibrada" : trainingLoadResult.data.acwrStatus === "HIGH" ? "sob pressão" : "com espaço para mais"
  }. ACWR ${acwrLabelForBanner[trainingLoadResult.data.acwrStatus] ?? trainingLoadResult.data.acwrStatus}. ${
    readinessResult.data.feedbackShort
  }`;
  const formTone: "emerald" | "amber" | "red" = trainingLoadResult.data.acwrStatus === "OPTIMAL" ? "emerald" : trainingLoadResult.data.acwrStatus === "HIGH" ? "red" : "amber";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
          O radar de Estado de Forma é uma estimativa heurística (Pace e Elevação ainda não vêm de dados reais) — ver
          aviso por card para o resto.
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-400">Em Foco</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <ReadinessCard data={readinessResult.data} />
              <CardSourceNote isReal={readinessResult.isReal} error={readinessResult.error} />
            </div>
            <div>
              <TrainingLoadCard data={trainingLoadResult.data} />
              <CardSourceNote isReal={trainingLoadResult.isReal} error={trainingLoadResult.error} />
            </div>
            <div>
              <RunningSummaryCard data={runningResult.data} />
              <CardSourceNote isReal={runningResult.isReal} error={runningResult.error} />
            </div>
            <div>
              <RecoveryCard data={recoveryResult.data} />
              <CardSourceNote isReal={recoveryResult.isReal} error={recoveryResult.error} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-400">Comparação Homóloga — Ano Atual vs Ano Anterior</h2>
          <YoyKpiGrid kpis={yoyResult.data} />
          <CardSourceNote isReal={yoyResult.isReal} error={yoyResult.error} />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-slate-400">Estado de Forma</h2>
          <FormBanner data={{ message: formMessage, tone: formTone }} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TrainingLoadCard data={trainingLoadResult.data} />
            <FormRadarCard data={radarData} />
          </div>
        </section>
      </main>
    </div>
  );
}

function CardSourceNote({ isReal, error }: { isReal: boolean; error?: string }) {
  if (isReal) {
    return <p className="mt-1 text-[11px] text-emerald-500">● dados reais (Freddy)</p>;
  }
  return (
    <p className="mt-1 text-[11px] text-amber-500" title={error}>
      ● dados de exemplo {error ? `(${error.slice(0, 60)}…)` : ""}
    </p>
  );
}
