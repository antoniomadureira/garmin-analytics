import type { PrescribedWorkout, WorkoutExecution } from "@/lib/types/coach";
import { MIN_REAL_ACTIVITY_KM } from "@/lib/utils/activity";

/** Pace acima deste valor (min/km) indica atividade fantasma. */
const MAX_REAL_PACE_MIN_PER_KM = 15;

function isGhostExecution(exec: WorkoutExecution | null): boolean {
  if (!exec) return false;
  if (exec.distanceKm < MIN_REAL_ACTIVITY_KM) return true;
  if (exec.avgPaceMinPerKm !== null && exec.avgPaceMinPerKm > MAX_REAL_PACE_MIN_PER_KM) return true;
  return false;
}

export function secPerKmToMinSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function decouplingBadge(pct: number): string {
  return pct < 5 ? "estável" : pct <= 8 ? "deriva moderada" : "deriva elevada";
}

/**
 * Desvio de pace em texto direcional, vs o limite mais próximo do range prescrito.
 * Calculado em código — o modelo cita, não interpreta.
 * Ex: 4:44 vs alvo 5:00-5:15 → "desvio: 16s mais rápido que o alvo"
 */
function paceDeviationLabel(
  avgPaceMinPerKm: number,
  mainPace: { minSecPerKm: number; maxSecPerKm: number },
): string {
  const actualSec = Math.round(avgPaceMinPerKm * 60);
  if (actualSec < mainPace.minSecPerKm) {
    return `desvio: ${mainPace.minSecPerKm - actualSec}s mais rápido que o alvo`;
  }
  if (actualSec > mainPace.maxSecPerKm) {
    return `desvio: ${actualSec - mainPace.maxSecPerKm}s mais lento que o alvo`;
  }
  return "dentro do alvo";
}

export function formatWorkoutHistory(
  pairs: Array<{
    date: string;
    prescribed: PrescribedWorkout | null;
    executed: WorkoutExecution | null;
  }>,
  includeInstruction = true,
): string {
  const lines = pairs
    .map((p) => ({ ...p, executed: isGhostExecution(p.executed) ? null : p.executed }))
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
        if (prescribed?.mainPace && executed.avgPaceMinPerKm !== null) {
          execParts.push(paceDeviationLabel(executed.avgPaceMinPerKm, prescribed.mainPace));
        }
        parts.push(execParts.join(", "));
      } else {
        parts.push("sem execução registada");
      }

      return parts.join(" — ");
    });

  if (!lines.length) return "";
  const header = includeInstruction
    ? "[HISTÓRICO PRESCRITO/EXECUTADO — DEVES referir explicitamente o último treino executado (pace, desvio do alvo quando existir) na tua justificação antes de prescrever hoje]"
    : "[HISTÓRICO PRESCRITO/EXECUTADO]";
  return `${header}:\n${lines.join("\n")}`;
}
