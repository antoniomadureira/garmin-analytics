import { DashboardNav } from "@/components/dashboard/nav";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import { SegmentProgressCard, type SegmentProgressData } from "@/components/dashboard/segment-progress-card";
import { getStarredSegments, getSegmentEffortHistory } from "@/lib/strava-lab/client";

const MOCK_SEGMENTS: SegmentProgressData[] = [
  {
    name: "Rua 8 Climb (exemplo)",
    distanceM: 450,
    bestSeconds: 95,
    history: [
      { date: "2026-01-10", seconds: 142 },
      { date: "2026-03-02", seconds: 118 },
      { date: "2026-05-15", seconds: 102 },
      { date: "2026-06-20", seconds: 95 },
    ],
  },
];

async function loadSegments(): Promise<{ data: SegmentProgressData[]; isReal: boolean; error?: string }> {
  try {
    const starred = await getStarredSegments();
    if (starred.length === 0) throw new Error("Sem segmentos favoritos marcados no Strava.");

    // [Provável] Limitar aos 6 mais relevantes para não disparar muitas
    // chamadas de uma vez (cada segmento = 1 pedido extra ao strava-lab).
    const top = starred.slice(0, 6);
    const withHistory = await Promise.all(
      top.map(async (s) => {
        const history = await getSegmentEffortHistory(s.id);
        const bestSeconds = history.length ? Math.min(...history.map((h) => h.elapsedTimeSec)) : 0;
        return { name: s.name, distanceM: s.distanceM, bestSeconds, history: history.map((h) => ({ date: h.date, seconds: h.elapsedTimeSec })) };
      })
    );
    const withData = withHistory.filter((s) => s.history.length > 0);
    if (withData.length === 0) throw new Error("Segmentos favoritos sem histórico de esforços.");
    return { data: withData, isReal: true };
  } catch (err) {
    return { data: MOCK_SEGMENTS, isReal: false, error: String(err) };
  }
}

export default async function SegmentsPage() {
  const { data, isReal, error } = await loadSegments();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Segmentos Favoritos</h2>
        <p className="text-xs text-slate-500">
          Evolução do seu tempo pessoal em segmentos que marcou como favoritos no Strava — não é o recorde de hoje,
          é a tendência ao longo do tempo num troço fixo e real.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((s) => <SegmentProgressCard key={s.name} segment={s} />)}
        </div>

        <div className="flex justify-end"><DataFreshnessDot isReal={isReal} error={error} /></div>
      </main>
    </div>
  );
}
