"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { ActivityDetailPanel } from "@/components/dashboard/activity-detail-panel";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export interface RecentActivity {
  date: string;
  distanceKm: number;
  durationSec: number;
  paceMinPerKm: number;
  elevationGainM: number | null;
}

function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} min`;
}
function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}
function formatDatePt(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

export function RecentActivitiesList({ activities }: { activities: RecentActivity[] }) {
  const [selected, setSelected] = useState<RecentActivity | null>(null);

  return (
    <>
      <Card>
        <CardTitle>Atividades Recentes</CardTitle>
        <div className="divide-y divide-slate-800">
          {activities.map((a, i) => (
            <button
              key={`${a.date}-${i}`}
              onClick={() => setSelected(a)}
              className="flex w-full items-center justify-between py-3 text-left transition hover:bg-slate-800/30"
            >
              <div>
                <div className="text-sm font-medium text-slate-200">Corrida · {formatDatePt(a.date)}</div>
                <div className="text-xs text-slate-500">{a.distanceKm.toLocaleString("pt-PT")} km</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden text-right sm:block">
                  <div className="text-xs text-slate-400">{formatHm(a.durationSec)}</div>
                  <div className="text-xs text-slate-500">{formatPace(a.paceMinPerKm)}</div>
                </div>
                <ChevronRight size={16} className="text-slate-500" />
              </div>
            </button>
          ))}
          {activities.length === 0 && <p className="py-4 text-sm text-slate-500">Sem atividades no período.</p>}
        </div>
      </Card>

      {/* [Certo] Fora do Card de propósito: Card usa backdrop-blur (backdrop-filter),
          e qualquer filter/backdrop-filter num antepassado quebra position:fixed
          dos descendentes (cria um novo containing block). Dentro do Card, o
          painel ficava fixo DENTRO da card, não no ecrã — por isso não aparecia. */}
      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Corrida · ${formatDatePt(selected.date)}` : ""}
      >
        {selected && <ActivityDetailPanel date={selected.date} />}
      </BottomSheet>
    </>
  );
}
