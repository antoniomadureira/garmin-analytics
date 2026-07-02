import { Card, CardTitle } from "@/components/ui/card";
import { Battery, Zap, Heart, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface RecoveryCardData {
  recoveryTimeHours: number | null;
  acuteLoad: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryMin: number | null;
  avgStress: number | null;
  hrv: number | null;
  hrvBaseline: number | null;
  restingHr: number | null;
  restingHrBaseline: number | null;
}

function Delta({ current, baseline, unit, invert = false }: {
  current: number | null; baseline: number | null; unit: string; invert?: boolean;
}) {
  if (current === null || baseline === null) return <span className="text-slate-500">—</span>;
  const diff = roundTo(current - baseline, 1);
  const pct = Math.round((Math.abs(diff) / baseline) * 100);
  // invert=true: para FC repouso, subir é mau; para HRV, subir é bom
  const positive = invert ? diff < 0 : diff > 0;
  const neutral = pct < 3;
  const color = neutral ? "text-slate-400" : positive ? "text-emerald-400" : "text-amber-400";
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${color}`}>
      <Icon size={11} />
      {diff > 0 ? "+" : ""}{diff}{unit}
      <span className="text-slate-600 ml-1">({pct}%)</span>
    </span>
  );
}

function roundTo(v: number, d: number) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

function RecoveryTimeBar({ hours }: { hours: number }) {
  // Escala: 0h = verde (pronto), 48h+ = vermelho (precisa de descanso)
  const pct = Math.min(100, Math.round((hours / 48) * 100));
  const color = hours <= 12 ? "#34d399" : hours <= 24 ? "#fbbf24" : hours <= 36 ? "#fb923c" : "#f87171";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function AcuteLoadBadge({ load }: { load: number }) {
  // ACWR >1.3 = zona de risco; <0.8 = desadaptação; 0.8-1.3 = zona ideal
  const zone = load > 1.3 ? { label: "Risco lesão", color: "text-red-400 bg-red-950/40 border-red-900" }
    : load < 0.8 ? { label: "Desadaptação", color: "text-amber-400 bg-amber-950/40 border-amber-900" }
    : { label: "Zona ideal", color: "text-emerald-400 bg-emerald-950/40 border-emerald-900" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${zone.color}`}>
      {zone.label}
    </span>
  );
}

export function RecoveryCard({ data }: { data: RecoveryCardData }) {
  return (
    <Card glow="emerald" className="flex-1">
      <CardTitle>Recuperação</CardTitle>
      <div className="space-y-3">

        {/* Tempo de recuperação — a métrica mais importante */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={11} /> Tempo até recuperação
            </span>
            <span className={`text-lg font-bold ${
              data.recoveryTimeHours === null ? "text-slate-500"
              : data.recoveryTimeHours <= 12 ? "text-emerald-400"
              : data.recoveryTimeHours <= 24 ? "text-fbbf24 text-amber-400"
              : "text-red-400"
            }`}>
              {data.recoveryTimeHours !== null ? `${data.recoveryTimeHours}h` : "—"}
            </span>
          </div>
          {data.recoveryTimeHours !== null && <RecoveryTimeBar hours={data.recoveryTimeHours} />}
          {data.recoveryTimeHours === null && (
            <p className="text-[10px] text-slate-600">Atraso de sincronização do Garmin (~5 dias)</p>
          )}
        </div>

        {/* HRV vs baseline pessoal */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Heart size={11} /> HRV
            {data.hrvBaseline && <span className="text-slate-600">(ref: {data.hrvBaseline}ms)</span>}
          </span>
          <div className="text-right">
            <span className="text-sm font-medium text-slate-200">
              {data.hrv !== null ? `${data.hrv}ms` : "—"}
            </span>
            <div className="mt-0.5">
              <Delta current={data.hrv} baseline={data.hrvBaseline} unit="ms" invert={false} />
            </div>
          </div>
        </div>

        {/* FC Repouso vs baseline pessoal */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Heart size={11} /> FC Repouso
            {data.restingHrBaseline && <span className="text-slate-600">(ref: {data.restingHrBaseline}bpm)</span>}
          </span>
          <div className="text-right">
            <span className="text-sm font-medium text-slate-200">
              {data.restingHr !== null ? `${data.restingHr}bpm` : "—"}
            </span>
            <div className="mt-0.5">
              {/* invert=true: FC repouso sobe quando está pior */}
              <Delta current={data.restingHr} baseline={data.restingHrBaseline} unit="bpm" invert />
            </div>
          </div>
        </div>

        {/* Carga aguda (ACWR) */}
        {data.acuteLoad !== null && (
          <div className="flex items-center justify-between border-t border-slate-800 pt-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp size={11} /> Carga Aguda (ACWR)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200">{data.acuteLoad.toFixed(2)}</span>
              <AcuteLoadBadge load={data.acuteLoad} />
            </div>
          </div>
        )}

        {/* Body Battery + Stress — mais compactos, informação de suporte */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Battery size={11} /> Bateria Corporal
          </span>
          <span className="text-sm font-medium text-slate-200">
            {data.bodyBatteryMin !== null && data.bodyBatteryMax !== null
              ? `${data.bodyBatteryMin}–${data.bodyBatteryMax}%`
              : "—"}
          </span>
        </div>
        {data.avgStress !== null && (
          <div className="flex items-center justify-between border-t border-slate-800 pt-1">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Zap size={11} /> Stress médio
            </span>
            <span className={`text-sm font-medium ${data.avgStress < 35 ? "text-slate-200" : data.avgStress < 50 ? "text-amber-400" : "text-red-400"}`}>
              {data.avgStress}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
