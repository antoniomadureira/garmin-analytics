import { Trophy, TrendingUp } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { getFreddyDataService } from "@/lib/freddy/data-adapter";

function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}
function formatDatePt(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatPredictionTime(seconds: number): string {
  return formatHm(seconds);
}

interface RecordsPageData {
  personalBests: { label: string; durationSec: number; date: string; paceMinPerKm: number; distanceKm: number }[];
  predictions: { label: string; seconds: number }[];
}

async function loadRecords(): Promise<{ data: RecordsPageData; isReal: boolean; error?: string }> {
  const mock: RecordsPageData = {
    personalBests: [
      { label: "5 km", durationSec: 1085, date: "2026-06-21", paceMinPerKm: 3.62, distanceKm: 5.0 },
      { label: "10 km", durationSec: 2271, date: "2026-05-10", paceMinPerKm: 3.78, distanceKm: 10.0 },
      { label: "Meia Maratona", durationSec: 5031, date: "2026-03-22", paceMinPerKm: 3.97, distanceKm: 21.1 },
      { label: "Maratona", durationSec: 10918, date: "2026-04-26", paceMinPerKm: 4.31, distanceKm: 42.2 },
    ],
    predictions: [
      { label: "5 km", seconds: 1085 },
      { label: "10 km", seconds: 2271 },
      { label: "Meia Maratona", seconds: 5031 },
      { label: "Maratona", seconds: 10918 },
    ],
  };
  try {
    const service = await getFreddyDataService();
    const [records, prediction] = await Promise.all([service.getPersonalRecords(), service.getRacePredictions()]);
    if (records.length === 0) throw new Error("Sem corridas correspondentes a nenhuma distância-alvo no histórico.");
    return {
      data: {
        personalBests: records.map((r) => ({
          label: r.label,
          durationSec: r.durationSec,
          date: r.date,
          paceMinPerKm: r.paceMinPerKm,
          distanceKm: r.distanceKm,
        })),
        predictions: [
          { label: "5 km", seconds: prediction.time5kSec },
          { label: "10 km", seconds: prediction.time10kSec },
          { label: "Meia Maratona", seconds: prediction.timeHalfSec },
          { label: "Maratona", seconds: prediction.timeMarathonSec },
        ],
      },
      isReal: true,
    };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

export default async function RecordsPage() {
  const { data, isReal, error } = await loadRecords();

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.personalBests.map((r) => (
              <div key={r.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center">
                <div className="text-xs text-slate-500">{r.label}</div>
                <div className="mt-1 text-2xl font-bold text-amber-400">{formatHm(r.durationSec)}</div>
                <div className="text-[11px] text-slate-500">{formatPace(r.paceMinPerKm)}</div>
                <div className="mt-1 text-[11px] text-slate-600">{formatDatePt(r.date)} · {r.distanceKm.toLocaleString("pt-PT")}km</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Corrida mais rápida dentro de uma tolerância de distância (não exige a marca exata) — histórico completo desde 2016.
          </p>
        </Card>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-400" /> Previsões Atuais (Garmin)
            </span>
          </CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.predictions.map((p) => (
              <div key={p.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center">
                <div className="text-xs text-slate-500">{p.label}</div>
                <div className="mt-1 text-2xl font-bold text-cyan-400">{formatPredictionTime(p.seconds)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Estimativa do Garmin com base na sua forma atual — não é um tempo já corrido, é uma previsão.
          </p>
        </Card>

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
