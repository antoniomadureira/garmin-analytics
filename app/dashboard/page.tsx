import { DashboardNav } from "@/components/dashboard/nav";
import { ReadinessCard, type ReadinessCardData } from "@/components/dashboard/readiness-card";
import { TrainingLoadCard, type TrainingLoadCardData } from "@/components/dashboard/training-load-card";
import { RunningSummaryCard, type RunningSummaryCardData } from "@/components/dashboard/running-summary-card";
import { RecoveryCard, type RecoveryCardData } from "@/components/dashboard/recovery-card";
import { YoyKpiGrid, type YoyKpi } from "@/components/dashboard/yoy-kpi-grid";
import { FormBanner, FormRadarCard, type RadarDimension } from "@/components/dashboard/form-state";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { StatTile } from "@/components/ui/stat-tile";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import { Heart, Zap, Moon, Activity as ActivityIcon, Gauge } from "lucide-react";

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
        signals: composed.signals.map((s) => ({ label: s.label, status: s.status, detail: s.detail })),
        garminScore: latest?.score ?? null,
        garminLevel: latest?.level ?? "—",
        garminStaleDaysAgo: staleDaysAgo && staleDaysAgo > 0 ? staleDaysAgo : null,
        sleepScoreValue: composed.signals.find((s) => s.label === "Sono")?.subScore ?? null,
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
    const battery = await service.getBodyBatteryWeekly(7);
    const latest = battery.reduce((best, cur) => (!best || cur.date > best.date ? cur : best), battery[0]);
    if (!latest) throw new Error("Sem registo de body battery no período pedido.");
    const avgStress = latest.avgStress !== null ? Math.round(latest.avgStress) : null;
    return {
      data: {
        recoveryTimeHours: null, // [Certo] depende de trainingReadiness_score, que tem atraso de sync confirmado — mostrar null em vez de inventar um valor sob a bandeira "dados reais"
        bodyBatteryMax: latest.max ?? mock.bodyBatteryMax,
        bodyBatteryMin: latest.min ?? mock.bodyBatteryMin,
        avgStress: avgStress ?? mock.avgStress,
        recommendation:
          avgStress !== null && avgStress < 35
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

interface GlanceData {
  restingHr: number | null;
  hrvMs: number | null;
}
async function loadGlanceExtra(service: Awaited<ReturnType<typeof getFreddyDataService>> | null): Promise<{ data: GlanceData; isReal: boolean; error?: string }> {
  const mock: GlanceData = { restingHr: 56, hrvMs: 31 };
  if (!service) return { data: mock, isReal: false };
  try {
    const hr = await service.getHeartRateWeekly(3);
    // [Provável] HRV ainda não tem método dedicado — leitura direta via queryRawText, fora do FreddyDataService por simplicidade.
    return { data: { restingHr: hr.restingToday, hrvMs: null }, isReal: true };
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

  const [readinessResult, trainingLoadResult, yoyResult, runningResult, recoveryResult, glanceResult] = await Promise.all([
    loadReadiness(service, connectError),
    loadTrainingLoad(service, connectError),
    loadYoyKpis(service, connectError),
    loadRunningSummary(service, connectError),
    loadRecoveryInsights(service, connectError),
    loadGlanceExtra(service),
  ]);

  const radarData = buildRadarData(
    trainingLoadResult.data.vo2Max,
    readinessResult.data.compositeScore ?? readinessResult.data.garminScore ?? 50,
    runningResult.data.weeklyDistanceKm,
    null // [TODO] FC média semanal ainda não recolhida separadamente
  );

  const tsb = trainingLoadResult.data.tsb;
  const tsbDescription =
    tsb === null
      ? "sem dado de TSB disponível"
      : tsb > 5
        ? "fresca — boa janela para subir intensidade"
        : tsb >= -10
          ? "equilibrada — janela segura para manter ou subir intensidade com moderação"
          : tsb >= -20
            ? "com fadiga acumulada — considere reduzir volume nos próximos dias"
            : "em sobrecarga — recomenda-se descanso ou treino muito leve";
  const formMessage = `Forma ${tsbDescription}. TSB ${tsb !== null ? (tsb > 0 ? "+" : "") + tsb : "—"} (CTL ${trainingLoadResult.data.ctl?.toFixed(1) ?? "—"} / ATL ${trainingLoadResult.data.atl?.toFixed(1) ?? "—"}).`;
  const formTone: "emerald" | "amber" | "red" = tsb === null ? "amber" : tsb > 5 ? "emerald" : tsb >= -10 ? "emerald" : tsb >= -20 ? "amber" : "red";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-2 text-xs text-amber-300">
          <span>
            O radar de Estado de Forma é uma estimativa heurística (Pace e Elevação ainda não vêm de dados reais) — ver
            aviso por card para o resto.
          </span>
          <span className="whitespace-nowrap text-slate-400">
            Página carregada em: {new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-400">Em Foco</h2>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex h-full flex-col">
              <ReadinessCard data={readinessResult.data} />
              <div className="mt-1 flex justify-end"><DataFreshnessDot isReal={readinessResult.isReal} error={readinessResult.error} /></div>
            </div>
            <div className="flex h-full flex-col">
              <TrainingLoadCard data={trainingLoadResult.data} />
              <div className="mt-1 flex justify-end"><DataFreshnessDot isReal={trainingLoadResult.isReal} error={trainingLoadResult.error} /></div>
            </div>
            <div className="flex h-full flex-col">
              <RunningSummaryCard data={runningResult.data} />
              <div className="mt-1 flex justify-end"><DataFreshnessDot isReal={runningResult.isReal} error={runningResult.error} /></div>
            </div>
            <div className="flex h-full flex-col">
              <RecoveryCard data={recoveryResult.data} />
              <div className="mt-1 flex justify-end"><DataFreshnessDot isReal={recoveryResult.isReal} error={recoveryResult.error} /></div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-400">Condição Atual</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile icon={<Heart size={14} />} label="FC Repouso" value={glanceResult.data.restingHr} unit="bpm" sublabel="Hoje" accent="#fb7185" />
            <StatTile icon={<Zap size={14} />} label="Bateria" value={recoveryResult.data.bodyBatteryMax} unit="%" sublabel="Pico hoje" accent="#22d3ee" />
            <StatTile icon={<Moon size={14} />} label="Sono" value={readinessResult.data.sleepScoreValue} unit="/100" sublabel="Última noite" accent="#a78bfa" />
            <StatTile icon={<ActivityIcon size={14} />} label="VO2 Max" value={trainingLoadResult.data.vo2Max} sublabel="Superior" accent="#34d399" />
            <StatTile icon={<Gauge size={14} />} label="TSB" value={trainingLoadResult.data.tsb !== null ? (trainingLoadResult.data.tsb > 0 ? `+${trainingLoadResult.data.tsb}` : trainingLoadResult.data.tsb) : null} sublabel="Hoje" accent="#fb923c" />
            <StatTile icon={<Heart size={14} />} label="Stress" value={recoveryResult.data.avgStress} sublabel="Médio recente" accent="#f87171" />
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
          <FormRadarCard data={radarData} />
        </section>
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
