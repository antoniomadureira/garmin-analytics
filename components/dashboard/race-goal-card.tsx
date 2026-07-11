"use client";

import { useState, useEffect } from "react";
import { formatMarathonTime, formatTimeDelta, deltaSeverity } from "@/lib/coach/goal-store";
import { DataFreshnessDot } from "@/components/ui/data-freshness-dot";
import type { RaceGoalCardData } from "@/lib/types/race-goal";

// re-export so page.tsx can still import the type without breaking
export type { RaceGoalCardData };

const PHASE_LABEL: Record<RaceGoalCardData["phase"], string> = {
  base: "Base",
  especifico: "Específico",
  taper: "Taper",
};

const PHASE_CLASS: Record<RaceGoalCardData["phase"], string> = {
  base: "bg-blue-950/60 text-blue-300 border-blue-800/50",
  especifico: "bg-emerald-950/60 text-emerald-300 border-emerald-800/50",
  taper: "bg-amber-950/60 text-amber-300 border-amber-800/50",
};

const DELTA_CLASS: Record<"green" | "amber" | "red", string> = {
  green: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-red-400",
};

function RaceGoalCardInner({ data, isReal, error }: { data: RaceGoalCardData; isReal: boolean; error?: string }) {
  const { raceName, raceDate, weeksLeft, phase, targetSec, predictedSec, predictionDate, predictionSourceLabel, predictionStale } = data;

  const delta = predictedSec !== null ? predictedSec - targetSec : null;
  const severity = delta !== null ? deltaSeverity(delta) : null;

  const raceDateDisplay = new Date(`${raceDate}T00:00:00`).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const footerText = (() => {
    if (predictedSec === null) return "Sem dados para previsão";
    if (!predictionDate || !predictionSourceLabel) return "";
    const datePt = new Date(`${predictionDate}T00:00:00`).toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
    });
    const staleNote = predictionStale ? " — corre um 10K de controlo para uma previsão atual" : "";
    return `${predictionSourceLabel} · ${datePt}${staleNote}`;
  })();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-100">🎯 Rumo ao sub-3h</h2>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {raceName} · {raceDateDisplay}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${PHASE_CLASS[phase]}`}
        >
          {PHASE_LABEL[phase]}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-slate-500">{weeksLeft} semanas restantes</p>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Previsão</span>
          <div className="flex items-center gap-2">
            {predictionSourceLabel && (
              <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-400">
                {predictionSourceLabel}
              </span>
            )}
            <span className="font-mono text-sm font-medium text-slate-200">
              {predictedSec !== null ? formatMarathonTime(predictedSec) : "—"}
            </span>
            {delta !== null && severity !== null && (
              <span className={`text-xs font-semibold tabular-nums ${DELTA_CLASS[severity]}`}>
                {formatTimeDelta(delta)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Objetivo</span>
          <span className="font-mono text-sm font-medium text-slate-200">{formatMarathonTime(targetSec)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-slate-600">{footerText}</p>
        <DataFreshnessDot isReal={isReal} error={error} />
      </div>
    </div>
  );
}

export function RaceGoalCard() {
  const [state, setState] = useState<
    { data: RaceGoalCardData; isReal: boolean; error?: string } | null | "loading"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/race-goal")
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setState(json.data ? json : null); })
      .catch(() => { if (!cancelled) setState(null); });
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40 h-28" />;
  }
  if (!state || !state.data) return null;

  return <RaceGoalCardInner data={state.data} isReal={state.isReal} error={state.error} />;
}
