import type { PrescribedWorkout, WorkoutExecution } from "@/lib/types/coach";

export function secPerKmToMinSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function decouplingBadge(pct: number): string {
  return pct < 5 ? "estável" : pct <= 8 ? "deriva moderada" : "deriva elevada";
}

export function formatWorkoutHistory(
  pairs: Array<{
    date: string;
    prescribed: PrescribedWorkout | null;
    executed: WorkoutExecution | null;
  }>,
): string {
  const lines = pairs
    .filter((p) => p.prescribed || p.executed)
    .map(({ date, prescribed, executed }) => {
      const parts: string[] = [date];

      if (prescribed) {
        parts.push(`"${prescribed.name}"`);
        const preParts: string[] = [];
        if (prescribed.totalDurationSec)
          preParts.push(`${Math.round(prescribed.totalDurationSec / 60)}min`);
        if (prescribed.mainPace)
          preParts.push(
            `alvo ${secPerKmToMinSec(prescribed.mainPace.minSecPerKm)}-${secPerKmToMinSec(prescribed.mainPace.maxSecPerKm)}/km`,
          );
        if (preParts.length) parts.push(`prescrito: ${preParts.join(" + ")}`);
      }

      if (executed) {
        // Sem prescrição: prefixo de contexto + colon no primeiro elemento
        const firstExec = prescribed
          ? `executado ${executed.distanceKm.toFixed(1)}km em ${Math.round(executed.durationSec / 60)}min`
          : `treino sem prescrição: ${executed.distanceKm.toFixed(1)}km em ${Math.round(executed.durationSec / 60)}min`;

        const execParts: string[] = [firstExec];
        if (executed.avgPaceMinPerKm !== null)
          execParts.push(`pace ${secPerKmToMinSec(Math.round(executed.avgPaceMinPerKm * 60))}/km`);
        if (executed.avgHrBpm !== null)
          execParts.push(`FC ${Math.round(executed.avgHrBpm)}bpm`);
        if (executed.aeroDecouplingPct !== null)
          execParts.push(`decoupling ${executed.aeroDecouplingPct.toFixed(1)}% (${decouplingBadge(executed.aeroDecouplingPct)})`);
        if (executed.paceVsTargetSecPerKm !== null) {
          const sign = executed.paceVsTargetSecPerKm >= 0 ? "+" : "";
          execParts.push(`pace ${sign}${executed.paceVsTargetSecPerKm}s/km vs alvo`);
        }
        parts.push(execParts.join(", "));
      } else {
        parts.push("sem execução registada");
      }

      return parts.join(" — ");
    });

  if (!lines.length) return "";
  return `[HISTÓRICO PRESCRITO/EXECUTADO — DEVES referir explicitamente o último treino executado (pace, desvio do alvo quando existir) na tua justificação antes de prescrever hoje]:\n${lines.join("\n")}`;
}
