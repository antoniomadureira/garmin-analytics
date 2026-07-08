"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StatTile } from "@/components/ui/stat-tile";
import { ActivitySeriesChart, type DetailSeriesPoint } from "@/components/dashboard/activity-series-chart";
import { Gauge, Clock, Zap, Heart, TrendingUp, Mountain, Flame, Footprints } from "lucide-react";
import type { PrescribedWorkout, WorkoutExecution } from "@/lib/types/coach";

const RouteMap = dynamic(() => import("@/components/dashboard/route-map").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-slate-900/50" />,
});

export interface ActivityDetailFull {
  date: string;
  distanceKm: number;
  durationSec: number;
  paceMinPerKm: number;
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number | null;
  caloriesKcal: number | null;
  route: [number, number][];
  series: DetailSeriesPoint[];
  samplesUnavailable: boolean;
  prescription?: PrescribedWorkout | null;
  execution?: WorkoutExecution | null;
}

function formatHm(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(Math.round(totalSeconds % 60)).padStart(2, "0")}` : `${m}m`;
}
function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

interface StravaDetail {
  segmentEfforts: { segmentName: string; distanceM: number; elapsedTimeSec: number; elevGainM: number }[];
  bestEfforts: { label: string; seconds: number }[];
  prCount: number;
  laps: { lapIndex: number; name: string; distanceM: number; elapsedTimeSec: number; avgHr: number | null }[];
  notFound?: boolean;
  error?: string;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtSecPerKm(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function DecouplingBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const { cls, label } =
    pct < 5
      ? { cls: "text-emerald-400 border-emerald-800 bg-emerald-950/40", label: "aeróbico estável" }
      : pct <= 8
        ? { cls: "text-amber-400 border-amber-800 bg-amber-950/40", label: "deriva moderada" }
        : { cls: "text-red-400 border-red-800 bg-red-950/40", label: "deriva elevada" };
  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      <span>Decoupling {pct.toFixed(1)}%</span>
      <span className="opacity-60">· {label}</span>
    </div>
  );
}

export function PrescribedVsExecutedCard({
  prescription,
  execution,
}: {
  prescription: PrescribedWorkout | null | undefined;
  execution: WorkoutExecution | null | undefined;
}) {
  const hasDecoupling = execution != null && execution.aeroDecouplingPct !== null;
  if (!hasDecoupling && !prescription) return null;

  const rows: Array<{ label: string; prescribed: string; actual: string; good?: boolean }> = [];

  if (prescription?.mainPace && execution?.avgPaceMinPerKm !== null && execution?.avgPaceMinPerKm) {
    const targetMidSec =
      (prescription.mainPace.minSecPerKm + prescription.mainPace.maxSecPerKm) / 2;
    const actualSec = Math.round(execution.avgPaceMinPerKm * 60);
    const within =
      actualSec >= prescription.mainPace.minSecPerKm &&
      actualSec <= prescription.mainPace.maxSecPerKm;
    rows.push({
      label: "Pace médio",
      prescribed: `${fmtSecPerKm(prescription.mainPace.minSecPerKm)}–${fmtSecPerKm(prescription.mainPace.maxSecPerKm)}`,
      actual: fmtSecPerKm(actualSec),
      good: within || Math.abs(actualSec - targetMidSec) < 15,
    });
  }

  if (prescription?.totalDurationSec && execution?.durationSec) {
    const deltMin = Math.round((execution.durationSec - prescription.totalDurationSec) / 60);
    rows.push({
      label: "Duração",
      prescribed: `${Math.round(prescription.totalDurationSec / 60)}min`,
      actual: `${Math.round(execution.durationSec / 60)}min`,
      good: Math.abs(deltMin) <= 5,
    });
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {prescription ? `Análise · ${prescription.name}` : "Análise do Treino"}
        </h4>
        {execution && <DecouplingBadge pct={execution.aeroDecouplingPct} />}
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-x-2 text-xs text-slate-500">
          <span />
          <span className="text-center">Prescrito</span>
          <span className="text-center">Executado</span>
          {rows.map((r) => (
            <>
              <span key={`${r.label}-l`} className="text-slate-500">{r.label}</span>
              <span key={`${r.label}-p`} className="text-center text-slate-400">{r.prescribed}</span>
              <span
                key={`${r.label}-a`}
                className={`text-center font-medium ${r.good ? "text-emerald-400" : "text-amber-400"}`}
              >
                {r.actual}
              </span>
            </>
          ))}
        </div>
      )}
    </div>
  );
}

interface HrZone {
  zone: number;
  min: number;
  max: number;
}

export function ActivityDetailPanel({ date }: { date: string }) {
  const [data, setData] = useState<ActivityDetailFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strava, setStrava] = useState<StravaDetail | null>(null);
  const [zones, setZones] = useState<HrZone[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/strava-lab/zones")
      .then((res) => res.json())
      .then((json) => !cancelled && json.heartRateZones && setZones(json.heartRateZones))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/freddy/activity-detail?date=${date}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch((err) => !cancelled && setError(String(err)));

    // [Certo] Pedido separado e silencioso ao strava-lab (app externa,
    // já validada) — se não encontrar correspondência por data, esta
    // secção simplesmente não aparece, sem bloquear o resto do painel.
    fetch(`/api/strava-lab/activity-detail?date=${date}`)
      .then((res) => res.json())
      .then((json) => !cancelled && setStrava(json))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [date]);

  if (error) {
    return <p className="px-2 py-3 text-xs text-amber-500">Não foi possível carregar o detalhe: {error.slice(0, 120)}</p>;
  }
  if (!data) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-800 bg-slate-900"
          style={{ animation: "run-pulse 1s ease-in-out infinite" }}
        >
          <Footprints size={26} className="text-orange-400" />
        </div>
        <span className="text-xs text-slate-500">A carregar a corrida…</span>
        <style>{`
          @keyframes run-pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.08); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-2 py-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={<Gauge size={14} />} label="Distância" value={data.distanceKm.toLocaleString("pt-PT")} unit="km" sublabel="" accent="#fb923c" />
        <StatTile icon={<Clock size={14} />} label="Tempo" value={formatHm(data.durationSec)} sublabel="" accent="#e2e8f0" />
        <StatTile icon={<Zap size={14} />} label="Pace Médio" value={formatPace(data.paceMinPerKm)} sublabel="" accent="#22d3ee" />
        <StatTile icon={<Heart size={14} />} label="FC Média" value={data.avgHr} unit="bpm" sublabel={data.maxHr ? `máx ${data.maxHr}bpm` : ""} accent="#fb7185" />
        <StatTile icon={<TrendingUp size={14} />} label="FC Máxima" value={data.maxHr} unit="bpm" sublabel="" accent="#f87171" />
        <StatTile icon={<Mountain size={14} />} label="Elevação" value={data.elevationGainM !== null ? Math.round(data.elevationGainM) : null} unit="m" sublabel="" accent="#34d399" />
        <StatTile icon={<Flame size={14} />} label="Calorias" value={data.caloriesKcal} unit="kcal" sublabel="" accent="#fb923c" />
      </div>

      <PrescribedVsExecutedCard prescription={data.prescription} execution={data.execution} />

      {data.samplesUnavailable ? (
        <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 text-xs text-slate-500">
          Sem dados detalhados (mapa, FC/altitude/pace ao segundo) para esta corrida — só ficam disponíveis para
          atividades dos últimos ~35 dias. As estatísticas acima (distância, tempo, FC média, etc.) continuam corretas.
        </p>
      ) : (
        <>
          <RouteMap route={data.route} />
          {data.series.length > 0 ? (
            <ActivitySeriesChart series={data.series} />
          ) : (
            <p className="text-xs text-slate-500">Sem amostras detalhadas (FC/altitude/pace) para esta atividade.</p>
          )}
        </>
      )}

      {strava && !strava.notFound && !strava.error && (
        <div className="space-y-3 border-t border-slate-800 pt-3">
          {strava.laps && strava.laps.length > 1 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Laps / Splits</h4>
              <div className="space-y-1">
                {strava.laps.map((l) => (
                  <div key={l.lapIndex} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-2.5 py-1.5 text-xs">
                    <span className="text-slate-400">Lap {l.lapIndex}</span>
                    <span className="text-slate-300">{(l.distanceM / 1000).toFixed(2)}km</span>
                    <span className="text-slate-300">{formatSeconds(l.elapsedTimeSec)}</span>
                    <span className="text-slate-400">{l.avgHr ? `${Math.round(l.avgHr)}bpm` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {strava.bestEfforts.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Melhores Tempos (Strava)</h4>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {strava.bestEfforts.map((b) => (
                  <div key={b.label} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-center">
                    <div className="text-[11px] text-slate-500">{b.label}</div>
                    <div className="text-sm font-semibold text-orange-400">{formatSeconds(b.seconds)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {strava.segmentEfforts.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Segmentos {strava.prCount > 0 ? `· ${strava.prCount} PR${strava.prCount > 1 ? "s" : ""}` : ""}
              </h4>
              <div className="space-y-1.5">
                {strava.segmentEfforts.slice(0, 8).map((s) => (
                  <div key={s.segmentName} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-2.5 py-1.5 text-xs">
                    <span className="text-slate-300">{s.segmentName}</span>
                    <span className="text-slate-400">
                      {formatSeconds(s.elapsedTimeSec)} · {(s.distanceM / 1000).toFixed(2)}km
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {zones && zones.length > 0 && data.series.length > 0 && !data.samplesUnavailable && (
        <div className="border-t border-slate-800 pt-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tempo em Zona (FC)</h4>
          {(() => {
            // [Provável] Aproximação: cada amostra pesa o mesmo tempo
            // (duração total ÷ nº de amostras) — não usa os timestamps
            // exatos entre amostras, que já não temos isolados aqui.
            const samplesWithHr = data.series.filter((p) => p.hr !== null);
            const secPerSample = samplesWithHr.length ? data.durationSec / data.series.length : 0;
            const counts = zones.map(() => 0);
            for (const p of samplesWithHr) {
              const idx = zones.findIndex((z) => (p.hr as number) >= z.min && (z.max < 0 || p.hr as number <= z.max));
              if (idx >= 0) counts[idx] += secPerSample;
            }
            const total = counts.reduce((a, b) => a + b, 0) || 1;
            return (
              <div className="space-y-1">
                {zones.map((z, i) => (
                  <div key={z.zone} className="flex items-center gap-2 text-xs">
                    <span className="w-10 text-slate-500">Z{z.zone}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(counts[i] / total) * 100}%`, backgroundColor: ["#34d399", "#22d3ee", "#fbbf24", "#fb923c", "#f87171"][i] || "#94a3b8" }}
                      />
                    </div>
                    <span className="w-12 text-right text-slate-400">{formatHm(counts[i])}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
