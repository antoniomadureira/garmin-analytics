"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StatTile } from "@/components/ui/stat-tile";
import { ActivitySeriesChart, type DetailSeriesPoint } from "@/components/dashboard/activity-series-chart";
import { Gauge, Clock, Zap, Heart, TrendingUp, Mountain, Flame } from "lucide-react";

const RouteMap = dynamic(() => import("@/components/dashboard/route-map").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-slate-900/50" />,
});

interface ActivityDetailFull {
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

export function ActivityDetailPanel({ date }: { date: string }) {
  const [data, setData] = useState<ActivityDetailFull | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (error) {
    return <p className="px-2 py-3 text-xs text-amber-500">Não foi possível carregar o detalhe: {error.slice(0, 120)}</p>;
  }
  if (!data) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-900/50" />;
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

      <RouteMap route={data.route} />

      {data.series.length > 0 ? (
        <ActivitySeriesChart series={data.series} />
      ) : (
        <p className="text-xs text-slate-500">Sem amostras detalhadas (FC/altitude/pace) para esta atividade.</p>
      )}
    </div>
  );
}
