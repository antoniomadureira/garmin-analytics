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
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PersonalRecordsPanel({ records }: { records: StravaLabRecord[] }) {
  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" /> Recordes Pessoais (Strava)
        </span>
      </CardTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {records.map((r) => (
          <div key={r.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-center">
            <div className="text-xs text-slate-500">{r.label}</div>
            <div className="mt-1 text-2xl font-bold text-amber-400">{formatHm(r.durationSec)}</div>
            <div className="text-[11px] text-slate-500">{formatPace(r.paceMinPerKm)}</div>
            <div className="mt-1 truncate text-[11px] text-cyan-400">{r.name}</div>
            <div className="text-[11px] text-slate-600">{formatDatePt(r.date)}</div>
          </div>
        ))}
        {records.length === 0 && <p className="col-span-full text-sm text-slate-500">Sem corridas correspondentes a nenhuma distância-alvo.</p>}
      </div>
    </Card>
  );
}
