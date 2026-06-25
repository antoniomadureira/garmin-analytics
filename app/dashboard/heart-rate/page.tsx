import { Heart, TrendingUp, Zap } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { StatTile } from "@/components/ui/stat-tile";
import { TrendLineChart } from "@/components/dashboard/trend-line-chart";
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

export default async function HeartRatePage() {
  const { data, isReal, error } = await loadHeartRate();

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
      </main>
    </div>
  );
}
