"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import type { StravaLabRecord } from "@/lib/strava-lab/client";

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
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

export function PersonalRecordsPanel({ records }: { records: StravaLabRecord[] }) {
  const [selected, setSelected] = useState(0);
  const active = records[selected];

  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" /> Recordes Pessoais (Strava)
        </span>
      </CardTitle>

      {/* Separadores de distância, ao estilo do anexo (Strava Best Efforts) */}
      <div className="mb-4 flex flex-wrap gap-2">
        {records.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setSelected(i)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selected === i ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {active ? (
        <div className="flex flex-col items-center py-4">
          {/* Medalha PR, ao estilo do anexo */}
          <div className="relative mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <Trophy size={32} className="text-amber-950" />
          </div>
          <div className="text-4xl font-bold text-slate-100">{formatHm(active.durationSec)}</div>
          <div className="mt-1 text-sm text-slate-400">{formatPace(active.paceMinPerKm)}</div>

          <div className="mt-4 w-full border-t border-slate-800 pt-3 text-center">
            <div className="text-sm font-medium text-cyan-400">{active.name}</div>
            <div className="text-xs text-slate-500">{formatDatePt(active.date)}</div>
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-slate-500">Sem recorde calculado para esta distância.</p>
      )}
    </Card>
  );
}
