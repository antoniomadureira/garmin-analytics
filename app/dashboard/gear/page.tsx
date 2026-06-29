import { Footprints } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import { getShoesAndActivities, type StravaLabShoe } from "@/lib/strava-lab/client";

const REPLACE_THRESHOLD_KM = 700; // [Suposição] limiar comum entre corredores (~600-800km), não é regra oficial

async function loadShoes(): Promise<{ data: StravaLabShoe[]; isReal: boolean; error?: string }> {
  const mock: StravaLabShoe[] = [
    { id: "1", name: "ASICS Novablast 5", brand: "ASICS", model: "Novablast 5", distanceKm: 671, retired: false },
    { id: "2", name: "ASICS Superblast 2", brand: "ASICS", model: "Superblast 2", distanceKm: 1270, retired: false },
  ];
  try {
    const { shoes } = await getShoesAndActivities();
    if (shoes.length === 0) throw new Error("Sem calçado registado no Strava.");
    return { data: shoes, isReal: true };
  } catch (err) {
    return { data: mock, isReal: false, error: String(err) };
  }
}

export default async function GearPage() {
  const { data, isReal, error } = await loadShoes();
  const active = data.filter((s) => !s.retired).sort((a, b) => b.distanceKm - a.distanceKm);
  const retired = data.filter((s) => s.retired).sort((a, b) => b.distanceKm - a.distanceKm);

  function ShoeRow({ shoe }: { shoe: StravaLabShoe }) {
    const pct = Math.min(100, Math.round((shoe.distanceKm / REPLACE_THRESHOLD_KM) * 100));
    const warn = pct >= 90 && !shoe.retired;
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">{shoe.name}</span>
          <span className={`text-sm font-semibold ${warn ? "text-amber-400" : "text-slate-300"}`}>
            {shoe.distanceKm.toLocaleString("pt-PT")} km
          </span>
        </div>
        {!shoe.retired && (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full ${warn ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
            </div>
            {warn && <p className="mt-1 text-[11px] text-amber-500">Perto do limiar habitual de substituição (~{REPLACE_THRESHOLD_KM}km)</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Calçado</h2>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Footprints size={16} className="text-orange-400" /> Em Uso
            </span>
          </CardTitle>
          <div className="space-y-2">
            {active.map((s) => <ShoeRow key={s.id} shoe={s} />)}
            {active.length === 0 && <p className="text-sm text-slate-500">Sem calçado ativo.</p>}
          </div>
        </Card>

        {retired.length > 0 && (
          <Card>
            <CardTitle>Reformados</CardTitle>
            <div className="space-y-2 opacity-60">
              {retired.map((s) => <ShoeRow key={s.id} shoe={s} />)}
            </div>
          </Card>
        )}

        <div className="flex justify-end"><DataFreshnessDot isReal={isReal} error={error} /></div>
      </main>
    </div>
  );
}
