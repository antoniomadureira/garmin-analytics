"use client";

import { useState } from "react";
import { ActivityDetailPanel } from "@/components/dashboard/activity-detail-panel";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export interface PersonalBestTile {
  label: string;
  durationSec: number;
  date: string;
  paceMinPerKm: number;
  distanceKm: number;
  activityName: string | null;
}

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

export function PersonalRecordsTiles({ records }: { records: PersonalBestTile[] }) {
  const [selected, setSelected] = useState<PersonalBestTile | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {records.map((r) => (
          <button
            key={r.label}
            onClick={() => setSelected(r)}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center transition hover:border-slate-700 hover:bg-slate-900/70"
          >
            <div className="text-xs text-slate-500">{r.label}</div>
            <div className="mt-1 text-2xl font-bold text-amber-400">{formatHm(r.durationSec)}</div>
            <div className="text-[11px] text-slate-500">{formatPace(r.paceMinPerKm)}</div>
            <div className="mt-1 truncate text-[11px] text-cyan-400 underline-offset-2 hover:underline">
              {r.activityName ?? "Corrida"}
            </div>
            <div className="text-[11px] text-slate-600">
              {formatDatePt(r.date)} · {r.distanceKm.toLocaleString("pt-PT")}km
            </div>
          </button>
        ))}
      </div>

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.activityName ?? "Corrida"} · ${formatDatePt(selected.date)}` : ""}
      >
        {selected && <ActivityDetailPanel date={selected.date} />}
      </BottomSheet>
    </>
  );
}
