"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

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
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Card>
      <CardTitle>Atividades Recentes</CardTitle>
      <div className="divide-y divide-slate-800">
        {activities.map((a, i) => (
          <div key={`${a.date}-${i}`}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
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
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform ${expanded === i ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {expanded === i && (
              <div className="grid grid-cols-2 gap-3 bg-slate-800/20 px-2 py-3 sm:grid-cols-4">
                <div>
                  <div className="text-[11px] text-slate-500">Distância</div>
                  <div className="text-sm font-medium text-slate-200">{a.distanceKm.toLocaleString("pt-PT")} km</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Tempo</div>
                  <div className="text-sm font-medium text-slate-200">{formatHm(a.durationSec)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Pace</div>
                  <div className="text-sm font-medium text-slate-200">{formatPace(a.paceMinPerKm)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Elevação</div>
                  <div className="text-sm font-medium text-slate-200">
                    {a.elevationGainM !== null ? `${Math.round(a.elevationGainM)} m` : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {activities.length === 0 && <p className="py-4 text-sm text-slate-500">Sem atividades no período.</p>}
      </div>
    </Card>
  );
}
