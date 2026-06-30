"use client";

import { GearRing } from "@/components/dashboard/gear-ring";

export interface GearItem {
  id: string;
  name: string;
  distanceKm: number;
  retired: boolean;
  priceEur: number | null;
}

export function GearGrid({ items }: { items: GearItem[] }) {
  async function handleSavePrice(gearId: string, priceEur: number) {
    const res = await fetch("/api/strava-lab/gear-cost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gearId, priceEur }),
    });
    if (!res.ok) throw new Error("Falha ao guardar o preço.");
    // [Provável] Não revalida a página automaticamente — o valor fica
    // visível só depois de recarregar. Suficiente para já, evitar a
    // complexidade extra de um estado partilhado client/server agora.
    window.location.reload();
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((g) => (
        <GearRing
          key={g.id}
          gearId={g.id}
          name={g.name}
          distanceKm={g.distanceKm}
          retired={g.retired}
          priceEur={g.priceEur}
          onSavePrice={handleSavePrice}
        />
      ))}
    </div>
  );
}
