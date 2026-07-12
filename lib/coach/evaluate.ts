import type { IcuPlannedEvent } from "@/lib/intervals/client";
import { secPerKmToMinSec } from "@/lib/coach/workout-history";

export type PlanSource = "manual" | "icu";

export interface ResolvedPlan {
  text: string;
  source: PlanSource;
  name: string;
}

/**
 * Priority: manual field > ICU event > null (prescribe mode).
 * Pure function — no side effects.
 */
export function selectPlannedWorkout(
  manualText: string | null,
  icuEvent: IcuPlannedEvent | null,
): ResolvedPlan | null {
  if (manualText?.trim()) {
    return { text: manualText.trim(), source: "manual", name: "Plano do dia" };
  }
  if (icuEvent?.description?.trim()) {
    return { text: icuEvent.description.trim(), source: "icu", name: icuEvent.name };
  }
  return null;
}

/** Extract evaluate/review verdict emoji from LLM reply. 🛑 wins if multiple present. */
export function extractEvaluateVerdict(reply: string): "✅" | "⚠️" | "🛑" | null {
  if (reply.includes("🛑")) return "🛑";
  if (reply.includes("⚠️")) return "⚠️";
  if (reply.includes("✅")) return "✅";
  return null;
}

// Patterns that suggest the user pasted their plan in the message text instead of the field
const PLAN_PATTERNS = [
  /\bo plano\b/i,
  /\bprescrito\s+era\b/i,
  /\b\d+x\s*\d+(km|mtr|min)\b/i, // 6x1km, 8x1000m, 4x15min
  /@\s*\d+:\d+\s*\/km/i,          // @4:10/km
];

/**
 * Returns the trimmed text if it looks like a workout plan, null otherwise.
 * Used to auto-detect plans pasted into the chat input instead of the plan field.
 */
export function extractPlanFromMessage(text: string): string | null {
  return PLAN_PATTERNS.some((p) => p.test(text)) ? text.trim() : null;
}

/**
 * Build the pre-computed review context line injected when a plan exists AND
 * an activity was executed today. Computes pace deviation in code so the LLM
 * only cites numbers, never does arithmetic.
 */
export function buildReviewContext(
  exec: { distanceKm: number; durationSec: number; paceMinPerKm: number | null },
  plan: ResolvedPlan,
  mainPace: { minSecPerKm: number; maxSecPerKm: number } | null,
): string {
  const execPaceStr =
    exec.paceMinPerKm != null
      ? `${secPerKmToMinSec(Math.round(exec.paceMinPerKm * 60))}/km`
      : "—";
  const execMin = Math.round(exec.durationSec / 60);
  let line = `[EXECUÇÃO DE HOJE vs PLANO "${plan.name}"]: executaste ${exec.distanceKm.toFixed(1)}km em ${execMin}min (pace ${execPaceStr}).`;

  if (mainPace && exec.paceMinPerKm != null) {
    const actualSec = Math.round(exec.paceMinPerKm * 60);
    const { minSecPerKm, maxSecPerKm } = mainPace;
    const targetStr = `${secPerKmToMinSec(minSecPerKm)}-${secPerKmToMinSec(maxSecPerKm)}/km`;
    let paceLabel: string;
    if (actualSec < minSecPerKm) {
      paceLabel = `${minSecPerKm - actualSec}s mais rápido que o alvo (${targetStr})`;
    } else if (actualSec > maxSecPerKm) {
      paceLabel = `${actualSec - maxSecPerKm}s mais lento que o alvo (${targetStr})`;
    } else {
      paceLabel = `dentro do alvo (${targetStr})`;
    }
    line += ` Pace vs alvo: ${paceLabel}.`;
  }

  return line;
}
