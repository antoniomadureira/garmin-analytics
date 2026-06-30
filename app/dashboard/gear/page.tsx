export const dynamic = "force-dynamic";

import { ShoppingBag } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import { GearGrid, type GearItem } from "@/components/dashboard/gear-grid";
import { getShoesAndActivities, getGearCosts, type StravaLabShoe } from "@/lib/strava-lab/client";

async function loadGear(): Promise<{ data: StravaLabShoe[]; costs: Record<string, number>; isReal: boolean; error?: string }> {
  const mock: StravaLabShoe[] = [
    { id: "1", name: "ASICS Novablast 5", brand: "ASICS", model: "Novablast 5", distanceKm: 287, retired: false },
    { id: "2", name: "ASICS Superblast 2", brand: "ASICS", model: "Superblast 2", distanceKm: 612, retired: false },
  ];
  try {
    const [{ shoes }, costs] = await Promise.all([getShoesAndActivities(), getGearCosts().catch(() => ({}))]);
    if (shoes.length === 0) throw new Error("Sem equipamento registado no Strava.");
    return { data: shoes, costs, isReal: true };
  } catch (err) {
    return { data: mock, costs: {}, isReal: false, error: String(err) };
  }
}

export default async function GearPage() {
  const { data, costs, isReal, error } = await loadGear();
  const active = data.filter((s) => !s.retired).sort((a, b) => b.distanceKm - a.distanceKm);
  const retired = data.filter((s) => s.retired).sort((a, b) => b.distanceKm - a.distanceKm);

  const toItems = (list: StravaLabShoe[]): GearItem[] =>
    list.map((s) => ({ id: s.id, name: s.name, distanceKm: s.distanceKm, retired: s.retired, priceEur: costs[s.id] ?? null }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardNav />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h2 className="text-sm font-medium text-slate-400">Equipamento</h2>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-orange-400" /> Em Uso
            </span>
          </CardTitle>
          {active.length > 0 ? <GearGrid items={toItems(active)} /> : <p className="text-sm text-slate-500">Sem equipamento ativo.</p>}
          <p className="mt-3 text-[11px] text-slate-500">
            Toque em &quot;adicionar preço&quot; para calcular o custo por km. Anel: verde até 50%, amarelo até 75%, laranja até 90%, vermelho daí — referência de 700km até possível substituição.
          </p>
        </Card>

        {retired.length > 0 && (
          <Card>
            <CardTitle>Reformados</CardTitle>
            <GearGrid items={toItems(retired)} />
          </Card>
        )}

        <div className="flex justify-end"><DataFreshnessDot isReal={isReal} error={error} /></div>
      </main>
    </div>
  );
}
