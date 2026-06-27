import { Trophy, TrendingUp } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import { PersonalRecordsTiles, type PersonalBestTile } from "@/components/dashboard/personal-records-tiles";

function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

const MOCK_BESTS: PersonalBestTile[] = [
  { label: "5 km", durationSec: 1085, date: "2026-06-21", paceMinPerKm: 3.62, distanceKm: 5.0, activityName: "Corrida de exemplo" },
  { label: "10 km", durationSec: 2271, date: "2026-05-10", paceMinPerKm: 3.78, distanceKm: 10.0, activityName: "Corrida de exemplo" },
  { label: "Meia Maratona", durationSec: 5400, date: "2026-03-22", paceMinPerKm: 4.27, distanceKm: 21.1, activityName: "Corrida de exemplo" },
  { label: "Maratona", durationSec: 10918, date: "2026-04-26", paceMinPerKm: 4.31, distanceKm: 42.2, activityName: "Corrida de exemplo" },
];
const MOCK_PREDICTIONS = [
  { label: "5 km", seconds: 1085 },
  { label: "10 km", seconds: 2271 },
  { label: "Meia Maratona", seconds: 5031 },
  { label: "Maratona", seconds: 10918 },
];

async function loadPersonalBests(service: Awaited<ReturnType<typeof getFreddyDataService>> | null): Promise<{ data: PersonalBestTile[]; isReal: boolean; error?: string }> {
  if (!service) return { data: MOCK_BESTS, isReal: false, error: "Freddy não ligado." };
  try {
    const records = await service.getPersonalRecords();
    if (records.length === 0) throw new Error("Sem corridas correspondentes a nenhuma distância-alvo no período coberto.");
    return {
      data: records.map((r) => ({
        label: r.label,
        durationSec: r.durationSec,
        date: r.date,
        paceMinPerKm: r.paceMinPerKm,
        distanceKm: r.distanceKm,
        activityName: r.activityName,
      })),
      isReal: true,
    };
  } catch (err) {
    return { data: MOCK_BESTS, isReal: false, error: String(err) };
  }
}

async function loadPredictions(service: Awaited<ReturnType<typeof getFreddyDataService>> | null): Promise<{ data: { label: string; seconds: number }[]; isReal: boolean; error?: string }> {
  if (!service) return { data: MOCK_PREDICTIONS, isReal: false, error: "Freddy não ligado." };
  try {
    const p = await service.getRacePredictions();
    return {
      data: [
        { label: "5 km", seconds: p.time5kSec },
        { label: "10 km", seconds: p.time10kSec },
        { label: "Meia Maratona", seconds: p.timeHalfSec },
        { label: "Maratona", seconds: p.timeMarathonSec },
      ],
      isReal: true,
    };
  } catch (err) {
    // [Certo] Confirmado real: racePredictions_* pode não ter dados disponíveis
    // num dado momento ("No data found for metrics: racePredictions_..."), sem
    // que isso signifique nenhum problema com os recordes pessoais — por isso
    // este loader é independente do outro (Promise.all separados, não conjunto).
    return { data: MOCK_PREDICTIONS, isReal: false, error: String(err) };
  }
}

export default async function RecordsPage() {
  let service: Awaited<ReturnType<typeof getFreddyDataService>> | null = null;
  try {
    service = await getFreddyDataService();
  } catch {
    service = null;
  }

  const [bestsResult, predictionsResult] = await Promise.all([loadPersonalBests(service), loadPredictions(service)]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Recordes</h2>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" /> Melhores Tempos Reais
            </span>
          </CardTitle>
          <PersonalRecordsTiles records={bestsResult.data} />
          <p className="mt-3 text-[11px] text-slate-500">
            Corrida mais rápida dentro de uma tolerância de distância (não exige a marca exata) — últimos ~18 meses
            (limite de linhas da API impede ir mais atrás de forma fiável). Toque num tempo para ver o detalhe da corrida.
          </p>
          <div className="mt-2 flex justify-end"><DataFreshnessDot isReal={bestsResult.isReal} error={bestsResult.error} /></div>
        </Card>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-400" /> Previsões Atuais (Garmin)
            </span>
          </CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {predictionsResult.data.map((p) => (
              <div key={p.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center">
                <div className="text-xs text-slate-500">{p.label}</div>
                <div className="mt-1 text-2xl font-bold text-cyan-400">{formatHm(p.seconds)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Estimativa do Garmin com base na sua forma atual — não é um tempo já corrido, é uma previsão.
          </p>
          <div className="mt-2 flex justify-end"><DataFreshnessDot isReal={predictionsResult.isReal} error={predictionsResult.error} /></div>
        </Card>
      </main>
    </div>
  );
}
