"use client";

import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import type { ActivityDetailFull } from "@/components/dashboard/activity-detail-panel";
import { PrescribedVsExecutedCard, ActivityDetailPanel } from "@/components/dashboard/activity-detail-panel";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const wd = WEEKDAY_PT[d.getDay()];
  return `${wd} ${d.getDate()}/${d.getMonth() + 1}`;
}
function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function LastWorkoutCard({ date }: { date: string }) {
  const [data, setData] = useState<ActivityDetailFull | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/freddy/activity-detail?date=${date}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled && !json.error) setData(json); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date]);

  if (!data) {
    return <div className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/40 h-20" />;
  }

  const label = formatLabel(date);

  return (
    <>
      {/* [Certo] BottomSheet fora do card: backdrop-filter no card quebraria
          position:fixed nos descendentes (padrão confirmado em RecentActivitiesList). */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left p-4 transition hover:bg-slate-800/30 active:bg-slate-800/50"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Último Treino</span>
              <h3 className="text-sm font-semibold text-slate-200 mt-0.5">{data.activityName ?? "Corrida"}</h3>
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
            <ChevronRight size={16} className="text-slate-500 mt-1 flex-shrink-0" />
          </div>

          <div className="flex gap-5">
            <div>
              <div className="text-[10px] text-slate-500">Distância</div>
              <div className="text-sm font-semibold text-slate-200">{data.distanceKm.toFixed(1)} km</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Pace Médio</div>
              <div className="text-sm font-semibold text-slate-200">{formatPace(data.paceMinPerKm)}</div>
            </div>
            {data.avgHr !== null && (
              <div>
                <div className="text-[10px] text-slate-500">FC Média</div>
                <div className="text-sm font-semibold text-slate-200">{data.avgHr} bpm</div>
              </div>
            )}
          </div>
        </button>

        {(data.prescription || (data.execution?.aeroDecouplingPct !== null && data.execution !== null)) && (
          <div className="px-4 pb-4">
            <PrescribedVsExecutedCard prescription={data.prescription} execution={data.execution} />
          </div>
        )}
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={data.activityName ? `${data.activityName} · ${label}` : `Corrida · ${label}`}
      >
        {/* data já está em memória — o painel abre sem fetch extra */}
        <ActivityDetailPanel date={date} initialData={data} />
      </BottomSheet>
    </>
  );
}
