import { Card, CardTitle } from "@/components/ui/card";

export interface RecoveryCardData {
  recoveryTimeHours: number | null;
  bodyBatteryMax: number;
  bodyBatteryMin: number;
  avgStress: number;
  recommendation: string;
}

function BodyBatteryBar({ max, min }: { max: number; min: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
        style={{ width: `${max}%` }}
      />
    </div>
  );
}

export function RecoveryCard({ data }: { data: RecoveryCardData }) {
  return (
    <Card glow="emerald">
      <CardTitle>Recuperação</CardTitle>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Tempo de Recuperação</span>
        <span className="font-medium text-slate-100" title={data.recoveryTimeHours === null ? "Sem dado recente — trainingReadiness_score tem atraso de sincronização no Freddy" : undefined}>
          {data.recoveryTimeHours !== null ? `${data.recoveryTimeHours}h` : "—"}
        </span>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Bateria Corporal</span>
          <span>
            {data.bodyBatteryMin}–{data.bodyBatteryMax}
          </span>
        </div>
        <BodyBatteryBar max={data.bodyBatteryMax} min={data.bodyBatteryMin} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">Stress médio</span>
        <span className="font-medium text-slate-100">{data.avgStress}</span>
      </div>
      <p className="mt-3 rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-300">{data.recommendation}</p>
    </Card>
  );
}
