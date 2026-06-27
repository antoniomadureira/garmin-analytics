import { Heart, TrendingUp, Zap, TrendingDown } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { StatTile } from "@/components/ui/stat-tile";
import { TrendLineChart } from "@/components/dashboard/trend-line-chart";
import { HrPerActivityChart } from "@/components/dashboard/hr-per-activity-chart";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function weekdayPt(isoDate: string): string {
  return WEEKDAY_PT[new Date(`${isoDate}T00:00:00`).getDay()];
}

interface HeartRatePageData {
  restingToday: number | null;
  maxThisWeek: number | null;
  minToday: number | null;
  trend: { label: string; resting: number | null; max: number | null }[];
}

interface ActivityHrData {
  lowestAvgHr: number | null;
  highestMaxHr: number | null;
  history: { name: string; avgHr: number | null; maxHr: number | null }[];
}

async function loadHeartRate(): Promise<{ data: HeartRatePageData; isReal: boolean; error?: string }> {
  const mock: HeartRatePageData = {
    restingToday: 56,
    maxThisWeek: 178,
    minToday: 48,
    trend: [
      { label: "Sex", resting: 57, max: 165 },
      { label: "Sáb", resting: 59, max: 172 },
      { label: "Dom", resting: 55, max: 158 },
      { label: "Seg", resting: 54, max: 168 },
      { label: "Ter", resting: 56, max: 178 },
      { label: "Qua", resting: 58, max: 162 },
      { label: "Qui", resting: 56, max: 160 },
    ],
  };
  try {
    const service = await getFreddyDataService();
    const weekly = await service.getHeartRateWeekly(7);
    if (weekly.daily.length === 0) throw new Error("Sem registos de FC no período pedido.");
    return {
      data: {
        restingToday: weekly.restingToday,
        maxThisWeek: weekly.maxThisWeek,
        minToday: weekly.minToday,
        trend: weekly.daily.map((d) => ({ label: weekdayPt(d.date), resting: d.resting, max: d.max })),
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

async function loadActivityHr(): Promise<{ data: ActivityHrData; isReal: boolean; error?: string }> {
  const mock: ActivityHrData = {
    lowestAvgHr: 128,
    highestMaxHr: 178,
    history: [
      { name: "Corrida fácil", avgHr: 132, maxHr: 148 },
      { name: "Treino de séries", avgHr: 151, maxHr: 178 },
      { name: "Longo de domingo", avgHr: 138, maxHr: 160 },
      { name: "Corrida de São João", avgHr: 139, maxHr: 153 },
    ],
  };
  try {
    const service = await getFreddyDataService();
    const history = await service.getActivityHrHistory(35);
    if (history.length === 0) throw new Error("Sem atividades com FC no período pedido.");
    const avgs = history.map((h) => h.avgHr).filter((v): v is number => v !== null);
    const maxs = history.map((h) => h.maxHr).filter((v): v is number => v !== null);
    return {
      data: {
        lowestAvgHr: avgs.length ? Math.min(...avgs) : null,
        highestMaxHr: maxs.length ? Math.max(...maxs) : null,
        history: history.map((h) => ({ name: h.name, avgHr: h.avgHr, maxHr: h.maxHr })),
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

export default async function HeartRatePage() {
  const [{ data, isReal, error }, { data: activityData, isReal: activityIsReal, error: activityError }] = await Promise.all([
    loadHeartRate(),
    loadActivityHr(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Frequência Cardíaca</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile icon={<Heart size={14} />} label="FC Repouso" value={data.restingToday} unit="bpm" sublabel="Hoje" accent="#fb7185" />
          <StatTile icon={<TrendingUp size={14} />} label="FC Máxima" value={data.maxThisWeek} unit="bpm" sublabel="Esta semana" accent="#fb923c" />
          <StatTile icon={<Zap size={14} />} label="FC Mínima" value={data.minToday} unit="bpm" sublabel="Hoje" accent="#22d3ee" />
        </div>

        <TrendLineChart
          title="FC Repouso vs Máxima — Semana"
          data={data.trend}
          series={[
            { key: "resting", color: "#22d3ee", label: "FC Repouso" },
            { key: "max", color: "#fb7185", label: "FC Máxima" },
          ]}
        />

        {isReal ? (
          <p className="text-[11px] text-emerald-500">● dados reais (Freddy)</p>
        ) : (
          <p className="text-[11px] text-amber-500" title={error}>
            ● dados de exemplo {error ? `(${error.slice(0, 80)}…)` : ""}
          </p>
        )}

        <h2 className="pt-2 text-sm font-medium text-slate-400">FC nas Atividades</h2>

        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={<TrendingDown size={14} />} label="FC Mais Baixa" value={activityData.lowestAvgHr} unit="bpm" sublabel="Média mais baixa entre corridas" accent="#22d3ee" />
          <StatTile icon={<TrendingUp size={14} />} label="FC Mais Alta" value={activityData.highestMaxHr} unit="bpm" sublabel="Máxima mais alta entre corridas" accent="#fb7185" />
        </div>

        <HrPerActivityChart data={activityData.history} />

        {activityIsReal ? (
          <p className="text-[11px] text-emerald-500">● dados reais (Freddy)</p>
        ) : (
          <p className="text-[11px] text-amber-500" title={activityError}>
            ● dados de exemplo {activityError ? `(${activityError.slice(0, 80)}…)` : ""}
          </p>
        )}
      </main>
    </div>
  );
}
