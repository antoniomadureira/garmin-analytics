import type { IcuPlannedEvent } from "@/lib/intervals/client";

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

/** Extract evaluate verdict emoji from LLM reply. 🛑 wins over others if multiple present. */
export function extractEvaluateVerdict(reply: string): "✅" | "⚠️" | "🛑" | null {
  if (reply.includes("🛑")) return "🛑";
  if (reply.includes("⚠️")) return "⚠️";
  if (reply.includes("✅")) return "✅";
  return null;
}
